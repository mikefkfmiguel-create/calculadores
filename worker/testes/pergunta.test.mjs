// Testes da rota /pergunta ("Better call Mike") e /pergunta/propor.
//
// O que se protege: a resposta diz de onde vem, e essa origem é verificada no
// Worker, não confiada ao modelo --
//   · "notas" só quando o modelo nomeia uma nota que existe no índice;
//   · "web" só com citações que a própria API anexou ao texto;
//   · sem nenhuma das duas, a resposta fica marcada "geral".
//
//   node --test "worker/testes/*.test.mjs"
//
// fetch é trocado: nem a Anthropic nem o GitHub Pages são chamados.

import { test } from "node:test";
import assert from "node:assert/strict";
import worker from "../src/index.js";
import { interpretar, MODELO_PERGUNTA } from "../src/pergunta.js";

const ORIGEM = "https://mikefkfmiguel-create.github.io";
const BASE = "https://notas.teste/conhecimento/";

function kvFalso() {
  const dados = new Map();
  return {
    dados,
    async get(k) { return dados.has(k) ? dados.get(k) : null; },
    async put(k, v) { dados.set(k, v); },
  };
}

function ambiente(extra = {}) {
  return {
    ALLOWED_ORIGINS: ORIGEM,
    ANTHROPIC_API_KEY: "sk-teste",
    CONHECIMENTO_URL: BASE,
    USO: kvFalso(),
    REGISTOS: kvFalso(),
    ...extra,
  };
}

function pedido(caminho, corpo) {
  return new Request("https://w.dev" + caminho, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: ORIGEM, "CF-Connecting-IP": "1.2.3.4" },
    body: JSON.stringify(corpo),
  });
}

const esperas = [];
const ctx = { waitUntil(p) { esperas.push(p); } };

const INDICE = { notas: [{ ficheiro: "novastar.md", titulo: "NovaStar 10-bit" }] };
const NOTA = "# NovaStar\n\n18bit+ ligado a 50% de brilho.";

function trocarFetch(respostaIA, registo = {}) {
  const original = globalThis.fetch;
  globalThis.fetch = async (url, opts) => {
    const u = String(url);
    if (u === BASE + "indice.json") return new Response(JSON.stringify(INDICE), { status: 200 });
    if (u === BASE + "novastar.md") return new Response(NOTA, { status: 200 });
    if (u.startsWith("https://api.anthropic.com")) {
      registo.corpo = JSON.parse(opts.body);
      return new Response(JSON.stringify(respostaIA), { status: 200 });
    }
    return new Response("não", { status: 404 });
  };
  return () => { globalThis.fetch = original; };
}

test("resposta das notas: origem 'notas' quando nomeia uma nota real, e a nota vai no system", async () => {
  const visto = {};
  const repor = trocarFetch({ content: [{ type: "text", text: "ORIGEM: notas\nNOTAS: novastar.md\n\nLiga o **18bit+**." }] }, visto);
  try {
    const r = await worker.fetch(pedido("/pergunta", { pergunta: "A8s a 50% de brilho?" }), ambiente(), ctx);
    const d = await r.json();
    assert.equal(d.ok, true);
    assert.deepEqual(d.origem, ["notas"]);
    assert.equal(d.notasUsadas[0].ficheiro, "novastar.md");
    assert.equal(d.resposta, "Liga o **18bit+**.");
    assert.match(visto.corpo.system, /18bit\+ ligado a 50%/);
    assert.equal(visto.corpo.model, MODELO_PERGUNTA);
    assert.equal(visto.corpo.tools[0].type, "web_search_20250305");
  } finally { repor(); }
});

test("nota inventada pelo modelo não conta: fica 'geral'", async () => {
  const repor = trocarFetch({ content: [{ type: "text", text: "ORIGEM: notas\nNOTAS: brompton.md\n\nResposta." }] });
  try {
    const d = await (await worker.fetch(pedido("/pergunta", { pergunta: "Brompton?" }), ambiente(), ctx)).json();
    assert.deepEqual(d.origem, ["geral"]);
    assert.equal(d.notasUsadas.length, 0);
  } finally { repor(); }
});

test("'web' só com citações da API; endereços vêm das citações", async () => {
  const repor = trocarFetch({
    content: [
      { type: "web_search_tool_result", content: [{ url: "https://novastar.tech/a8s", title: "A8s" }] },
      { type: "text", text: "ORIGEM: web\nNOTAS: nenhuma\n\nSegundo o manual, " },
      { type: "text", text: "suporta 18bit+.", citations: [{ type: "web_search_result_location", url: "https://novastar.tech/a8s", title: "A8s" }] },
    ],
  });
  try {
    const d = await (await worker.fetch(pedido("/pergunta", { pergunta: "A8s suporta 18bit+?" }), ambiente(), ctx)).json();
    assert.deepEqual(d.origem, ["web"]);
    assert.deepEqual(d.fontes, [{ titulo: "A8s", url: "https://novastar.tech/a8s" }]);
    assert.equal(d.resposta, "Segundo o manual, suporta 18bit+.");
  } finally { repor(); }
});

test("'web' declarado sem citação nenhuma fica 'geral'", async () => {
  const repor = trocarFetch({ content: [{ type: "text", text: "ORIGEM: web\nNOTAS: nenhuma\n\nAcho que sim." }] });
  try {
    const d = await (await worker.fetch(pedido("/pergunta", { pergunta: "x?" }), ambiente(), ctx)).json();
    assert.deepEqual(d.origem, ["geral"]);
  } finally { repor(); }
});

test("foto vai como bloco de imagem; sem texto também serve", async () => {
  const visto = {};
  const repor = trocarFetch({ content: [{ type: "text", text: "ORIGEM: geral\nNOTAS: nenhuma\n\nVejo o NovaLCT." }] }, visto);
  try {
    const d = await (await worker.fetch(pedido("/pergunta", { imageBase64: "aGVsbG8=", imageMediaType: "image/jpeg" }), ambiente(), ctx)).json();
    assert.equal(d.ok, true);
    const blocos = visto.corpo.messages.at(-1).content;
    assert.equal(blocos[0].type, "image");
    assert.equal(blocos[0].source.media_type, "image/jpeg");
  } finally { repor(); }
});

test("histórico entra como conversa, limitado às últimas 8 trocas", async () => {
  const visto = {};
  const repor = trocarFetch({ content: [{ type: "text", text: "ORIGEM: geral\nNOTAS: nenhuma\n\nOk." }] }, visto);
  try {
    const historico = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((i) => ({ p: "p" + i, r: "r" + i }));
    await worker.fetch(pedido("/pergunta", { pergunta: "e agora?", historico }), ambiente(), ctx);
    const m = visto.corpo.messages;
    assert.equal(m.length, 17);
    assert.equal(m[0].content, "p4");
    assert.equal(m[1].role, "assistant");
  } finally { repor(); }
});

test("pedido vazio não chega à IA nem gasta quota", async () => {
  let chamou = false;
  const original = globalThis.fetch;
  globalThis.fetch = async () => { chamou = true; return new Response("{}"); };
  try {
    const env = ambiente();
    const r = await worker.fetch(pedido("/pergunta", { pergunta: "  " }), env, ctx);
    assert.equal(r.status, 400);
    assert.equal(chamou, false);
    assert.equal(env.USO.dados.size, 0);
  } finally { globalThis.fetch = original; }
});

test("trava de gasto: no limite do dia responde com o motivo, sem chamar a IA", async () => {
  let chamou = false;
  const original = globalThis.fetch;
  globalThis.fetch = async () => { chamou = true; return new Response("{}"); };
  try {
    const env = ambiente({ LIMITE_IA_POR_DIA: "1" });
    env.USO.dados.set("lim:dia:" + new Date().toISOString().slice(0, 10), "1");
    const r = await worker.fetch(pedido("/pergunta", { pergunta: "olá?" }), env, ctx);
    const d = await r.json();
    assert.equal(r.status, 429);
    assert.equal(d.ok, false);
    assert.match(d.motivo, /limite/i);
    assert.equal(chamou, false);
  } finally { globalThis.fetch = original; }
});

test("sem notas acessíveis responde na mesma", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async (url) => String(url).startsWith("https://api.anthropic.com")
    ? new Response(JSON.stringify({ content: [{ type: "text", text: "ORIGEM: geral\nNOTAS: nenhuma\n\nResposta." }] }))
    : new Response("erro", { status: 500 });
  try {
    const d = await (await worker.fetch(pedido("/pergunta", { pergunta: "x?" }), ambiente(), ctx)).json();
    assert.equal(d.ok, true);
    assert.deepEqual(d.origem, ["geral"]);
  } finally { globalThis.fetch = original; }
});

test("propor como nota guarda na REGISTOS sem chamar a IA", async () => {
  let chamou = false;
  const original = globalThis.fetch;
  globalThis.fetch = async () => { chamou = true; return new Response("{}"); };
  try {
    const env = ambiente();
    const r = await worker.fetch(pedido("/pergunta/propor", {
      pergunta: "A8s 50%?", resposta: "18bit+ ligado.", comentario: "Confirmado no Altice", origem: ["notas", "inventado"],
    }), env, ctx);
    assert.equal((await r.json()).ok, true);
    assert.equal(chamou, false);
    const [chave, valor] = [...env.REGISTOS.dados.entries()][0];
    assert.match(chave, /-proposta-/);
    const p = JSON.parse(valor);
    assert.equal(p.tipo, "proposta-nota");
    assert.equal(p.comentario, "Confirmado no Altice");
    assert.deepEqual(p.origem, ["notas"]);
  } finally { globalThis.fetch = original; }
});

test("interpretar sem cabeçalho devolve o texto todo", () => {
  const r = interpretar("Só texto.", []);
  assert.equal(r.resposta, "Só texto.");
  assert.deepEqual(r.origem, []);
});

test("o nome de quem pergunta vai para as instruções e para o registo", async () => {
  const visto = {};
  const repor = trocarFetch({ content: [{ type: "text", text: "ORIGEM: geral\nNOTAS: nenhuma\n\nJoão, sim." }] }, visto);
  try {
    const env = ambiente();
    esperas.length = 0;
    await worker.fetch(pedido("/pergunta", { pergunta: "x?", nome: "  João <Silva>  " }), env, ctx);
    await Promise.all(esperas);
    assert.match(visto.corpo.system, /chama-se João Silva\./);
    const reg = JSON.parse([...env.REGISTOS.dados.values()][0]);
    assert.equal(reg.nome, "João Silva");
  } finally { repor(); }
});

test("PDF e texto anexado vão como blocos; sem pergunta pede-se um resumo", async () => {
  const visto = {};
  const repor = trocarFetch({ content: [{ type: "text", text: "ORIGEM: geral\nNOTAS: nenhuma\n\nResumo." }] }, visto);
  try {
    const env = ambiente();
    esperas.length = 0;
    const d = await (await worker.fetch(pedido("/pergunta", {
      pdfBase64: "JVBERi0=", anexoTexto: "Olá, para o evento de dia 10 precisamos de...", anexoNome: "email.txt",
    }), env, ctx)).json();
    await Promise.all(esperas);
    assert.equal(d.ok, true);
    const blocos = visto.corpo.messages.at(-1).content;
    assert.equal(blocos[0].type, "document");
    assert.equal(blocos[0].source.media_type, "application/pdf");
    assert.match(blocos[1].text, /Texto anexado \(email\.txt\)/);
    assert.match(blocos.at(-1).text, /Resume/);
    const reg = JSON.parse([...env.REGISTOS.dados.values()][0]);
    assert.equal(reg.temPdf, true);
    assert.equal(reg.anexoNome, "email.txt");
  } finally { repor(); }
});

test("um email colado na caixa (longo) cabe na pergunta", async () => {
  const repor = trocarFetch({ content: [{ type: "text", text: "ORIGEM: geral\nNOTAS: nenhuma\n\nOk." }] });
  try {
    const r = await worker.fetch(pedido("/pergunta", { pergunta: "x".repeat(15000) }), ambiente(), ctx);
    assert.equal(r.status, 200);
  } finally { repor(); }
});

// ---- O que a calculadora conhece: inventário + crivo do "stock" ----------

const DATA = BASE.replace(/conhecimento\/$/, "data/");
const TILES = [
  { modelo: "YESTECH MG6S P3.91", mw: 500, mh: 500, rx: 128, ry: 128, weight: 6 },
  { modelo: "ROE Black Pearl BP2V2", mw: 500, mh: 500, rx: 176, ry: 176, weight: 9.4, mercado: true },
];
const PROJ = [{ modelo: "Panasonic PT-RZ21K", lumens: 20000, resolucao: { rx: 1920, ry: 1200 } }];

function trocarFetchComInventario(respostaIA, registo = {}) {
  const repor = trocarFetch(respostaIA, registo);
  const anterior = globalThis.fetch;
  globalThis.fetch = async (url, opts) => {
    const u = String(url);
    if (u === DATA + "led-tiles.json") return new Response(JSON.stringify(TILES), { status: 200 });
    if (u === DATA + "projectors.json") return new Response(JSON.stringify(PROJ), { status: 200 });
    return anterior(url, opts);
  };
  return repor;
}

test("inventário vai nas instruções, com posse AVK/MERCADO, e o modo planner A/B/C", async () => {
  const visto = {};
  const repor = trocarFetchComInventario({ content: [{ type: "text", text: "ORIGEM: geral\nNOTAS: nenhuma\n\nOk." }] }, visto);
  try {
    await worker.fetch(pedido("/pergunta", { pergunta: "orçamento para um evento" }), ambiente(), ctx);
    const s = visto.corpo.system;
    assert.match(s, /YESTECH MG6S P3\.91 \| 3\.91 \| 500×500 \| 128×128 \| 6 \| AVK/);
    assert.match(s, /ROE Black Pearl BP2V2 .*\| MERCADO/);
    assert.match(s, /Panasonic PT-RZ21K \| 20000 \| 1920×1200 \| AVK/);
    assert.match(s, /A\) Só com o que é nosso/);
    assert.match(s, /SOLUÇÕES PRÓPRIAS/);
  } finally { repor(); }
});

test("'stock' só quando a resposta nomeia um modelo NOSSO da lista; mercado não conta", async () => {
  const txt = "ORIGEM: geral\nNOTAS: nenhuma\n\nOpção A: YESTECH MG6S P3.91. Opção B: ROE Black Pearl BP2V2 alugado.";
  const repor = trocarFetchComInventario({ content: [{ type: "text", text: txt }] });
  try {
    const r = await worker.fetch(pedido("/pergunta", { pergunta: "LED 6x3" }), ambiente(), ctx);
    const d = await r.json();
    assert.deepEqual(d.origem, ["stock", "geral"]);
    assert.deepEqual(d.equipamento, [{ nome: "YESTECH MG6S P3.91", avk: true }, { nome: "ROE Black Pearl BP2V2", avk: false }]);
  } finally { repor(); }
});

test("só equipamento de mercado nomeado: não há 'stock'", async () => {
  const txt = "ORIGEM: geral\nNOTAS: nenhuma\n\nAluga-se ROE Black Pearl BP2V2.";
  const repor = trocarFetchComInventario({ content: [{ type: "text", text: txt }] });
  try {
    const d = await (await worker.fetch(pedido("/pergunta", { pergunta: "LED" }), ambiente(), ctx)).json();
    assert.deepEqual(d.origem, ["geral"]);
  } finally { repor(); }
});

test("os modelos acrescentados pela pessoa entram limpos e marcados como não confirmados", async () => {
  const visto = {};
  const repor = trocarFetchComInventario({ content: [{ type: "text", text: "ORIGEM: geral\nNOTAS: nenhuma\n\nOk." }] }, visto);
  try {
    const meusModelos = [{ tipo: "tv", modelo: "Xiaomi 55<script>", resumo: "55\"" }, { nada: 1 }];
    await worker.fetch(pedido("/pergunta", { pergunta: "TVs", meusModelos }), ambiente(), ctx);
    assert.match(visto.corpo.system, /não confirmados no inventário\):\n- tv: Xiaomi 55script/);
  } finally { repor(); }
});

test("sem inventário acessível responde na mesma e não afirma stock", async () => {
  const visto = {};
  const repor = trocarFetch({ content: [{ type: "text", text: "ORIGEM: geral\nNOTAS: nenhuma\n\nOk." }] }, visto);
  try {
    const d = await (await worker.fetch(pedido("/pergunta", { pergunta: "x" }), ambiente(), ctx)).json();
    assert.equal(d.ok, true);
    assert.match(visto.corpo.system, /inventário indisponível agora/);
  } finally { repor(); }
});
