// Testes da contagem de utilização (/uso e /uso/resumo).
//
// São os primeiros testes automáticos deste projeto. A razão de existirem
// agora e não antes: o Worker da contagem não se pode experimentar no browser
// como o resto — só se sabe se funciona depois de publicado, e publicado já é
// tarde. Um KV falso aqui em baixo resolve isso sem conta nenhuma na nuvem.
//
// Como se corre, sem instalar nada:
//
//   node --test "worker/testes/*.test.mjs"
//
// (a partir da raiz do repositório; precisa de Node 18+ pelos globais Request
// e Response, que o Worker também usa. As aspas são precisas — sem elas é a
// shell a expandir o padrão, e a forma "worker/testes/" sozinha não serve.)
//
// O Node avisa que o worker/package.json não declara "type": "module". É só
// um aviso: ele reparsa o ficheiro como ES module e os testes correm na
// mesma. Não se acrescentou o "type" para não mexer no caminho da publicação
// do Worker, que não se pode experimentar daqui.

import { test } from "node:test";
import assert from "node:assert/strict";
import worker from "../src/index.js";

// ---- Um KV a fingir, com o pouco que o Worker lhe pede ----
function kvFalso() {
  const dados = new Map();
  return {
    dados,
    async get(k) { return dados.has(k) ? dados.get(k) : null; },
    async put(k, v) { dados.set(k, v); },
    async list({ prefix = "", limit = 1000, cursor } = {}) {
      const todas = [...dados.keys()].filter((k) => k.startsWith(prefix)).sort();
      const inicio = cursor ? parseInt(cursor, 10) : 0;
      const fatia = todas.slice(inicio, inicio + limit);
      const fim = inicio + fatia.length;
      return {
        keys: fatia.map((name) => ({ name })),
        list_complete: fim >= todas.length,
        cursor: String(fim),
      };
    },
  };
}

const ORIGEM = "https://mikefkfmiguel-create.github.io";
function ambiente(extra = {}) {
  return { USO: kvFalso(), ALLOWED_ORIGINS: ORIGEM, ADMIN_TOKEN: "segredo-de-teste", ...extra };
}
function pedidoUso(corpo, env) {
  return worker.fetch(
    new Request("https://w.dev/uso", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: ORIGEM },
      body: typeof corpo === "string" ? corpo : JSON.stringify(corpo),
    }),
    env
  );
}
const UM_ID = "0f9b1d2e-3a4b-4c5d-8e6f-7a8b9c0d1e2f";
const OUTRO_ID = "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d";

test("uma contagem válida fica guardada, com a data do servidor na chave", async () => {
  const env = ambiente();
  const r = await pedidoUso({ app: "calculadores", id: UM_ID, versao: "v3.91", abas: ["menu", "led"] }, env);
  assert.equal(r.status, 200);

  const chaves = [...env.USO.dados.keys()];
  assert.equal(chaves.length, 1);
  const hoje = new Date().toISOString().slice(0, 10);
  assert.equal(chaves[0], `d:${hoje}:calculadores:${UM_ID}`);
  assert.deepEqual(JSON.parse(env.USO.dados.get(chaves[0])), { v: "v3.91", a: ["menu", "led"] });
});

test("o mesmo aparelho duas vezes no mesmo dia é UMA linha, e as abas somam-se", async () => {
  const env = ambiente();
  await pedidoUso({ app: "calculadores", id: UM_ID, abas: ["menu"] }, env);
  await pedidoUso({ app: "calculadores", id: UM_ID, abas: ["dome"] }, env);

  assert.equal(env.USO.dados.size, 1, "duas chamadas do mesmo aparelho não podem dar duas linhas");
  const guardado = JSON.parse([...env.USO.dados.values()][0]);
  assert.deepEqual(guardado.a.sort(), ["dome", "menu"], "a manhã não se pode perder à tarde");
});

test("o que não encaixa é recusado com a razão, e nada fica guardado", async () => {
  const env = ambiente();
  const casos = [
    [{ app: "outra-coisa", id: UM_ID }, "app"],
    [{ app: "calculadores", id: "nao-sou-um-uuid" }, "id"],
    ["isto não é JSON", "JSON"],
  ];
  for (const [corpo, pedaco] of casos) {
    const r = await pedidoUso(corpo, env);
    assert.equal(r.status, 400, `${JSON.stringify(corpo)} devia dar 400`);
    const { error } = await r.json();
    assert.match(error, new RegExp(pedaco, "i"));
  }
  assert.equal(env.USO.dados.size, 0);
});

test("uma aba inventada é deitada fora, e o resto do pedido aproveita-se", async () => {
  const env = ambiente();
  await pedidoUso({ app: "calculadores", id: UM_ID, abas: ["led", "aba-que-nao-existe", "dome"] }, env);
  const guardado = JSON.parse([...env.USO.dados.values()][0]);
  assert.deepEqual(guardado.a, ["led", "dome"]);
});

test("uma versão forjada não passa para o armazenamento", async () => {
  const env = ambiente();
  await pedidoUso({ app: "calculadores", id: UM_ID, versao: "<script>alert(1)</script>" }, env);
  const guardado = JSON.parse([...env.USO.dados.values()][0]);
  assert.equal(guardado.v, "");
});

test("o resumo conta aparelhos distintos, não chamadas", async () => {
  const env = ambiente();
  await pedidoUso({ app: "calculadores", id: UM_ID, abas: ["dome"] }, env);
  await pedidoUso({ app: "calculadores", id: UM_ID, abas: ["led"] }, env);
  await pedidoUso({ app: "calculadores", id: OUTRO_ID, abas: ["dome"] }, env);
  await pedidoUso({ app: "preview", id: OUTRO_ID }, env);

  const r = await worker.fetch(
    new Request("https://w.dev/uso/resumo?dias=7&abas=1", {
      headers: { Authorization: "Bearer segredo-de-teste" },
    }),
    env
  );
  assert.equal(r.status, 200);
  const resumo = await r.json();
  assert.equal(resumo.aparelhos.calculadores, 2, "três chamadas de dois aparelhos são dois");
  assert.equal(resumo.aparelhos.preview, 1);
  assert.equal(resumo.abas.dome, 2, "o Dome foi aberto em dois aparelhos");
  assert.equal(resumo.abas.led, 1);
});

test("o resumo sem token não diz nada", async () => {
  const env = ambiente();
  await pedidoUso({ app: "calculadores", id: UM_ID }, env);

  const semNada = await worker.fetch(new Request("https://w.dev/uso/resumo"), env);
  assert.equal(semNada.status, 401);

  const comOTokenErrado = await worker.fetch(
    new Request("https://w.dev/uso/resumo", { headers: { Authorization: "Bearer outro" } }),
    env
  );
  assert.equal(comOTokenErrado.status, 401);
});

test("uma origem estranha não consegue contar", async () => {
  const env = ambiente();
  const r = await worker.fetch(
    new Request("https://w.dev/uso", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "https://outro-sitio.example" },
      body: JSON.stringify({ app: "calculadores", id: UM_ID }),
    }),
    env
  );
  assert.equal(r.status, 403);
  assert.equal(env.USO.dados.size, 0);
});

test("sem KV configurada, diz-o em vez de fingir que contou", async () => {
  const env = ambiente({ USO: undefined });
  const r = await pedidoUso({ app: "calculadores", id: UM_ID }, env);
  assert.equal(r.status, 500);
  const { error } = await r.json();
  assert.match(error, /KV USO/);
});
