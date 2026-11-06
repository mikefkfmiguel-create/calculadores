// Verificação das configurações PixelHue (data/pixelhue-configuracoes.json + js/pixelhue-config.js).
//
//   node --test scripts/verificar-pixelhue-config.mjs
//
// Só precisa do node. A conta do pixel clock (CVT-RB2) é LIDA do index.html tal como lá está.
// As referências «à mão» (a conta à vista) são números das fichas da PixelHue, lidos em 2026-11-06:
//   P20 / P20-DS: saída HDMI 2.0 até 4096×2160@60 (página do P20); 2 saídas 4K (tabela comparativa);
//   P80: Copy = 4 principais 4K + 4 flex; Split = 8 DL principais + 4 flex (página da P80);
//   Q8: 4 cartões de saída, 4 saídas 4K por cartão, 16 no máximo (página do Q8);
//   Lumina: LU_20×RJ45 13 000 000 px / 20 portas = 650 000 px por porta; LU_16×RJ45+2×OPT 10 400 000 / 16 = 650 000;
//           LU_4×OPT 20 800 000 px / 4 portas = 5 200 000 (= 8 portas Ethernet de 650 000) (páginas proav.pixelhue.com).

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const html = readFileSync(path.join(raiz, "index.html"), "utf8");
const utils = readFileSync(path.join(raiz, "js/utils.js"), "utf8");
const proc = JSON.parse(readFileSync(path.join(raiz, "data/processors.json"), "utf8"));
const cfg = JSON.parse(readFileSync(path.join(raiz, "data/pixelhue-configuracoes.json"), "utf8"));

function extrair(fonte, nome) {
  const ini = fonte.indexOf("function " + nome + "(");
  assert.ok(ini >= 0, "função não encontrada: " + nome);
  let i = fonte.indexOf("{", ini), prof = 0;
  for (; i < fonte.length; i++) {
    if (fonte[i] === "{") prof++;
    else if (fonte[i] === "}" && --prof === 0) { i++; break; }
  }
  return fonte.slice(ini, i);
}
const margem = parseFloat(html.match(/var SWITCHER_SAFETY_MARGIN = ([0-9.]+);/)[1]);
const base = new Function(
  extrair(utils, "roundUpEven") + "\n" + extrair(html, "cvtRb2ClockMHz") + "\n" +
  extrair(html, "splitCanvasForClock") + "\n" + extrair(html, "splitCanvasForCapacity") + "\n" +
  extrair(html, "switcherAdvancedCap") + "\n" +
  "return { roundUpEven, cvtRb2ClockMHz, splitCanvasForClock, splitCanvasForCapacity, switcherAdvancedCap };"
)();
const require = createRequire(import.meta.url);
const PHC = require(path.join(raiz, "js/pixelhue-config.js")).criar({ cvt: base.cvtRb2ClockMHz });
PHC.definir(cfg);
const S = require(path.join(raiz, "js/saidas-switcher.js")).criar({ ...base, margem });

const sw = (m) => proc.switchers.find((s) => s.marca === "PixelHUE" && s.modelo === m);
const led = (m) => proc.ledProcessors.find((s) => s.marca === "PixelHUE" && s.modelo === m);
const M = (m) => PHC.modeloDe(sw(m));
const px4k = 4096 * 2160;
const aprox = (a, b, tol = 1e-6) => assert.ok(Math.abs(a - b) <= tol, a + " != " + b);

// ------------------------------------------------------------ fontes
test("cada valor tem fonte (URL) e a data da consulta; o que falta diz-se em `sem_dados`", () => {
  assert.equal(cfg.consultado, "2026-11-06");
  const url = (x, onde) => assert.match(x || "", /^https:\/\//, onde + ": falta a fonte");
  cfg.modelos.forEach((m) => {
    url(m.fonte, m.modelo);
    assert.equal(m.consultado, "2026-11-06", m.modelo + ": data da consulta");
    assert.ok(Array.isArray(m.sem_dados) && m.sem_dados.length, m.modelo + ": diz o que falta");
    assert.equal(m.sem_dados_en.length, m.sem_dados.length, m.modelo + ": o que falta, também em EN");
    (m.configuracoes || []).forEach((c) => {
      if (c.porSaida) url(c.porSaida.fonte, m.modelo + "/" + c.id + "/porSaida");
      if (c.saidas != null) url(c.saidas_fonte, m.modelo + "/" + c.id + "/saidas");
      if (c.optica) url(c.optica.fonte, m.modelo + "/" + c.id + "/optica");
    });
    (m.cartoes || []).forEach((c) => {
      url(c.fonte, m.modelo + "/" + c.id);
      url(c.porSaida.fonte, m.modelo + "/" + c.id + "/porSaida");
      if (c.optica) url(c.optica.fonte, m.modelo + "/" + c.id + "/optica");
    });
    (m.cartoes_entrada || []).forEach((c) => url(c.fonte, m.modelo + "/entrada/" + c.id));
  });
  cfg.lumina.chassis.forEach((c) => { url(c.fonte, c.nome); assert.equal(c.ranhuras, null, c.nome + ": sem dados, não inventado"); assert.ok(c.sem_dados.length); });
  cfg.lumina.cartoes.forEach((c) => { url(c.fonte, c.id); assert.equal(c.consultado, "2026-11-06"); });
  assert.deepEqual(PHC.valoresSemFonte(), []);
  // confianca é sempre dita
  const conf = (o) => assert.ok(["fabricante", "indicativo"].includes(o.confianca), JSON.stringify(o).slice(0, 80));
  cfg.modelos.forEach((m) => { conf(m); (m.configuracoes || []).forEach((c) => c.porSaida && conf(c.porSaida)); (m.cartoes || []).forEach((c) => { conf(c); conf(c.porSaida); }); });
});

// ------------------------------------------------------------ valores com a conta à vista
test("P20 e P20-DS: 2 saídas HDMI 2.0, 4096×2160@60 -> pixel clock CVT-RB2", () => {
  for (const nome of ["P20", "P20-DS"]) {
    const { s, info } = PHC.efetivo(sw(nome), M(nome), null);
    assert.equal(s.outputs, 2);
    aprox(s.maxPixelClockMHz, base.cvtRb2ClockMHz(4096, 2160, 60));
    aprox(s.maxPixelClockMHz, 556.744, 0.001);                     // a conta à vista: 4096×2160@60 em CVT-RB2
    assert.equal(info.porSaida.w * info.porSaida.h, px4k);
    // o que está em processors.json é o mesmo, arredondado a 0,1 MHz
    aprox(sw(nome).maxPixelClockMHz, s.maxPixelClockMHz, 0.1);
    assert.equal(sw(nome).outputs, s.outputs);
  }
});

test("P10: saídas HDMI 1.3 de 2048×1080@60; o nº de saídas é «sem dados» (não gera número)", () => {
  const { s, info } = PHC.efetivo(sw("P10"), M("P10"), null);
  assert.equal(s.outputs, undefined);
  aprox(s.maxPixelClockMHz, base.cvtRb2ClockMHz(2048, 1080, 60));
  aprox(sw("P10").maxPixelClockMHz, s.maxPixelClockMHz, 0.1);
  assert.ok(info.semDados.some((t) => /Nº de saídas HDMI 1\.3/.test(t.pt) && /Number of HDMI 1\.3 outputs/.test(t.en)));
  assert.ok(info.avisos.some((a) => /8,3 MP/.test(a.pt) && /8\.3 MP/.test(a.en)), "avisa que a capacidade guardada não bate com a ficha");
  // sem N: sem dados; com N: só com N indicado
  const sinal = { h: 1920, v: 1080, fps: 60 };
  assert.equal(S.avaliar(s, sinal, {}).semDados, true);
  const av = S.avaliar(s, sinal, { n: 2 });
  assert.equal(av.semDados, undefined);
  assert.equal(av.estimado, false);
});

test("P80: Split 12 saídas (8 DL + 4 flex) com DL = 4096×1080@60; Copy 8 saídas (4 + 4) a 4096×2160@60", () => {
  const split = PHC.efetivo(sw("P80"), M("P80"), { id: "split" }), copy = PHC.efetivo(sw("P80"), M("P80"), { id: "copy" });
  assert.equal(split.s.outputs, 12); assert.equal(copy.s.outputs, 8);
  aprox(split.s.maxPixelClockMHz, base.cvtRb2ClockMHz(4096, 1080, 60));
  aprox(split.s.maxPixelClockMHz, 278.372, 0.001);
  aprox(copy.s.maxPixelClockMHz, 556.744, 0.001);
  assert.equal(split.info.porSaida.derivado, true, "o DL do Split é derivado e fica dito");
  assert.equal(split.info.porSaida.confianca, "indicativo");
  assert.equal(split.s.outputModes, undefined);
  // os modos que já estavam em processors.json têm as mesmas saídas
  sw("P80").outputModes.forEach((m, i) => assert.equal(m.outputs, [12, 8][i]));
  // as capacidades guardadas ficam como estavam (a ficha não as publica)
  assert.equal(split.s.maxMPSwitcher, 35);
  // variantes: as duas configurações
  assert.equal(PHC.variantes(sw("P80"), M("P80"), null).length, 2);
});

test("Q8: cartões de saída × quantidade -> 4 saídas por cartão, 16 no máximo; capacidade derivada = saídas × 4096×2160", () => {
  const q8 = sw("Q8"), m = M("Q8");
  for (const [qtd, saidas] of [[1, 4], [2, 8], [3, 12], [4, 16]]) {
    const { s, info } = PHC.efetivo(q8, m, { id: "c:hdmi-sdi-fibra:" + qtd });
    assert.equal(s.outputs, saidas, qtd + " cartão(ões)");
    aprox(s.maxMPSwitcher, (saidas * px4k) / 1e6);           // 4 × 8 847 360 = 35,39 MP; 16 × 8 847 360 = 141,56 MP
    aprox(s.maxPixelClockMHz, 556.744, 0.001);
    assert.equal(s.maxMPPgmOnly, undefined);
    assert.equal(info.avisos.length, 0);
  }
  // o que está em processors.json é a configuração máxima (4 cartões)
  assert.equal(q8.outputs, 16); aprox(q8.maxMPSwitcher, (16 * px4k) / 1e6, 0.05);
  aprox(q8.maxPixelClockMHz, 556.744, 0.1);
  // cartão com DP: 10 bits
  const dp = PHC.efetivo(q8, m, { id: "c:hdmi-dp-sfp:2" });
  assert.equal(dp.s.outputs, 8); assert.equal(dp.info.porSaida.bits, 10);
  // à mão: 2 + 1 cartões de tipos diferentes = 12 saídas, com aviso de mistura (sem dados sobre misturar)
  const mix = PHC.efetivo(q8, m, { id: "manual", qtd: { "hdmi-sdi-fibra": 2, "hdmi-dp-sfp": 1 } });
  assert.equal(mix.s.outputs, 12);
  assert.ok(mix.info.avisos.some((a) => /misturar/.test(a.pt)));
  // mais do que o máximo publicado (4): avisa e usa 4
  const exc = PHC.efetivo(q8, m, { id: "manual", qtd: { "hdmi-sdi-fibra": 3, "hdmi-dp-sfp": 3 } });
  assert.equal(exc.s.outputs, 16);
  assert.ok(exc.info.avisos.some((a) => /excedem o máximo/.test(a.pt) && /exceed the published maximum/.test(a.en)));
  // sem cartões: nada de números
  const zero = PHC.efetivo(q8, m, { id: "manual", qtd: {} });
  assert.equal(zero.s.outputs, undefined); assert.equal(zero.s.maxMPSwitcher, 0);
  assert.equal(S.avaliar(zero.s, { h: 1920, v: 1080, fps: 60 }, {}).semDados, true);
});

test("Q8: a conta de «Saídas a usar (N)» usa as saídas e a capacidade da configuração", () => {
  const q8 = sw("Q8"), m = M("Q8");
  const um = PHC.efetivo(q8, m, { id: "c:hdmi-sdi-fibra:1" }).s, todos = PHC.efetivo(q8, m, { id: "c:hdmi-sdi-fibra:4" }).s;
  const sinal = { h: 7680, v: 2160, fps: 60 };
  const a1 = S.avaliar(um, sinal, {}), a4 = S.avaliar(todos, sinal, {});
  assert.equal(a1.saidas, 4); assert.equal(a4.saidas, 16);
  assert.equal(a1.estimado, false);
  // 7680×2160@60: 2 faixas de 3840×2160 (522,6 MHz ≤ 556,7) -> precisa de 2 saídas
  assert.equal(a1.continuo.precisa, base.splitCanvasForClock(7680, 2160, 60, um.maxPixelClockMHz).n);
  assert.equal(a1.continuo.precisa, 2);
  assert.equal(a1.continuo.cabe, true);
  // 1 cartão: 4 saídas × 8,85 = 35,4 MP; 7680×2160 = 16,6 MP -> 47 %; com 16 saídas -> 12 %
  aprox(a1.uso.pct, (16.5888 / 35.39) * 100, 0.1); aprox(a4.uso.pct, (16.5888 / 141.557) * 100, 0.1);
  // um canvas de 8192×4320 (35,4 MP) já não cabe em 1 cartão com a margem de 90 %, cabe em 4
  const grande = { h: 8192, v: 4320, fps: 60 };
  assert.equal(S.avaliar(um, grande, {}).continuo.cabeCap, false);
  assert.equal(S.avaliar(todos, grande, {}).continuo.cabeCap, true);
});

// ------------------------------------------------------------ Lumina (placas de envio de LED)
test("Lumina: píxeis por porta × portas = máximo de píxeis da ficha (a conta à vista)", () => {
  const por = Object.fromEntries(cfg.lumina.cartoes.map((c) => [c.id, c]));
  assert.equal(20 * 650000, por["lu-20rj45"].max_pixeis);            // 13 000 000
  assert.equal(16 * 650000, por["lu-16rj45-2opt"].max_pixeis);       // 10 400 000
  assert.equal(4 * 5200000, por["lu-4opt"].max_pixeis);              // 20 800 000
  assert.equal(8 * 650000, por["lu-4opt"].px_por_porta_8bit);        // «8 portas Ethernet» por porta ótica
  assert.equal(por["lu-4opt"].px_por_porta_8bit_derivado, true);
  assert.equal(por["lu-4opt"].px_por_porta_10bit, null, "10 bits da ótica: sem dados, não inventado");
  assert.equal(por["lu-20rj45"].px_por_porta_10bit, 320000);
  // as placas do processors.json batem com os dados
  [["lu-20rj45", 20], ["lu-16rj45-2opt", 16], ["lu-4opt", 4]].forEach(([id, portas]) => {
    const c = por[id], p = led(c.modelo_app);
    assert.ok(p, c.modelo_app + " existe em processors.json");
    assert.equal(p.ports, portas); assert.equal(p.ports, c.ligacoes.portas);
    assert.equal(p.maxPixelsHardCap, c.max_pixeis);
    assert.equal(p.fonte, c.fonte);
    assert.equal(p.pixelhueCartao, id);
  });
  // porta ótica = 8 portas Ethernet de 0,93 Gb/s úteis (a regra da app)
  aprox(led("Lumina · LU_4×OPT").portGbpsUsable, 8 * 0.93);
  assert.equal(led("Lumina · LU_4×OPT").soOptica, true);
  assert.equal(led("Lumina · LU_16×RJ45+2×OPT").optica.copia, true, "as óticas da LU_16 só copiam: não somam capacidade");
  assert.equal(led("Lumina · LU_16×RJ45+2×OPT").portGbpsUsable, undefined);
  // a regra de mistura da ficha está dita
  assert.match(cfg.lumina.regra_de_mistura, /LU_4×OPT/);
});

test("Lumina na aba Sinal: capacidade por porta a 8 e 10 bits (conta da app)", () => {
  const usable = 0.93e9;
  const cap = (p, bits, fps) => Math.floor(((p.portGbpsUsable ? p.portGbpsUsable * 1e9 : usable)) / ((bits > 8 ? 48 : 24) * fps));
  assert.equal(cap(led("Lumina · LU_20×RJ45"), 8, 60), 645833);       // ≈ 650 000 da ficha (fator oficial da NovaStar)
  assert.equal(cap(led("Lumina · LU_20×RJ45"), 10, 60), 322916);      // ≈ 320 000 da ficha
  assert.equal(cap(led("Lumina · LU_4×OPT"), 8, 60), 5166666);        // ≈ 5 200 000 (8 × 650 000)
  assert.ok(Math.min(cap(led("Lumina · LU_4×OPT"), 8, 60) * 4, 20800000) <= 20800000);
});

// ------------------------------------------------------------ os dados dos modelos têm entradas em processors.json
test("todos os modelos dos dados existem em processors.json e as configurações por omissão batem", () => {
  cfg.modelos.forEach((m) => {
    const s = sw(m.modelo);
    assert.ok(s, m.modelo + " existe em processors.json");
    const { s: e } = PHC.efetivo(s, m, null);
    if (s.outputs != null && !s.outputModes) assert.equal(e.outputs, s.outputs, m.modelo + ": saídas");
    if (s.outputModes) assert.equal(e.outputs, s.outputModes[0].outputs, m.modelo + ": 1.º modo");
  });
  // Q8 Pro e série J: não existem nas fichas -> não estão na app
  assert.ok(!proc.switchers.some((s) => /Q8 Pro/.test(s.modelo)));
  assert.ok(cfg.nao_tratados["Q8 Pro"] && cfg.nao_tratados["série J"]);
});
