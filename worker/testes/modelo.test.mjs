// Testes da rota /modelo — a procura na web de uma ficha técnica.
//
// Pedido: *"se escrever «xiripiti» no campo da marca e a lista devolver «não
// encontrado», dispara procura na web/mercado para adicionar
// automaticamente"*.
//
// O que se está a proteger é a regra da casa: *"nunca inventar dados
// técnicos — só valores reais, com fonte"*. Uma procura na web devolve o que
// o modelo escrever, e o que ele escreve pode ser de cabeça. O crivo desta
// rota é o que separa uma ficha de um palpite:
//
//   · a fonte tem de ser uma das páginas que a PESQUISA devolveu;
//   · a diagonal tem de ser de um ecrã;
//   · e sem isso a resposta é "não encontrei", nunca um número.
//
//   node --test "worker/testes/*.test.mjs"
//
// A chamada à Anthropic é interceptada (fetch trocado): nenhum destes testes
// gasta um cêntimo nem precisa de chave nenhuma.

import { test } from "node:test";
import assert from "node:assert/strict";
import worker from "../src/index.js";

const ORIGEM = "https://mikefkfmiguel-create.github.io";

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
    USO: kvFalso(),
    ...extra,
  };
}

function pedido(q = "xiripiti 55") {
  return new Request("https://w.dev/modelo", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: ORIGEM, "CF-Connecting-IP": "1.2.3.4" },
    body: JSON.stringify({ q, tipo: "tv" }),
  });
}

const ctx = { waitUntil() {} };

// A forma real de uma resposta com web_search: blocos de resultado da
// ferramenta (de onde saem os endereços que a pesquisa viu mesmo) e o texto
// do modelo.
function respostaDaAnthropic({ paginas = [], texto = "" } = {}) {
  const content = [];
  if (paginas.length) {
    content.push({
      type: "web_search_tool_result",
      content: paginas.map((u) => ({ type: "web_search_result", url: u, title: "t" })),
    });
  }
  content.push({ type: "text", text: texto });
  return new Response(JSON.stringify({ content }), {
    status: 200, headers: { "Content-Type": "application/json" },
  });
}

async function comFetch(resposta, fn) {
  const original = globalThis.fetch;
  globalThis.fetch = async () => resposta;
  try { return await fn(); } finally { globalThis.fetch = original; }
}

test("uma ficha com fonte que a pesquisa devolveu passa", async () => {
  const r = await comFetch(respostaDaAnthropic({
    paginas: ["https://www.xiripiti.com/tv/a55", "https://loja.pt/xiripiti"],
    texto: JSON.stringify({
      encontrado: true, modelo: "Xiripiti A55", diag: 55, ratio: "16:9",
      resolucao: { rx: 3840, ry: 2160 }, touchscreen: false,
      fonte: "https://www.xiripiti.com/tv/a55",
    }),
  }), () => worker.fetch(pedido(), ambiente(), ctx));

  const d = await r.json();
  assert.equal(d.ok, true);
  assert.equal(d.modelo.modelo, "Xiripiti A55");
  assert.equal(d.modelo.diag, 55);
  assert.deepEqual(d.modelo.resolucao, { rx: 3840, ry: 2160 });
  assert.match(d.modelo.fonte, /xiripiti\.com/);
});

test("uma fonte que a pesquisa NUNCA devolveu é recusada", async () => {
  // O caso que isto apanha: números com ar de certos e um endereço escrito
  // de cabeça. É o defeito mais caro possível aqui, porque parece bem.
  const r = await comFetch(respostaDaAnthropic({
    paginas: ["https://loja.pt/outra-coisa"],
    texto: JSON.stringify({
      encontrado: true, modelo: "Xiripiti A55", diag: 55, ratio: "16:9",
      resolucao: { rx: 3840, ry: 2160 }, fonte: "https://www.xiripiti.com/ficha",
    }),
  }), () => worker.fetch(pedido(), ambiente(), ctx));

  const d = await r.json();
  assert.equal(d.ok, false);
  assert.match(d.motivo, /sem fonte/i);
});

test("sem pesquisa nenhuma (respondeu de memória) é recusado", async () => {
  const r = await comFetch(respostaDaAnthropic({
    paginas: [],
    texto: JSON.stringify({ encontrado: true, modelo: "X", diag: 55, fonte: "https://x.pt" }),
  }), () => worker.fetch(pedido(), ambiente(), ctx));
  const d = await r.json();
  assert.equal(d.ok, false);
});

test("uma diagonal que não é de um ecrã é recusada", async () => {
  const r = await comFetch(respostaDaAnthropic({
    paginas: ["https://www.xiripiti.com/tv"],
    texto: JSON.stringify({ encontrado: true, modelo: "X", diag: 550, fonte: "https://www.xiripiti.com/tv" }),
  }), () => worker.fetch(pedido(), ambiente(), ctx));
  const d = await r.json();
  assert.equal(d.ok, false);
  assert.match(d.motivo, /diagonal/i);
});

test("não encontrado devolve-se como não encontrado, não como nada", async () => {
  const r = await comFetch(respostaDaAnthropic({
    paginas: ["https://loja.pt/nada"],
    texto: JSON.stringify({ encontrado: false }),
  }), () => worker.fetch(pedido("xiripiti"), ambiente(), ctx));
  const d = await r.json();
  assert.equal(d.ok, false);
  assert.match(d.motivo, /não encontrei/i);
});

test("um erro da ferramenta de pesquisa não rebenta a rota", async () => {
  // Os erros das ferramentas do servidor vêm com HTTP 200 e um OBJECTO no
  // lugar da lista de resultados. Sem o teste de Array.isArray, isto era uma
  // excepção calada dentro do Worker.
  const r = await comFetch(new Response(JSON.stringify({
    content: [
      { type: "web_search_tool_result", content: { error_code: "max_uses_exceeded" } },
      { type: "text", text: JSON.stringify({ encontrado: true, diag: 55, fonte: "https://x.pt" }) },
    ],
  }), { status: 200 }), () => worker.fetch(pedido(), ambiente(), ctx));
  const d = await r.json();
  assert.equal(d.ok, false);
});

test("a resolução só entra se vierem os dois lados", async () => {
  const r = await comFetch(respostaDaAnthropic({
    paginas: ["https://www.xiripiti.com/tv"],
    texto: JSON.stringify({
      encontrado: true, modelo: "X", diag: 55, ratio: "16:9",
      resolucao: { rx: 3840, ry: 0 }, fonte: "https://www.xiripiti.com/tv",
    }),
  }), () => worker.fetch(pedido(), ambiente(), ctx));
  const d = await r.json();
  assert.equal(d.ok, true);
  assert.equal(d.modelo.resolucao, null);
});

test("um rácio inventado cai no 16:9 em vez de entrar", async () => {
  const r = await comFetch(respostaDaAnthropic({
    paginas: ["https://www.xiripiti.com/tv"],
    texto: JSON.stringify({
      encontrado: true, modelo: "X", diag: 55, ratio: "3:1",
      fonte: "https://www.xiripiti.com/tv",
    }),
  }), () => worker.fetch(pedido(), ambiente(), ctx));
  const d = await r.json();
  assert.equal(d.modelo.ratio, "16:9");
});

test("a trava de gasto vale para esta rota como vale para o Assistente", async () => {
  const env = ambiente();
  const dia = new Date().toISOString().slice(0, 10);
  await env.USO.put("lim:dia:" + dia, "200");     // o limite por omissão
  const r = await comFetch(respostaDaAnthropic({ paginas: [], texto: "{}" }),
    () => worker.fetch(pedido(), env, ctx));
  assert.equal(r.status, 429);
});

test("outra origem não chega sequer à pesquisa", async () => {
  const r = await worker.fetch(new Request("https://w.dev/modelo", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "https://outro.site" },
    body: JSON.stringify({ q: "xiripiti 55", tipo: "tv" }),
  }), ambiente(), ctx);
  assert.equal(r.status, 403);
});
