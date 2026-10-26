// Verificação das contas de js/corrente-serie.js (cabinets em série por
// entrada + consumo estimado por brilho).
//
//   node --test scripts/verificar-corrente-serie.mjs
//
// Só precisa do node (sem browser). As referências abaixo são feitas «à mão»,
// por procura linear (sem floor nem ceil), para não repetirem o mesmo erro.

import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cs = createRequire(import.meta.url)(path.join(raiz, "js/corrente-serie.js"));

// Quantos cabinets cabem: o maior k com k × icab <= util (em centésimas de A,
// para não depender de vírgula flutuante).
function referenciaN(imax, icab, margem) {
  const util = Math.round(imax * 100 * (100 - margem) / 100);
  const c = Math.round(icab * 100);
  let k = 0;
  while ((k + 1) * c <= util) k++;
  return k;
}
function referenciaM(n, N) { let m = 1; while (m * N < n) m++; return m; }

test("exemplos do Mike: 0,52 A / 8 A e 1,2 A / 10 A, com e sem margem", () => {
  assert.equal(cs.calcular({ imax: 8, icab: 0.52, n: 100, margemPct: 0 }).N, 15);
  assert.equal(cs.calcular({ imax: 8, icab: 0.52, n: 100, margemPct: 20 }).N, 12);   // 6,4 A utilizáveis
  assert.equal(cs.calcular({ imax: 10, icab: 1.2, n: 100, margemPct: 0 }).N, 8);
  assert.equal(cs.calcular({ imax: 10, icab: 1.2, n: 100, margemPct: 20 }).N, 6);    // 8 A utilizáveis
});

test("coincide com a referência para muitas combinações", () => {
  for (const imax of [6, 8, 10, 12.5, 16, 20, 32])
    for (const icab of [0.3, 0.4, 0.52, 0.57, 0.8, 1, 1.2, 1.6, 2.5])
      for (const margem of [0, 10, 20, 35, 50])
        for (const n of [1, 7, 50, 100, 333]) {
          const r = cs.calcular({ imax, icab, n, margemPct: margem });
          const N = referenciaN(imax, icab, margem);
          if (N < 1) { assert.equal(r.estado, "nenhum-cabe"); continue; }
          assert.equal(r.N, N, `N com ${imax} A, ${icab} A, ${margem} %`);
          assert.equal(r.M, referenciaM(n, N), `M com n=${n}`);
          // As cadeias somam n, nenhuma passa de N, e as diferenças são de 1.
          const total = r.grupos.reduce((s, g) => s + g.cadeias * g.cabinets, 0);
          const cadeias = r.grupos.reduce((s, g) => s + g.cadeias, 0);
          assert.equal(total, n);
          assert.equal(cadeias, r.M);
          assert.ok(r.maxCadeia <= N);
          const tam = r.grupos.map(g => g.cabinets);
          assert.ok(Math.max(...tam) - Math.min(...tam) <= 1);
          // A corrente do 1.º cabinet da cadeia mais carregada nunca passa da utilizável.
          assert.ok(r.iCadeia <= r.util + 1e-9);
        }
});

test("100 tiles com 15 em série -> 7 cadeias de 14/15 (e não 6×15 + 1×10)", () => {
  const r = cs.calcular({ imax: 8, icab: 0.52, n: 100, margemPct: 0 });
  assert.equal(r.M, 7);
  assert.deepEqual(r.grupos, [{ cadeias: 2, cabinets: 15 }, { cadeias: 5, cabinets: 14 }]);
  assert.equal(r.maxCadeia, 15);
  assert.equal(cs.textoGrupos(r), "2 cadeias de 15 cabinets + 5 cadeias de 14 cabinets");
});

test("ocupação da capacidade e trifásica", () => {
  const r = cs.calcular({ imax: 8, icab: 0.52, n: 100, margemPct: 20 });   // 9 entradas: 1×12 + 8×11
  assert.equal(r.M, 9);
  assert.ok(Math.abs(r.iCadeia - 6.24) < 1e-9);
  assert.equal(Math.round(r.ocupacao), 78);
  assert.equal(r.porFase, 3);
});

test("I_cab maior do que a corrente utilizável -> nenhum cabe", () => {
  const r = cs.calcular({ imax: 8, icab: 7, n: 10, margemPct: 20 });      // 7 > 6,4
  assert.equal(r.estado, "nenhum-cabe");
  assert.match(cs.linhasRelatorio(r)[0], /^⚠ Nenhum cabinet cabe numa entrada/);
  // sem margem esse mesmo cabinet já cabe
  assert.equal(cs.calcular({ imax: 8, icab: 7, n: 10, margemPct: 0 }).N, 1);
});

test("campos em falta -> sem cálculo e sem linhas no relatório", () => {
  for (const o of [{ imax: NaN, icab: 0.5, n: 10 }, { imax: "", icab: 0.5, n: 10 }, { imax: 8, icab: NaN, n: 10 }, { imax: 8, icab: 0.5, n: 0 }]) {
    const r = cs.calcular({ ...o, margemPct: 20 });
    assert.ok(["sem-imax", "sem-icab", "sem-n"].includes(r.estado));
    assert.deepEqual(cs.linhasRelatorio(r), []);
    assert.equal(cs.htmlDetalhe(r), "");
  }
});

test("várias zonas somam as entradas", () => {
  const a = cs.calcular({ imax: 8, icab: 0.52, n: 100, margemPct: 20 });   // 9
  const b = cs.calcular({ imax: 10, icab: 1.2, n: 20, margemPct: 20 });    // 6 em série -> 4
  const vazio = cs.calcular({ imax: "", icab: 1, n: 5, margemPct: 20 });
  const t = cs.somar([a, b, vazio]);
  assert.equal(t.entradas, 13);
  assert.equal(t.zonas, 2);
  assert.equal(t.porFase, 5);
});

test("margem: validação 0–50 e valor por omissão", () => {
  assert.equal(cs.MARGEM_PADRAO, 20);
  assert.ok(cs.margemValida(0) && cs.margemValida(50) && cs.margemValida("20"));
  assert.ok(!cs.margemValida(-1) && !cs.margemValida(51) && !cs.margemValida("") && !cs.margemValida("x"));
  // margem inválida na conta cai na de origem (20 %)
  assert.equal(cs.calcular({ imax: 8, icab: 0.52, n: 100, margemPct: 99 }).N, 12);
});

test("consumo por brilho: 5 patamares, linear, base e tensão", () => {
  assert.deepEqual(cs.PATAMARES, [100, 75, 50, 25, 10]);
  const r = cs.consumoPorBrilho({ itotal: 52, basePct: 0, tensao: null });
  assert.deepEqual(r.map(x => x.brilho), [100, 75, 50, 25, 10]);
  assert.deepEqual(r.map(x => Math.round(x.i * 100) / 100), [52, 39, 26, 13, 5.2]);
  assert.deepEqual(r.map(x => Math.round(x.poupanca)), [0, 25, 50, 75, 90]);
  assert.ok(r.every(x => x.w === null));
  assert.ok(Math.abs(r[4].iFase - 5.2 / 3) < 1e-9);
  // com base de 20 %: I = 52 × (0,2 + 0,8 × b)
  const b = cs.consumoPorBrilho({ itotal: 52, basePct: 20, tensao: 230 });
  assert.deepEqual(b.map(x => Math.round(x.i * 100) / 100), [52, 41.6, 31.2, 20.8, 14.56]);
  assert.deepEqual(b.map(x => Math.round(x.poupanca)), [0, 20, 40, 60, 72]);
  assert.ok(Math.abs(b[0].w - 52 * 230) < 1e-6);
  assert.equal(cs.textoPotencia(b[0].w), "11,96 kW");
  assert.equal(cs.textoPotencia(500), "500 W");
  assert.equal(cs.consumoPorBrilho({ itotal: 0, basePct: 0 }), null);
  assert.equal(cs.consumoPorBrilho({ itotal: NaN, basePct: 0 }), null);
});

test("o consumo por brilho não mexe no dimensionamento", () => {
  const antes = cs.calcular({ imax: 8, icab: 0.52, n: 100, margemPct: 20 });
  cs.consumoPorBrilho({ itotal: 52, basePct: 50, tensao: 230 });
  assert.deepEqual(cs.calcular({ imax: 8, icab: 0.52, n: 100, margemPct: 20 }), antes);
});

test("linhas do relatório: nada quando o interruptor está desligado é decisão de quem chama; texto estável", () => {
  const r = cs.calcular({ imax: 8, icab: 0.52, n: 100, margemPct: 20 });
  const l = cs.linhasRelatorio(r);
  assert.equal(l[0], "Alimentação em série (margem de 20 %): máx. 12 cabinets em série por entrada → 9 entradas de alimentação");
  assert.equal(l[1], "Cadeias: 1 cadeia de 12 cabinets + 8 cadeias de 11 cabinets; a mais carregada: 6,24 A / 8 A (78 %)");
  assert.match(l[2], /^Conta da alimentação: capacidade total 8 A → com margem de 20 %: 6,4 A utilizáveis ÷ 0,52 A por cabinet = 12$/);
  assert.equal(l[3], "Por fase (trifásica): máx. de entradas por fase = 3");
  const c = cs.linhasConsumo(cs.consumoPorBrilho({ itotal: 52, basePct: 0, tensao: 230 }), { basePct: 0 });
  assert.equal(c.length, 6);
  assert.equal(c[1], "Brilho 100 %: 52 A (17,33 A/fase) — 11,96 kW — poupança de 0 %");
  assert.equal(c[5], "Brilho 10 %: 5,2 A (1,73 A/fase) — 1,2 kW — poupança de 90 %");
});
