// Verificação das CONTAS do LED Wall Help (js/ligacao-led.js), sem página.
//
//   node --test scripts/verificar-ligacao-led.mjs
//
// O caso de referência é o ecrã de 19 × 3 m, pitch 2,6 mm, 7296 × 1152 px:
// 38 × 6 cabinets de 500 × 500 mm e 192 × 192 px (a conta fecha: 38 × 192 =
// 7296 e 6 × 192 = 1152). Cada número esperado está escrito com a conta à vista.
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const L = require(join(raiz, "js", "ligacao-led.js"));
const ler = (f) => JSON.parse(readFileSync(join(raiz, f), "utf8"));

const C = 38, R = 6, RX = 192, RY = 192;
const TOTAL = (C * RX) * (R * RY);
const g = L.grelhaUniforme(C, R, RX, RY);
const GBPS = (bits, hz) => (bits * 3 * hz * TOTAL) / 1e9;
const ESC = { cw: 0.5, ch: 0.5 };

test("referência: resolução e número de píxeis", () => {
  assert.equal(C * RX, 7296);
  assert.equal(R * RY, 1152);
  assert.equal(g.total, 7296 * 1152);
  assert.equal(g.total, 8404992);
  assert.equal(C * 500, 19000);
  assert.equal(R * 500, 3000);
});

test("referência: débito total por bit (bits × 3 canais × Hz × píxeis)", () => {
  // 8 × 3 × 60 × 8 404 992 = 12 103 188 480 b/s
  assert.ok(Math.abs(L.debitoGbps(g.total, 60, 8, 3) - 12.10318848) < 1e-9);
  assert.ok(Math.abs(L.debitoGbps(g.total, 60, 10, 3) - 15.1289856) < 1e-9);
  assert.ok(Math.abs(L.debitoGbps(g.total, 60, 12, 3) - 18.15478272) < 1e-9);
});

test("referência: cabinets por porta, portas e enchimento a 8, 10 e 12 bits", () => {
  // Porta GigE: 930 000 000 b/s ÷ (24 bpp × 60 Hz) = 645 833 px; cabinet = 36 864 px.
  // 8 bits : 645 833 ÷ 36 864 = 17,5 -> 17 por porta; 228 ÷ 17 = 13,4 -> 14 portas.
  // 10/12  : 930e6 ÷ (48 × 60) = 322 916 px -> 8,76 -> 8 por porta; 228 ÷ 8 = 28,5 -> 29 portas.
  const esperado = { 8: [645833, 17, 14], 10: [322916, 8, 29], 12: [322916, 8, 29] };
  for (const bits of [8, 10, 12]) {
    const px = L.pxPorPorta({ tipo: "eth", bits, hz: 60 });
    const [pxE, K, P] = esperado[bits];
    assert.equal(px, pxE, `px por porta a ${bits} bits`);
    assert.equal(Math.floor(px / g.maxPx), K, `cabinets por porta a ${bits} bits`);
    const s = L.sugerir(g, px, "baixo", ESC);
    assert.equal(s.Pmin, P, `portas mínimas a ${bits} bits`);
    const prin = s.sugestoes[0];
    assert.equal(prin.m.P, P, `a sugestão principal usa o mínimo de portas a ${bits} bits`);
    assert.ok(prin.m.fillMax <= 100, "nenhuma porta acima de 100 %");
    assert.equal(prin.m.sobre, 0);
    assert.equal(prin.m.retornos, 0, "a sugestão principal não tem retornos");
  }
});

test("referência: a 50 Hz cabem mais cabinets por porta", () => {
  // 930e6 ÷ (24 × 50) = 775 000 px -> 21 por porta -> 11 portas; a 10 bits: 387 500 -> 10 -> 23 portas.
  const px8 = L.pxPorPorta({ tipo: "eth", bits: 8, hz: 50 });
  assert.equal(px8, 775000);
  assert.equal(Math.floor(px8 / g.maxPx), 21);
  assert.equal(L.sugerir(g, px8, "baixo", ESC).Pmin, 11);
  const px10 = L.pxPorPorta({ tipo: "eth", bits: 10, hz: 50 });
  assert.equal(px10, 387500);
  assert.equal(Math.floor(px10 / g.maxPx), 10);
  assert.equal(L.sugerir(g, px10, "baixo", ESC).Pmin, 23);
});

test("portGbpsUsable de um processador substitui a banda GigE (como na aba Sinal)", () => {
  // MX2000 Pro: 3,73248 Gb/s ÷ (24 × 60) = 2 592 000 px por porta.
  const proc = ler("data/processors.json").ledProcessors.find((p) => p.modelo === "MX2000 Pro");
  const px = L.pxPorPorta({ tipo: "eth", bits: 8, hz: 60, portGbpsUsable: proc.portGbpsUsable });
  assert.equal(px, 2592000);
});

test("sem dados: fibra do processador e capacidade à mão em falta", () => {
  assert.equal(L.pxPorPorta({ tipo: "fibra", bits: 8, hz: 60 }), null);
  assert.equal(L.pxPorPorta({ tipo: "manual", bits: 8, hz: 60, manualPx: "" }), null);
  assert.equal(L.pxPorPorta({ tipo: "manual", bits: 8, hz: 60, manualPx: 300000 }), 300000);
});

function celulasUnicas(g, esq) {
  const n = new Map();
  esq.portas.forEach((p) => p.cels.forEach((c) => n.set(c.c + "," + c.r, (n.get(c.c + "," + c.r) || 0) + 1)));
  if (n.size !== g.C * g.R) return false;
  for (const v of n.values()) if (v !== 1) return false;
  return true;
}

test("cada cabinet aparece exatamente UMA vez em TODOS os esquemas candidatos (várias grelhas e bits)", () => {
  const casos = [[38, 6, 192, 192], [1, 1, 192, 192], [7, 5, 128, 128], [16, 9, 128, 128], [10, 3, 256, 128]];
  for (const [c, r, rx, ry] of casos) {
    const gg = L.grelhaUniforme(c, r, rx, ry);
    for (const bits of [8, 10, 12]) {
      for (const hz of [50, 60]) {
        const px = L.pxPorPorta({ tipo: "eth", bits, hz });
        for (const lado of ["baixo", "topo", "esq", "dir"]) {
          const cd = L.candidatos(gg, px, lado, ESC);
          assert.ok(cd.lista.length > 0);
          for (const cand of cd.lista) {
            assert.ok(celulasUnicas(gg, cand.esq), `${c}x${r} ${bits}b ${hz}Hz ${cand.m.sig}: cabinets repetidos ou em falta`);
            // as portas são percursos ligados: sem retorno, cada passo é um vizinho
            if (cand.cfg.padrao === "serp") {
              cand.esq.portas.forEach((p) => p.cels.forEach((cel, i) => {
                if (i === 0) return;
                const a = p.cels[i - 1];
                assert.equal(Math.abs(a.c - cel.c) + Math.abs(a.r - cel.r), 1, "serpentina sem saltos");
              }));
            }
          }
        }
      }
    }
  }
});

test("grelha com meio-tile (colunas de largura diferente): cada cabinet uma vez e portas dentro do limite", () => {
  // 5 colunas de 192 px + 1 coluna de meio-tile de 96 px; 4 linhas de 192 px.
  const gg = L.criarGrelha(6, 4, [192, 192, 192, 192, 192, 96], [192, 192, 192, 192]);
  const px = L.pxPorPorta({ tipo: "eth", bits: 8, hz: 60 });
  const s = L.sugerir(gg, px, "baixo", ESC);
  for (const sug of s.sugestoes) {
    assert.ok(celulasUnicas(gg, sug.esq));
    assert.equal(sug.m.sobre, 0);
    const soma = sug.esq.portas.reduce((a, p) => a + p.px, 0);
    assert.equal(soma, gg.total, "a soma dos píxeis das portas é o total");
  }
});

test("um cabinet que sozinho excede a porta fica assinalado (sobre > 0)", () => {
  const gg = L.grelhaUniforme(4, 2, 192, 192);
  const esq = L.construir(gg, { canto: "SE", eixo: "linhas", padrao: "serp", forma: "equilibrada", bloco: null }, 10000);
  const m = L.medir(gg, esq, "baixo", 10000, ESC);
  assert.equal(m.sobre, 8, "as 8 portas (um cabinet cada) passam a capacidade");
  assert.ok(celulasUnicas(gg, esq));
});

test("sugestões: a principal é a mais fácil; alternativas só se tiverem vantagem real", () => {
  const px = L.pxPorPorta({ tipo: "eth", bits: 8, hz: 60 });
  const s = L.sugerir(g, px, "baixo", ESC);
  assert.equal(s.sugestoes[0].chave, "facil");
  assert.ok(s.sugestoes.length >= 1 && s.sugestoes.length <= 3);
  const sigs = new Set(s.sugestoes.map((x) => x.m.sig));
  assert.equal(sigs.size, s.sugestoes.length, "sem sugestões repetidas");
  s.sugestoes.slice(1).forEach((alt) => {
    const p = s.sugestoes[0].m;
    const vantagem = alt.m.P < p.P || alt.m.cabo < p.cabo * 0.97 || (alt.chave === "simples" && alt.m.tipo === "faixas");
    assert.ok(vantagem, "a alternativa " + alt.chave + " tem de ter uma vantagem");
  });
  s.sugestoes.forEach((x) => { assert.ok(x.razao.length > 10 && x.desc.length > 10); });
});

// ---------------------------------------------------------------- divisão do sinal
const dados = ler("data/transportes.json");
const lista = L.montarTransportes(dados, ler("data/processors.json"));
const T = (id) => lista.find((t) => t.id === id);

function dividir(bits, hz, gbps, margem = 100) {
  const px = L.pxPorPorta({ tipo: "eth", bits, hz });
  const esq = L.sugerir(g, px, "baixo", ESC).sugestoes[0].esq;
  const cap = gbps * margem / 100;
  return { r: L.dividirLigacoes(esq.portas, L.debitoGbps(g.total, hz, bits, 3) / g.total, cap), esq, cap, total: L.debitoGbps(g.total, hz, bits, 3) };
}

test("divisão: HDMI 2.0 18, Blustream IP500 10, UBEX 2×10 G (20) e Ethernet 25 a 8, 10 e 12 bits", () => {
  const esperado = { // nº de ligações = ceil(débito ÷ capacidade)
    hdmi20: { 8: 1, 10: 1, 12: 2 },        // 12,10 · 15,13 · 18,15 (> 18 -> 2)
    "bs-ip500": { 8: 2, 10: 2, 12: 2 },    // 12,10 ÷ 10 · 15,13 ÷ 10 · 18,15 ÷ 10
    "lw-ubex-2x10": { 8: 1, 10: 1, 12: 1 },// 20 Gb/s cobrem os 18,15
    eth25: { 8: 1, 10: 1, 12: 1 }
  };
  for (const id of Object.keys(esperado)) {
    const t = T(id), nome = id;
    assert.ok(t && t.gbps > 0, "transporte " + id);
    for (const bits of [8, 10, 12]) {
      const { r, cap, total, esq } = dividir(bits, 60, t.gbps);
      assert.equal(r.estado, "ok");
      assert.equal(r.n, esperado[id][bits], `${nome} a ${bits} bits`);
      r.grupos.forEach((x) => assert.ok(x.rate <= cap + 1e-9, `${nome}/${bits}: nenhuma ligação acima da capacidade`));
      const soma = r.grupos.reduce((a, x) => a + x.rate, 0);
      assert.ok(Math.abs(soma - total) < 1e-9, `${nome}/${bits}: a soma das ligações é o débito total`);
      // equilíbrio: as ligações diferem, no máximo, de uma porta
      const rates = r.grupos.map((x) => x.rate), umaPorta = Math.max(...esq.portas.map((p) => p.px)) * total / g.total;
      assert.ok(Math.max(...rates) - Math.min(...rates) <= umaPorta + 1e-9, `${nome}/${bits}: ligações equilibradas`);
      // as portas ficam todas atribuídas, sem buracos nem repetições
      const vistas = [];
      r.grupos.forEach((x) => { for (let i = x.ini; i <= x.fim; i++) vistas.push(i); });
      assert.deepEqual(vistas, esq.portas.map((_, i) => i));
    }
  }
});

test("divisão: 1, 10 e 25 Gb/s; mais capacidade -> menos ligações; 1G -> mais", () => {
  for (const bits of [8, 10, 12]) {
    const n = [1, 10, 25].map((gb) => {
      const { r, cap, total } = dividir(bits, 60, gb);
      r.grupos.forEach((x) => assert.ok(x.rate <= cap + 1e-9));
      assert.ok(Math.abs(r.grupos.reduce((a, x) => a + x.rate, 0) - total) < 1e-9);
      assert.ok(r.n >= Math.ceil(total / cap - 1e-9));
      return r.n;
    });
    assert.ok(n[0] > n[1] && n[1] >= n[2], `1G > 10G >= 25G ligações a ${bits} bits: ${n}`);
  }
});

test("divisão: margem de segurança (80 %) reduz o usável e aumenta as ligações sem passar o limite", () => {
  for (const bits of [8, 10, 12]) {
    const cheio = dividir(bits, 60, 10, 100), margem = dividir(bits, 60, 10, 80);
    assert.ok(margem.r.n >= cheio.r.n);
    margem.r.grupos.forEach((x) => assert.ok(x.rate <= 8 + 1e-9, "com 80 % nenhuma ligação passa 8 Gb/s"));
  }
  // 12 bits a 10 Gb/s: 18,15 ÷ 8 = 2,27 -> 3 ligações com 80 %
  assert.equal(dividir(12, 60, 10, 80).r.n, 3);
});

test("divisão: sem capacidade -> «sem dados»; uma porta acima da capacidade fica assinalada", () => {
  const px = L.pxPorPorta({ tipo: "eth", bits: 8, hz: 60 });
  const esq = L.sugerir(g, px, "baixo", ESC).sugestoes[0].esq;
  assert.equal(L.dividirLigacoes(esq.portas, 1e-9, null).estado, "sem-dados");
  const r = L.dividirLigacoes(esq.portas, L.debitoGbps(g.total, 60, 8, 3) / g.total, 0.1); // porta ~0,87 Gb/s > 0,1
  assert.ok(r.max > 0.1, "cada porta sozinha passa 0,1 Gb/s: fica acima e tem de ser visível");
  assert.equal(r.n, esq.portas.length);
});

test("comparação de transportes: ligações por transporte e aviso acima do débito útil", () => {
  const { esq } = dividir(10, 60, 18);
  const tab = L.tabelaTransportes(esq.portas, L.debitoGbps(g.total, 60, 10, 3) / g.total, lista, 100);
  const por = Object.fromEntries(tab.map((l) => [l.t.id, l]));
  assert.equal(por["lw-optc"].n, 1);
  assert.equal(por["bs-ip500"].n, 2);
  assert.equal(por.eth25.n, 1);
  // HDMI 2.0: 15,13 Gb/s cabem nos 18 nominais mas passam os 14,4 úteis da fonte
  assert.equal(por.hdmi20.aviso, "acima-util");
  assert.equal(por["lw-optc"].aviso, null, "a ficha da Lightware não dá débito útil: sem aviso inventado");
  tab.forEach((l) => { if (l.r.estado === "ok") l.r.grupos.forEach((x) => assert.ok(x.rate <= l.cap + 1e-9)); });
});

// ---------------------------------------------------------------- dados dos transportes
test("transportes.json: tudo com fonte, default 10G, sem «indicado pelo Mike»; os do fabricante com URL e data", () => {
  const ts = dados.transportes;
  ts.forEach((t) => {
    assert.ok(t.gbps > 0, t.id + " tem capacidade");
    assert.ok(t.fonte && /^https:\/\//.test(t.fonte), t.id + " tem fonte (URL)");
    assert.ok(t.nota && t.nota.length > 5, t.id + " tem nota");
    assert.ok(!t.indicadoPeloMike, t.id + ": nenhum valor vem «indicado pelo Mike»");
    if (t.gbpsUtil) assert.ok(t.gbpsUtil < t.gbps, t.id + ": o útil é menor que o nominal");
  });
  assert.ok(!/indicad[oa] pelo Mike/i.test(JSON.stringify(dados)), "o ficheiro já não fala em «indicado pelo Mike»");
  assert.ok(!T("lightware18") && !T("blustream10"), "os dois presets por palpite saíram");
  assert.deepEqual(ts.filter((t) => t.padrao).map((t) => t.id), ["eth10"]);
  // Cada valor do fabricante: capacidade, tipo de ligação (no nome), URL e data de consulta. Valores lidos nas
  // fichas/manuais/páginas oficiais em 2026-11-06 (a frase de origem está em `nota`).
  const fab = {
    "lw-ubex-1x10": [10, /lightware\.com/, /SFP\+/], "lw-ubex-2x10": [20, /lightware\.com/, /2 × .*SFP\+/],
    "lw-optc": [18, /lightware\.com/, /multimodo/], "lw-optj": [18, /lightware\.com/, /multimodo/],
    "lw-tpx": [18, /lightware\.com/, /CATx/], "lw-tps": [10.2, /lightware\.com/, /HDBaseT/],
    "lw-3dopt": [9, /lightware\.com/, /multimodo/], "lw-dpopt": [10.8, /lightware\.com/, /DisplayPort/],
    "lw-mx2": [18, /lightware\.com/, /matriz/], "lw-vinx120": [0.8, /lightware\.com/, /IP/],
    "bs-ip500": [10, /blustream\.com/, /SDVoE/], "bs-ip510": [10, /blustream\.com/, /SDVoE/],
    "bs-fve4k": [10, /blustream/, /SFP\+/], "bs-ip300": [1, /blustream/, /IP/], "bs-hex18g": [18, /blustream/, /HDBaseT/]
  };
  Object.entries(fab).forEach(([id, [gbps, url, tipo]]) => {
    const t = T(id);
    assert.ok(t, id);
    assert.equal(t.gbps, gbps, id + ": capacidade da ficha");
    assert.equal(t.confianca, "fabricante");
    assert.match(t.fonte, url, id + ": URL do fabricante");
    assert.match(t.nome, tipo, id + ": o nome diz o tipo de ligação");
    assert.equal(t.consultado, "2026-11-06");
    assert.match(t.grupo, id.startsWith("lw-") ? /^Lightware/ : /^Blustream/);
    assert.ok(!/^Ethernet/.test(t.nome), id + ": não é «Ethernet» genérico");
  });
  // «sem dados» dito onde a ficha não dá o débito real
  assert.match(T("bs-ip500").nota, /sem dados/);
  assert.match(T("bs-ip300").nota, /sem dados/);
  // grupos e ordem: por família, e dentro de cada uma pela capacidade
  const grupos = [...new Set(lista.map((t) => t.grupo))];
  assert.deepEqual(grupos.slice(0, 6), dados.grupos);
  assert.equal(grupos[grupos.length - 1], L.GRUPO_PROC);
  grupos.forEach((gr) => {
    const gs = lista.filter((t) => t.grupo === gr).map((t) => t.gbps);
    assert.deepEqual(gs, [...gs].sort((a, b) => a - b), gr + " ordenado por capacidade");
  });
  assert.equal(lista.filter((t) => t.grupo === dados.grupos[0]).length > 0 && lista[0].grupo, dados.grupos[0]);
  // 18 Gb/s é também o nominal do HDMI 2.0 e 10 o da Ethernet 10G
  assert.equal(T("hdmi20").gbps, T("lw-optc").gbps);
  assert.equal(T("eth10").gbps, T("bs-ip500").gbps);
});

test("transportes.json repete o que já estava em fibra.json (sem divergir)", () => {
  const fibra = ler("data/fibra.json");
  const eth = (nome) => fibra.oticas.find((o) => o.nome === nome).gbps;
  assert.equal(T("eth1").gbps, eth("1000BASE-SX"));
  assert.equal(T("eth10").gbps, eth("10GBASE-SR"));
  assert.equal(T("eth25").gbps, eth("25GBASE-SR"));
  assert.equal(T("eth100").gbps, eth("100GBASE-SR4"));
  const sdi = (prefixo) => fibra.custos_de_banda["vídeo"].find((v) => v.nome.startsWith(prefixo)).mbps / 1000;
  assert.equal(T("sdi3g").gbps, sdi("3G-SDI"));
  assert.equal(T("sdi6g").gbps, sdi("6G-SDI"));
  assert.equal(T("sdi12g").gbps, sdi("12G-SDI"));
});

test("saídas óticas dos processadores entram só com o débito que o processors.json já tem", () => {
  const proc = ler("data/processors.json");
  const procs = proc.ledProcessors.concat(proc.switchers);
  const comOptica = procs.filter((p) => p.optica && p.optica.gbps > 0);
  const dinamicos = lista.filter((t) => t.id.startsWith("proc-"));
  assert.equal(dinamicos.length, comOptica.length);
  comOptica.forEach((p) => {
    const t = dinamicos.find((d) => d.nome === p.marca + " " + p.modelo + " · saída ótica");
    assert.ok(t, p.modelo);
    assert.equal(t.gbps, p.optica.gbps);
  });
  assert.ok(!procs.some((p) => p.modelo === "MCTRL4K" && p.optica && p.optica.gbps > 0), "MCTRL4K não tem débito por fibra nos dados: não entra");
});
