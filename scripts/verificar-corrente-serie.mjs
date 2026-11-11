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

// ------------------------------------------------ cabinets em série por brilho (v4.72)
// Referência à mão: o maior k com k × (icab × f) <= util, em milésimas de A.
function referenciaSerieBrilho(imax, icab, margem, base, brilho) {
  const f = base / 100 + (1 - base / 100) * (brilho / 100);
  const util = Math.round(imax * 1e4 * (100 - margem) / 100);
  const c = Math.round(icab * f * 1e4);
  let k = 0;
  while ((k + 1) * c <= util) k++;
  return k;
}

test("exemplo do Mike: 9 A, margem 20 %, 0,75 A por cabinet -> 9 / 12 / 19 / 38 / 96 em série", () => {
  const r = cs.consumoPorBrilho({ itotal: 4.5, basePct: 0, tensao: 230,
    serie: { imax: 9, icab: 0.75, n: 6, margemPct: 20 } });
  assert.deepEqual(r.map(x => x.brilho), [100, 75, 50, 25, 10]);
  assert.deepEqual(r.map(x => x.serie.N), [9, 12, 19, 38, 96]);
  // 100 % coincide com a conta da cadeia que a página já mostrava
  assert.equal(r[0].serie.N, cs.calcular({ imax: 9, icab: 0.75, n: 6, margemPct: 20 }).N);
  // 6 cabinets no ecrã: cabem todos numa cadeia a qualquer brilho
  assert.deepEqual(r.map(x => x.serie.M), [1, 1, 1, 1, 1]);
  assert.ok(r.every(x => x.serie.todos));
});

test("entradas por brilho = ceil(n ÷ N) e baixam com o brilho", () => {
  const r = cs.consumoPorBrilho({ itotal: 52, basePct: 0, tensao: null,
    serie: { imax: 8, icab: 0.52, n: 100, margemPct: 20 } });
  assert.deepEqual(r.map(x => x.serie.N), [12, 16, 24, 49, 123]);
  assert.deepEqual(r.map(x => x.serie.M), [9, 7, 5, 3, 1]);
  assert.equal(r[0].serie.M, cs.calcular({ imax: 8, icab: 0.52, n: 100, margemPct: 20 }).M);
  assert.deepEqual(r.map(x => x.serie.todos), [false, false, false, false, true]);
  for (let i = 1; i < r.length; i++) assert.ok(r[i].serie.N >= r[i - 1].serie.N && r[i].serie.M <= r[i - 1].serie.M);
});

test("coincide com a referência para muitas combinações (com margem e consumo mínimo)", () => {
  for (const imax of [8, 10, 16, 32])
    for (const icab of [0.4, 0.52, 0.75, 1.2, 2.5])
      for (const margem of [0, 20, 50])
        for (const base of [0, 10, 30, 50])
          for (const n of [1, 6, 100]) {
            const r = cs.consumoPorBrilho({ itotal: icab * n, basePct: base, tensao: null,
              serie: { imax, icab, n, margemPct: margem } });
            r.forEach(x => {
              const N = referenciaSerieBrilho(imax, icab, margem, base, x.brilho);
              assert.equal(x.serie.N, N, `N ${imax} A, ${icab} A, ${margem} %, base ${base}, ${x.brilho} %`);
              if (N >= 1) assert.equal(x.serie.M, referenciaM(n, N));
              else assert.equal(x.serie.M, null);
              // nunca se promete uma cadeia mais carregada do que a capacidade utilizável
              if (N >= 1) {
                const maxCad = Math.min(N, Math.ceil(n / x.serie.M));
                const f = base / 100 + (1 - base / 100) * (x.brilho / 100);
                assert.ok(maxCad * icab * f <= imax * (1 - margem / 100) + 1e-9);
              }
            });
          }
});

test("consumo mínimo (base) sobe a corrente por cabinet e tira cabinets da cadeia", () => {
  const semBase = cs.consumoPorBrilho({ itotal: 52, basePct: 0, serie: { imax: 8, icab: 0.52, n: 100, margemPct: 20 } });
  const comBase = cs.consumoPorBrilho({ itotal: 52, basePct: 50, serie: { imax: 8, icab: 0.52, n: 100, margemPct: 20 } });
  // 10 % com base 50 %: f = 0,55 -> 0,286 A -> 6,4 ÷ 0,286 = 22,38 -> 22
  assert.equal(comBase[4].serie.N, 22);
  assert.ok(comBase[4].serie.N < semBase[4].serie.N);
  assert.equal(comBase[0].serie.N, semBase[0].serie.N);        // 100 % não depende da base
});

test("sem corrente máx. de saída (ou sem icab / n) -> sem série no brilho", () => {
  for (const s of [undefined, null, { imax: "", icab: 0.5, n: 10 }, { imax: NaN, icab: 0.5, n: 10 }, { imax: 8, icab: "", n: 10 }, { imax: 8, icab: 0.5, n: 0 }]) {
    const r = cs.consumoPorBrilho({ itotal: 5, basePct: 0, tensao: null, serie: s });
    assert.ok(r.every(x => x.serie === null));
    assert.ok(!/<th>Máx\. de cabinets em série/.test(cs.htmlTabelaConsumo(r, { basePct: 0 })));
    assert.ok(!cs.linhasConsumo(r, { basePct: 0 }).some(l => /em série/.test(l)));
  }
});

test("cabinet que não cabe a 100 % pode caber a brilho mais baixo", () => {
  // 7 A por cabinet, 8 A de capacidade, margem 20 % -> 6,4 A utilizáveis
  const r = cs.consumoPorBrilho({ itotal: 70, basePct: 0, serie: { imax: 8, icab: 7, n: 10, margemPct: 20 } });
  assert.deepEqual(r.map(x => x.serie.N), [0, 1, 1, 3, 9]);
  assert.equal(r[0].serie.M, null);
  assert.deepEqual(r.map(x => x.serie.M), [null, 10, 10, 4, 2]);
  const h = cs.htmlTabelaConsumo(r, { basePct: 0 });
  assert.match(h, /nenhum cabinet cabe numa entrada a este brilho/);
  assert.match(cs.linhasConsumo(r, { basePct: 0 })[1], /nenhum cabinet cabe numa entrada$/);
});

test("tabela: coluna nova com os valores certos; nota de estimativa e de «todos numa cadeia»", () => {
  const r = cs.consumoPorBrilho({ itotal: 4.5, basePct: 0, tensao: 230, serie: { imax: 9, icab: 0.75, n: 6, margemPct: 20 } });
  const h = cs.htmlTabelaConsumo(r, { basePct: 0 });
  assert.match(h, /<th>Máx\. de cabinets em série por entrada<\/th><th>Entradas necessárias<\/th>/);
  assert.match(h, /<td>100 %<\/td>[^]*?<td>0 %<\/td><td>9<\/td><td>1<\/td><\/tr>/);
  assert.match(h, /<td>10 %<\/td>[^]*?<td>90 %<\/td><td>96<\/td><td>1<\/td><\/tr>/);
  assert.match(h, /dimensionam-se pelo máximo \(100 %\)/);
  assert.match(h, /Onde o máximo passa dos 6 cabinets do ecrã/);
  // sem serie: tabela igual à de antes (5 colunas com tensão)
  const sem = cs.htmlTabelaConsumo(cs.consumoPorBrilho({ itotal: 4.5, basePct: 0, tensao: 230 }), { basePct: 0 });
  assert.ok(!/em série/.test(sem));
});

test("linhas do relatório com a série por brilho", () => {
  const r = cs.consumoPorBrilho({ itotal: 52, basePct: 0, tensao: 230, serie: { imax: 8, icab: 0.52, n: 100, margemPct: 20 } });
  const l = cs.linhasConsumo(r, { basePct: 0 });
  assert.equal(l[1], "Brilho 100 %: 52 A (17,33 A/fase) — 11,96 kW — poupança de 0 % — máx. 12 cabinets em série por entrada → 9 entradas de alimentação");
  assert.equal(l[5], "Brilho 10 %: 5,2 A (1,73 A/fase) — 1,2 kW — poupança de 90 % — máx. 123 cabinets em série por entrada → 1 entrada de alimentação");
  // por zona
  assert.equal(cs.linhaConsumoZona("Zona A", r.slice(0, 2)), "Consumo por brilho — Zona A: 100 %: 52 A (12 em série) · 75 %: 39 A (16 em série)");
});

test("a série por brilho não mexe no dimensionamento nem nos valores de antes", () => {
  const antes = cs.calcular({ imax: 8, icab: 0.52, n: 100, margemPct: 20 });
  const sem = cs.consumoPorBrilho({ itotal: 52, basePct: 0, tensao: 230 });
  const com = cs.consumoPorBrilho({ itotal: 52, basePct: 0, tensao: 230, serie: { imax: 8, icab: 0.52, n: 100, margemPct: 20 } });
  assert.deepEqual(cs.calcular({ imax: 8, icab: 0.52, n: 100, margemPct: 20 }), antes);
  assert.deepEqual(com.map(({ serie, ...resto }) => resto), sem.map(({ serie, ...resto }) => resto));
});
