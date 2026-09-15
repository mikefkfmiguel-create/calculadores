// Testes do painel de utilização (/uso/painel).
//
// O que mais interessa aqui não é o HTML — é a porta. O token vai no ENDEREÇO
// (um browser não manda cabeçalhos ao abrir um link), e um endereço fica no
// histórico, nos favoritos e em qualquer sítio para onde seja reencaminhado.
// Por isso este painel NÃO pode aceitar o ADMIN_TOKEN: esse abre também o
// /registos, que guarda o texto de briefings reais de clientes.
//
//   node --test "worker/testes/*.test.mjs"

import { test } from "node:test";
import assert from "node:assert/strict";
import worker from "../src/index.js";

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
      return { keys: fatia.map((name) => ({ name })), list_complete: fim >= todas.length, cursor: String(fim) };
    },
  };
}

const SEGREDO_DO_PAINEL = "palavra-so-de-leitura";
const SEGREDO_DE_ADMIN = "abre-tambem-os-registos";

function ambiente(extra = {}) {
  return {
    USO: kvFalso(),
    ALLOWED_ORIGINS: "https://mikefkfmiguel-create.github.io",
    ADMIN_TOKEN: SEGREDO_DE_ADMIN,
    TOKEN_USO: SEGREDO_DO_PAINEL,
    ...extra,
  };
}

const painel = (env, query) =>
  worker.fetch(new Request("https://w.dev/uso/painel" + (query || "")), env);

// Semeia contagens direto na KV, como o /uso as teria escrito.
function semear(env, dias) {
  const hoje = new Date();
  for (const [quantosDiasAtras, lista] of Object.entries(dias)) {
    const d = new Date(hoje.getTime() - Number(quantosDiasAtras) * 864e5).toISOString().slice(0, 10);
    lista.forEach(([app, id, abas]) => {
      env.USO.dados.set(`d:${d}:${app}:${id}`, JSON.stringify({ v: "v3.91", a: abas || [] }));
    });
  }
}

test("sem o token no endereço, não abre", async () => {
  const r = await painel(ambiente());
  assert.equal(r.status, 401);
  assert.match(await r.text(), /Não autorizado/);
});

test("com o token ERRADO, não abre", async () => {
  const r = await painel(ambiente(), "?t=palpite");
  assert.equal(r.status, 401);
});

test("o ADMIN_TOKEN não serve para abrir o painel", async () => {
  // É o teste que interessa: o token que anda no endereço nunca pode ser o
  // que abre os registos dos pedidos ao Assistente.
  const r = await painel(ambiente(), "?t=" + encodeURIComponent(SEGREDO_DE_ADMIN));
  assert.equal(r.status, 401, "o ADMIN_TOKEN não pode abrir uma porta que vive num link");
});

test("sem TOKEN_USO definido, não se desenrasca — diz o que falta", async () => {
  const env = ambiente({ TOKEN_USO: undefined });
  const r = await painel(env, "?t=" + encodeURIComponent(SEGREDO_DE_ADMIN));
  assert.equal(r.status, 503);
  const html = await r.text();
  assert.match(html, /wrangler secret put TOKEN_USO/);
});

test("com o token certo, mostra os números certos", async () => {
  const env = ambiente();
  semear(env, {
    0: [["calculadores", "aaa", ["menu", "dome"]], ["calculadores", "bbb", ["menu"]]],
    1: [["calculadores", "aaa", ["led"]], ["preview", "ccc", []]],
  });
  const r = await painel(env, "?t=" + encodeURIComponent(SEGREDO_DO_PAINEL));
  assert.equal(r.status, 200);
  assert.match(r.headers.get("Content-Type") || "", /text\/html/);
  const html = await r.text();

  // aaa aparece em dois dias mas é UM aparelho; bbb é outro => 2.
  assert.match(html, /<b>2<\/b><span>calculadores<\/span>/);
  assert.match(html, /<b>1<\/b><span>preview<\/span>/);
  // "menu" foi aberto por dois aparelhos, "dome" por um.
  assert.match(html, /menu<\/span>[\s\S]{0,200}?>2</);
  assert.match(html, /dome<\/span>[\s\S]{0,200}?>1</);
});

test("o painel não é indexável nem guardado em cache", async () => {
  // O endereço leva um segredo lá dentro.
  const r = await painel(ambiente(), "?t=" + encodeURIComponent(SEGREDO_DO_PAINEL));
  assert.match(r.headers.get("X-Robots-Tag") || "", /noindex/);
  assert.match(r.headers.get("Cache-Control") || "", /no-store/);
  assert.equal(r.headers.get("Referrer-Policy"), "no-referrer");
});

test("sem nada contado, diz porquê em vez de mostrar uma página vazia", async () => {
  const r = await painel(ambiente(), "?t=" + encodeURIComponent(SEGREDO_DO_PAINEL));
  const html = await r.text();
  assert.match(html, /<b>0<\/b>/);
  assert.match(html, /Ainda não chegou nada/);
});

test("o período pedido é respeitado e limitado", async () => {
  const env = ambiente();
  semear(env, { 40: [["calculadores", "antigo", ["menu"]]] });

  const sete = await (await painel(env, "?t=" + encodeURIComponent(SEGREDO_DO_PAINEL) + "&dias=7")).text();
  assert.match(sete, /<b>0<\/b>/, "um aparelho de há 40 dias não pode aparecer em 7 dias");

  const noventa = await (await painel(env, "?t=" + encodeURIComponent(SEGREDO_DO_PAINEL) + "&dias=90")).text();
  assert.match(noventa, /<b>1<\/b><span>calculadores<\/span>/);

  // Um pedido absurdo não varre a KV inteira.
  const absurdo = await painel(env, "?t=" + encodeURIComponent(SEGREDO_DO_PAINEL) + "&dias=9999");
  assert.equal(absurdo.status, 200);
  assert.match(await absurdo.text(), /· 90 dias/);
});

test("o /uso/resumo continua a pedir o cabeçalho, e não aceita o token do painel", async () => {
  const env = ambiente();
  const comTokenDoPainel = await worker.fetch(
    new Request("https://w.dev/uso/resumo", { headers: { Authorization: "Bearer " + SEGREDO_DO_PAINEL } }), env);
  assert.equal(comTokenDoPainel.status, 401, "as duas portas têm chaves diferentes, nos dois sentidos");

  const comAdmin = await worker.fetch(
    new Request("https://w.dev/uso/resumo", { headers: { Authorization: "Bearer " + SEGREDO_DE_ADMIN } }), env);
  assert.equal(comAdmin.status, 200);
});

test("um nome de app estranho não consegue injectar HTML", async () => {
  const env = ambiente();
  env.USO.dados.set(
    `d:${new Date().toISOString().slice(0, 10)}:<img src=x onerror=alert(1)>:zzz`,
    JSON.stringify({ v: "v1", a: [] }));
  const html = await (await painel(env, "?t=" + encodeURIComponent(SEGREDO_DO_PAINEL))).text();
  assert.ok(!html.includes("<img src=x"), "tem de sair escapado");
  assert.match(html, /&lt;img/);
});
