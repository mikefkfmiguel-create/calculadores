// Testes do "Mike virtual": o perfil do mike (conhecimento/perfil-mike.md).
//
// O que se protege:
//   · o perfil entra no system de TODAS as perguntas;
//   · o perfil nunca conta como fonte: mesmo que o modelo o nomeie na linha
//     NOTAS, a origem não passa a "notas" (não está no indice.json);
//   · sem perfil (404), a pergunta responde-se na mesma.
//
//   node --test "worker/testes/*.test.mjs"

import { test } from "node:test";
import assert from "node:assert/strict";
import worker from "../src/index.js";
import { PERFIL_FICHEIRO } from "../src/pergunta.js";

const ORIGEM = "https://mikefkfmiguel-create.github.io";
const BASE = "https://notas.teste/conhecimento/";
const PERFIL = "# Como o Mike pensa\n\nO show no ar vem primeiro.";

function kvFalso() {
  const dados = new Map();
  return { dados, async get(k) { return dados.has(k) ? dados.get(k) : null; }, async put(k, v) { dados.set(k, v); } };
}

function ambiente() {
  return { ALLOWED_ORIGINS: ORIGEM, ANTHROPIC_API_KEY: "sk-teste", CONHECIMENTO_URL: BASE, USO: kvFalso(), REGISTOS: kvFalso() };
}

function pedido(corpo) {
  return new Request("https://w.dev/pergunta", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: ORIGEM, "CF-Connecting-IP": "1.2.3.4" },
    body: JSON.stringify(corpo),
  });
}

const ctx = { waitUntil() {} };

function trocarFetch(respostaIA, { comPerfil = true } = {}, visto = {}) {
  const original = globalThis.fetch;
  globalThis.fetch = async (url, opts) => {
    const u = String(url);
    if (u === BASE + "indice.json") return new Response(JSON.stringify({ notas: [] }), { status: 200 });
    if (u === BASE + PERFIL_FICHEIRO) return comPerfil ? new Response(PERFIL, { status: 200 }) : new Response("não", { status: 404 });
    if (u.startsWith("https://api.anthropic.com")) {
      visto.corpo = JSON.parse(opts.body);
      return new Response(JSON.stringify(respostaIA), { status: 200 });
    }
    return new Response("não", { status: 404 });
  };
  return () => { globalThis.fetch = original; };
}

test("o perfil do mike vai no system da pergunta", async () => {
  const visto = {};
  const repor = trocarFetch({ content: [{ type: "text", text: "ORIGEM: geral\nNOTAS: nenhuma\n\nConfirma no equipamento." }] }, {}, visto);
  try {
    const d = await (await worker.fetch(pedido({ pergunta: "Posso mudar o preset a meio?" }), ambiente(), ctx)).json();
    assert.equal(d.ok, true);
    assert.match(visto.corpo.system, /Mike virtual/);
    assert.match(visto.corpo.system, /O show no ar vem primeiro\./);
  } finally { repor(); }
});

test("o perfil não conta como fonte, mesmo nomeado na linha NOTAS", async () => {
  const repor = trocarFetch({ content: [{ type: "text", text: "ORIGEM: notas\nNOTAS: perfil-mike.md\n\nNão mexas com o show no ar." }] });
  try {
    const d = await (await worker.fetch(pedido({ pergunta: "Posso mudar o preset a meio?" }), ambiente(), ctx)).json();
    assert.equal(d.ok, true);
    assert.deepEqual(d.notasUsadas, []);
    assert.ok(!d.origem.includes("notas"));
    assert.ok(d.origem.includes("geral"));
  } finally { repor(); }
});

test("sem perfil publicado, responde na mesma e o system não leva o bloco", async () => {
  const visto = {};
  const repor = trocarFetch({ content: [{ type: "text", text: "ORIGEM: geral\nNOTAS: nenhuma\n\nOk." }] }, { comPerfil: false }, visto);
  try {
    const d = await (await worker.fetch(pedido({ pergunta: "Olá?" }), ambiente(), ctx)).json();
    assert.equal(d.ok, true);
    assert.doesNotMatch(visto.corpo.system, /<perfil>/);
  } finally { repor(); }
});
