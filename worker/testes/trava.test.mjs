// Testes da trava de gasto da IA.
//
// O que se está a proteger: o endereço deste Worker está publicado no
// index.html que o GitHub Pages serve, e o ALLOWED_ORIGINS não impede um
// script (o Origin é um cabeçalho do pedido; um curl escreve lá o que quer).
// Os limites que já existiam são de TAMANHO por pedido, não de NÚMERO de
// pedidos — mil pedidos pequenos passavam todos, e cada um gasta da conta.
//
//   node --test "worker/testes/*.test.mjs"
//
// A chamada à Anthropic é interceptada aqui (fetch trocado), por isso nenhum
// destes testes gasta um cêntimo nem precisa de chave nenhuma.

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

const ORIGEM = "https://mikefkfmiguel-create.github.io";

// Uma resposta da Anthropic que o Worker aceita: tem de trazer um tool_use
// com o input, que é o que ele devolve como `requisitos`.
function respostaFalsaDaAnthropic() {
  return new Response(JSON.stringify({
    content: [{ type: "tool_use", name: "extrair_requisitos_projeto", input: { tipoEcra: "desconhecido" } }],
  }), { status: 200, headers: { "Content-Type": "application/json" } });
}

function ambiente(extra = {}) {
  return {
    USO: kvFalso(),
    ALLOWED_ORIGINS: ORIGEM,
    ANTHROPIC_API_KEY: "chave-de-teste",
    ...extra,
  };
}

function pedidoIA(env, ip = "1.2.3.4") {
  return worker.fetch(
    new Request("https://w.dev/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: ORIGEM,
        "CF-Connecting-IP": ip,
      },
      body: JSON.stringify({ text: "Um evento para 300 pessoas numa sala de 20 por 15 metros." }),
    }),
    env
  );
}

// Corre `fn` com o fetch global trocado, e conta quantas vezes a Anthropic
// foi mesmo chamada — que é a única medida que interessa aqui.
async function comAnthropicFalsa(fn) {
  const original = globalThis.fetch;
  let chamadas = 0;
  globalThis.fetch = async (url) => {
    if (String(url).includes("api.anthropic.com")) { chamadas++; return respostaFalsaDaAnthropic(); }
    return original(url);
  };
  try { return { resultado: await fn(), chamadas: () => chamadas }; }
  finally { globalThis.fetch = original; }
}

test("abaixo do limite, o pedido passa e a Anthropic é chamada", async () => {
  const env = ambiente({ LIMITE_IA_POR_IP: "3", LIMITE_IA_POR_DIA: "100" });
  const { resultado, chamadas } = await comAnthropicFalsa(() => pedidoIA(env));
  assert.equal(resultado.status, 200);
  assert.equal(chamadas(), 1);
});

test("passado o limite POR IP, trava — e a Anthropic deixa de ser chamada", async () => {
  const env = ambiente({ LIMITE_IA_POR_IP: "3", LIMITE_IA_POR_DIA: "100" });
  const { chamadas } = await comAnthropicFalsa(async () => {
    for (let i = 0; i < 3; i++) assert.equal((await pedidoIA(env)).status, 200);
    const quarto = await pedidoIA(env);
    assert.equal(quarto.status, 429);
    const { error } = await quarto.json();
    assert.match(error, /desta liga/i, "a mensagem tem de dizer que é desta ligação");
    assert.match(error, /3/);
  });
  assert.equal(chamadas(), 3, "o 4º pedido não pode ter chegado à API");
});

test("outro endereço tem a sua própria conta", async () => {
  const env = ambiente({ LIMITE_IA_POR_IP: "2", LIMITE_IA_POR_DIA: "100" });
  await comAnthropicFalsa(async () => {
    await pedidoIA(env, "1.1.1.1");
    await pedidoIA(env, "1.1.1.1");
    assert.equal((await pedidoIA(env, "1.1.1.1")).status, 429, "o primeiro IP esgotou");
    assert.equal((await pedidoIA(env, "2.2.2.2")).status, 200, "o segundo não pode ser afectado");
  });
});

test("o TOTAL DO DIA trava toda a gente, mesmo com IPs diferentes", async () => {
  // É esta a trava que protege a factura: quem tem muitos endereços contorna
  // a de cima, mas não esta.
  const env = ambiente({ LIMITE_IA_POR_IP: "100", LIMITE_IA_POR_DIA: "3" });
  const { chamadas } = await comAnthropicFalsa(async () => {
    for (let i = 0; i < 3; i++) {
      assert.equal((await pedidoIA(env, "10.0.0." + i)).status, 200);
    }
    const quarto = await pedidoIA(env, "10.0.0.99");
    assert.equal(quarto.status, 429);
    const { error } = await quarto.json();
    assert.match(error, /limite de pedidos de hoje/i);
  });
  assert.equal(chamadas(), 3);
});

test("um pedido malformado não consome a quota de ninguém", async () => {
  const env = ambiente({ LIMITE_IA_POR_IP: "2", LIMITE_IA_POR_DIA: "100" });
  await comAnthropicFalsa(async () => {
    // Sem texto nem ficheiro: é recusado antes de chegar à trava.
    const vazio = await worker.fetch(new Request("https://w.dev/", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: ORIGEM, "CF-Connecting-IP": "9.9.9.9" },
      body: JSON.stringify({ text: "" }),
    }), env);
    assert.equal(vazio.status, 400);
    // E a quota ficou intacta: dois pedidos bons ainda passam.
    assert.equal((await pedidoIA(env, "9.9.9.9")).status, 200);
    assert.equal((await pedidoIA(env, "9.9.9.9")).status, 200);
  });
  const contadores = [...env.USO.dados.keys()].filter((k) => k.startsWith("lim:"));
  assert.equal(contadores.length, 2, "um contador por IP e um do dia, e nada mais");
});

test("a contagem de VISITAS não leva trava nenhuma", async () => {
  // A rota /uso não fala com a Anthropic e não custa nada por chamada -- não
  // tem nada que ver com isto, e não pode ficar presa pelos mesmos limites.
  const env = ambiente({ LIMITE_IA_POR_IP: "1", LIMITE_IA_POR_DIA: "1" });
  for (let i = 0; i < 5; i++) {
    const r = await worker.fetch(new Request("https://w.dev/uso", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: ORIGEM, "CF-Connecting-IP": "3.3.3.3" },
      body: JSON.stringify({ app: "calculadores", id: "0f9b1d2e-3a4b-4c5d-8e6f-7a8b9c0d1e2f", abas: ["menu"] }),
    }), env);
    assert.equal(r.status, 200, "a contagem de visitas nunca pode ser travada");
  }
});

test("sem KV configurada, o Assistente continua a responder", async () => {
  // Um Worker mal configurado deixar de responder seria pior do que o risco
  // que a trava cobre. Falha aberta, de propósito.
  const env = ambiente({ USO: undefined });
  const { resultado, chamadas } = await comAnthropicFalsa(() => pedidoIA(env));
  assert.equal(resultado.status, 200);
  assert.equal(chamadas(), 1);
});

test("os limites por omissão valem quando as variáveis não estão definidas", async () => {
  const env = ambiente();   // sem LIMITE_IA_*
  await comAnthropicFalsa(async () => {
    assert.equal((await pedidoIA(env, "4.4.4.4")).status, 200);
  });
  const dia = new Date().toISOString().slice(0, 10);
  assert.equal(env.USO.dados.get("lim:ip:" + dia + ":4.4.4.4"), "1");
  assert.equal(env.USO.dados.get("lim:dia:" + dia), "1");
});
