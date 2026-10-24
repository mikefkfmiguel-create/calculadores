// Verificação das contas de «Saídas a usar (N)» (js/saidas-switcher.js).
//
//   node --test scripts/verificar-saidas-switcher.mjs
//
// Só precisa do node (sem browser). As funções de base — pixel clock CVT-RB2,
// divisão por clock/capacidade, modo avançado — são LIDAS do index.html e do
// js/utils.js tal como lá estão, não copiadas: se alguém mudar a conta da
// página, isto passa a testar a conta nova.
//
// As referências «à mão» abaixo são feitas de outra maneira (procura linear
// de baixo para cima, sem busca binária) para não repetirem o mesmo erro.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const html = readFileSync(path.join(raiz, "index.html"), "utf8");
const utils = readFileSync(path.join(raiz, "js/utils.js"), "utf8");
const dados = JSON.parse(readFileSync(path.join(raiz, "data/processors.json"), "utf8"));

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
  extrair(utils, "roundUpEven") + "\n" +
  extrair(html, "cvtRb2ClockMHz") + "\n" +
  extrair(html, "splitCanvasForClock") + "\n" +
  extrair(html, "splitCanvasForCapacity") + "\n" +
  extrair(html, "switcherAdvancedCap") + "\n" +
  "return { roundUpEven, cvtRb2ClockMHz, splitCanvasForClock, splitCanvasForCapacity, switcherAdvancedCap };"
)();

const require = createRequire(import.meta.url);
const SS = require(path.join(raiz, "js/saidas-switcher.js"));
const S = SS.criar({ ...base, margem });

const sw = (marca, modelo) => dados.switchers.find((s) => s.marca === marca && s.modelo === modelo);
const E2 = sw("Barco", "E2");
const E2G2 = sw("Barco", "E2 Gen2");
const S3 = sw("Barco", "S3-4K");
const P80 = sw("PixelHUE", "P80");
const P20DS = sw("PixelHUE", "P20-DS");
const P10 = sw("PixelHUE", "P10");
const H5 = sw("NovaStar", "H5");
const aprox = (a, b, tol = 1e-9) => assert.ok(Math.abs(a - b) <= tol, a + " != " + b);

// Referência independente: maior W par (H par pela proporção) que passa, por varrimento.
function refCanvas(aspH, aspV, n, fps, fitStrip, capMP) {
  const porLargura = aspH >= aspV;
  let melhor = null;
  for (let w = 2; w <= 60000; w += 2) {
    const h = Math.max(2, 2 * Math.floor((w * aspV) / aspH / 2));
    if (capMP && w * h > capMP * 1e6) break;
    const pw = porLargura ? base.roundUpEven(w / n) : w;
    const ph = porLargura ? h : base.roundUpEven(h / n);
    if (!fitStrip(pw, ph)) break;
    melhor = { w, h };
  }
  return melhor;
}

test("E2 (330 MHz, 40 MP PGM, 16 saídas): canvas contínuo com 16 e com 2 saídas", () => {
  const sinal = { h: 3840, v: 1080, fps: 60 };
  const fit = (pw, ph) => base.cvtRb2ClockMHz(pw, ph, 60) <= 330 + 0.05;
  for (const n of [16, 2]) {
    const av = S.avaliar(E2, sinal, { n });
    const ref = refCanvas(3840, 1080, n, 60, fit, 40 * margem);
    assert.equal(av.continuo.max.w, ref.w, "largura com N=" + n);
    assert.equal(av.continuo.max.h, ref.h, "altura com N=" + n);
  }
  // 16 saídas: manda a capacidade (36 MP = 90% de 40): 3840x1080 -> ~11312x3180, à mão: W^2*9/32 = 36e6
  const a16 = S.avaliar(E2, sinal, { n: 16 });
  assert.equal(a16.continuo.max.limite, "capacidade");
  assert.equal(a16.continuo.max.w, 11312);
  assert.equal(a16.continuo.max.h, 3180);
  // 2 saídas: manda o pixel clock da ligação (330 MHz), não a capacidade
  const a2 = S.avaliar(E2, sinal, { n: 2 });
  assert.equal(a2.continuo.max.limite, "ligacao");
  assert.ok(a2.continuo.max.mp < 36);
  // o sinal indicado (3840x1080@60 = 261,3 MHz) cabe numa só ligação
  aprox(a16.sinal.clock, 261.3, 0.1);
  assert.equal(a16.continuo.precisa, 1);
  assert.equal(a16.continuo.cabe, true);
  assert.equal(a2.continuo.cabe, true);
});

test("E2: o sinal 7680x2160@60 precisa de 4 ligações — não cabe com 2 saídas, cabe com 4", () => {
  const sinal = { h: 7680, v: 2160, fps: 60 };
  const a2 = S.avaliar(E2, sinal, { n: 2 });
  assert.equal(a2.continuo.precisa, 4);
  assert.equal(a2.continuo.cabe, false);
  assert.deepEqual(a2.continuo.motivos.map((m) => m.tipo), ["saidas"]);
  const a4 = S.avaliar(E2, sinal, { n: 4 });
  assert.equal(a4.continuo.cabe, true);
  // capacidade: 7680x2160 = 16,59 MP <= 36
  aprox(a4.sinal.totalMP, 16.5888, 1e-6);
  assert.equal(a4.continuo.cabeCap, true);
  // sugestão: pelo menos 4 saídas
  const sug = S.sugerir(a2, { todos: dados.switchers, escolhidos: () => false });
  const min = sug.itens.find((i) => i.tipo === "saidasMin");
  assert.equal(min.n, 4);
  // e há outros switchers que servem com 2 saídas? (a conta por 2 ligações exige clock alto: 522,6 MHz dá 2 faixas de 3840x2160)
  const outros = sug.itens.find((i) => i.tipo === "outros" && i.disp === "continuo");
  assert.ok(outros, "alguns switchers de 522,6 MHz servem com 2 saídas");
  assert.ok(outros.lista.every((o) => o.s.maxPixelClockMHz >= 500));
  assert.ok(!outros.lista.some((o) => o.s === E2), "o próprio não entra");
});

test("N maior do que as saídas: usa as saídas que o switcher tem e avisa", () => {
  const av = S.avaliar(E2, { h: 3840, v: 1080, fps: 60 }, { n: 40 });
  assert.equal(av.nExcede, true);
  assert.equal(av.nPedido, 40);
  assert.equal(av.n, 16);
});

test("Vazio = todas as saídas (o mesmo que N = nº de saídas)", () => {
  const sinal = { h: 3840, v: 2160, fps: 60 };
  const a = S.avaliar(E2G2, sinal, {});
  const b = S.avaliar(E2G2, sinal, { n: 18 });
  assert.equal(a.n, 18);
  assert.deepEqual(a.continuo.max, b.continuo.max);
  assert.deepEqual(a.indep.porSaida, b.indep.porSaida);
});

test("ecrãs independentes: resolução máxima por saída e total (E2, 4 saídas)", () => {
  const sinal = { h: 1920, v: 1080, fps: 60 };
  const av = S.avaliar(E2, sinal, { n: 4 });
  // 16:9, 4 saídas: partilha da capacidade 36 MP / 4 = 9 MP por saída; clock 330 MHz aguenta 4096x2304?
  const fit = (w, h) => base.cvtRb2ClockMHz(w, h, 60) <= 330.05 && w * h <= 9e6;
  let ref = null;
  for (let w = 2; w < 20000; w += 2) {
    const h = Math.max(2, 2 * Math.floor((w * 1080) / 1920 / 2));
    if (!fit(w, h)) break;
    ref = { w, h };
  }
  assert.equal(av.indep.porSaida.w, ref.w);
  assert.equal(av.indep.porSaida.h, ref.h);
  aprox(av.indep.totalMax, 4 * ref.w * ref.h / 1e6, 1e-9);
  // 4 ecrãs 1920x1080: 4 x 2,07 MP = 8,29 MP <= 36 -> cabe
  assert.equal(av.indep.cabe, true);
  aprox(av.indep.totalMP, 8.2944, 1e-9);
  aprox(av.indep.pct, (8.2944 / 40) * 100, 1e-9);
});

test("ecrãs independentes: 16 ecrãs 4K não cabem (capacidade) e a sugestão diz quantos cabem", () => {
  const av = S.avaliar(E2G2, { h: 3840, v: 2160, fps: 60 }, { n: 16 });
  // (E2 Gen2: 600 MHz por ligação, 40 MP em PGM.) 8,2944 MP x 16 = 132,7 MP > 36 MP úteis
  assert.equal(av.indep.cabe, false);
  assert.deepEqual(av.indep.motivos.map((m) => m.tipo), ["capacidade"]);
  assert.equal(av.indep.nMax, 4); // floor(36 / 8,2944) = 4
  const sug = S.sugerir(av, { todos: dados.switchers, escolhidos: () => false });
  assert.equal(sug.itens.find((i) => i.tipo === "maxEcras").n, 4);
});

test("clock de uma ligação a falhar (E2 330 MHz, ecrã 4K@60 = 522,6 MHz): independentes não cabem por «ligacao»", () => {
  const av = S.avaliar(E2, { h: 3840, v: 2160, fps: 60 }, { n: 2 });
  assert.equal(av.indep.ligacaoOk, false);
  assert.equal(av.indep.motivos[0].tipo, "ligacao");
  assert.equal(av.indep.nMax, 0);
  // baixar o frame rate resolve: 30 Hz (261 MHz) cabe numa ligação de 330 MHz
  const sug = S.sugerir(av, { todos: dados.switchers, escolhidos: () => false });
  const fps = sug.itens.find((i) => i.tipo === "fps" && i.disp === "indep");
  assert.ok(fps && fps.fps <= 50, "sugere baixar o frame rate");
  const reav = S.avaliar(E2, { h: 3840, v: 2160, fps: fps.fps }, { n: 2, usar30p: fps.fps <= 30 });
  assert.equal(reav.indep.cabe, true);
});

test("capacidade a 30p da ficha entra só na hipótese «baixar para 30 Hz»", () => {
  // E2: 40 MP em PGM, 80 MP a 30p. 7680x4320 = 33,2 MP cabe em 36; usar 8K x 2 = 66 MP não cabe a 60p mas cabe a 30p.
  const av = S.avaliar(E2, { h: 7680, v: 4320, fps: 60 }, { n: 16 });
  assert.equal(av.continuo.cabeCap, true);
  const grande = S.avaliar(E2, { h: 10000, v: 5000, fps: 60 }, { n: 16 });
  assert.equal(grande.continuo.cabeCap, false); // 50 MP > 36
  const sug = S.sugerir(grande, { todos: dados.switchers, escolhidos: () => false });
  const f = sug.itens.find((i) => i.tipo === "fps" && i.disp === "continuo");
  assert.ok(f, "há hipótese de baixar o frame rate");
  assert.equal(f.fps, 30);
  assert.equal(f.capAntes, 40);
  assert.equal(f.capNova, 80);
});

test("modo avançado / unidades ligadas: E2 com 2 unidades sobe a capacidade", () => {
  const grande = S.avaliar(E2, { h: 12000, v: 6000, fps: 60 }, { n: 16 }); // 72 MP
  assert.equal(grande.continuo.cabeCap, false);
  const sug = S.sugerir(grande, { todos: dados.switchers, escolhidos: () => false });
  const u = sug.itens.find((i) => i.tipo === "unidades" && i.disp === "continuo");
  assert.ok(u, "sugere ligar as 2 unidades");
  assert.equal(u.capNova, 80);
  // com o modo avançado já ligado não se volta a sugerir
  const adv = S.avaliar(E2, { h: 12000, v: 6000, fps: 60 }, { n: 16, avancado: true });
  assert.equal(adv.cap.pgm, 80);
  assert.ok(!S.sugerir(adv, { todos: dados.switchers, escolhidos: () => false }).itens.some((i) => i.tipo === "unidades"));
});

test("switcher com outputModes (P80): N limitado pelo modo; sem pixel clock -> estimado", () => {
  const sinal = { h: 3840, v: 1080, fps: 60 };
  const split = S.avaliar(P80, sinal, { n: 10, modeIdx: 0 });
  assert.equal(split.saidas, 12);
  assert.equal(split.n, 10);
  const copy = S.avaliar(P80, sinal, { n: 10, modeIdx: 1 });
  assert.equal(copy.saidas, 8);
  assert.equal(copy.n, 8);
  assert.equal(copy.nExcede, true);
  assert.equal(split.estimado, true);
  assert.equal(split.lim.tipo, "capacidade");
  aprox(split.lim.px, (35 * 1e6) / 12, 1e-6);
  // orçamento por ligação (35 MP / 12 = 2,92 MP): 3840x1080 = 4,15 MP precisa de 2 ligações
  assert.equal(split.continuo.precisa, 2);
  assert.equal(split.continuo.precisa, base.splitCanvasForCapacity(3840, 1080, (35 * 1e6) / 12).n);
});

test("sem pixel clock e sem saídas (P10): sem dados até se indicar N; com N só a capacidade", () => {
  const sinal = { h: 1920, v: 1080, fps: 60 };
  const sem = S.avaliar(P10, sinal, {});
  assert.equal(sem.semDados, true);
  const com = S.avaliar(P10, sinal, { n: 2 });
  assert.equal(com.semDados, undefined);
  assert.equal(com.semLimite, true);
  assert.equal(com.estimado, true);
  assert.ok(com.continuo.max && com.continuo.max.limite === "capacidade");
});

test("sem pixel clock com saídas (P20-DS): orçamento por ligação = capacidade / saídas, marcado estimado", () => {
  const av = S.avaliar(P20DS, { h: 3840, v: 2160, fps: 60 }, { n: 4 });
  assert.equal(av.estimado, true);
  aprox(av.lim.px, (35.4 * 1e6) / 8, 1e-6);
  assert.equal(av.continuo.precisa, base.splitCanvasForCapacity(3840, 2160, (35.4 * 1e6) / 8).n);
});

test("H5: com a placa de fibra (modo avançado) a capacidade é a avançada", () => {
  const norm = S.avaliar(H5, { h: 3840, v: 2160, fps: 60 }, {});
  const adv = S.avaliar(H5, { h: 3840, v: 2160, fps: 60 }, { avancado: true });
  assert.equal(norm.cap.pgm, 39);
  assert.equal(adv.cap.pgm, 62.4);
});

test("regressão: sem N, as ligações necessárias são as que o calcSinal() já calculava", () => {
  const sinal = { h: 5760, v: 1080, fps: 50 };
  for (const s of dados.switchers) {
    const av = S.avaliar(s, sinal, {});
    if (av.semDados || !s.maxPixelClockMHz) continue;
    const esperado = base.splitCanvasForClock(5760, 1080, 50, s.maxPixelClockMHz);
    assert.equal(av.continuo.precisa, esperado ? esperado.n : null, s.modelo);
  }
});

test("propriedade: o canvas máximo cabe e o seguinte (+2 px) já não cabe", () => {
  for (const s of [E2, E2G2, S3, H5]) {
    for (const n of [1, 2, 3, 5]) {
      for (const fps of [30, 60]) {
        const av = S.avaliar(s, { h: 1920, v: 1080, fps }, { n });
        if (av.semDados) continue;
        const m = av.continuo.max;
        const faixa = (w, h) => [base.roundUpEven(w / n), h];
        const [pw, ph] = faixa(m.w, m.h);
        assert.ok(base.cvtRb2ClockMHz(pw, ph, fps) <= s.maxPixelClockMHz + 0.05, s.modelo + " faixa cabe");
        assert.ok(m.mp <= av.cap.pgm * margem + 1e-9, s.modelo + " dentro da capacidade");
        const w2 = m.w + 2, h2 = Math.max(2, 2 * Math.floor((w2 * 1080) / 1920 / 2));
        const [qw, qh] = faixa(w2, h2);
        const cabe = base.cvtRb2ClockMHz(qw, qh, fps) <= s.maxPixelClockMHz + 0.05 && w2 * h2 <= av.cap.pgm * margem * 1e6;
        assert.equal(cabe, false, s.modelo + " n=" + n + " fps=" + fps + " o seguinte já não cabe");
      }
    }
  }
});

test("alternativa com mais folga só aparece com >= 10 pontos de diferença", () => {
  const av = S.avaliar(S3, { h: 5000, v: 1700, fps: 30 }, { n: 4 }); // 8,5 MP em 20 MP = 42%
  assert.equal(av.continuo.cabe, true);
  const sug = S.sugerir(av, { todos: dados.switchers, escolhidos: () => false });
  const mf = sug.itens.find((i) => i.tipo === "maisFolga");
  assert.ok(mf, "o S3-4K (20 MP) aperta mais do que os switchers grandes");
  assert.ok(mf.lista.every((o) => o.pct <= av.uso.pct - 10));
});

test("lerSaidas: vazio = todas; inteiro >= 1; resto é inválido", () => {
  assert.deepEqual(SS.lerSaidas("", false), { n: null, invalido: false });
  assert.deepEqual(SS.lerSaidas("  ", false), { n: null, invalido: false });
  assert.deepEqual(SS.lerSaidas("4", false), { n: 4, invalido: false });
  for (const mau of ["0", "-2", "2.5", "1e2", "abc"]) assert.deepEqual(SS.lerSaidas(mau, false), { n: null, invalido: true }, mau);
  assert.deepEqual(SS.lerSaidas("", true), { n: null, invalido: true });
});
