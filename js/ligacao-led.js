// LIGAÇÃO DOS CABINETS DO ECRÃ LED — capacidade por porta, desenho do cabo e
// divisão do sinal por ligações (aba «Ecrã LED & Pixel Pitch»).
//
// Pedido do Mike: incluir na aba do ecrã LED a conta que a aba «Sinal & Data
// Rate» já faz (quantos CABINETS cabem em cada porta, dados o refresh e a
// profundidade de cor) e DESENHAR a forma de ligação: de onde se começa, por
// onde vai o cabo, onde entra o sinal; e dividir o sinal total por ligações de
// uma capacidade escolhida (10 Gb/s por omissão) sem passar o limite.
//
// REGRAS QUE ESTE FICHEIRO CUMPRE
//  - Nenhum dado técnico novo. A capacidade de uma porta vem do que a aba
//    Sinal já usa (930 Mbit/s úteis por porta GigE, `portGbpsUsable` de cada
//    processador em data/processors.json, 24 bpp a 8-bit e 48 bpp a 10/12-bit
//    — a contagem da NovaStar) e a capacidade das ligações vem de
//    data/transportes.json, onde cada valor tem fonte. O que faltar mostra-se
//    como «sem dados».
//  - O débito do sinal é a MESMA conta do `debitoGbps()` da aba Sinal
//    (bits × 3 canais × Hz × píxeis), injetada por `configurar()`; sem ela
//    cai na fórmula idêntica, para os testes correrem sem página.
//  - As pontuações que ordenam as sugestões são critérios de ordenação
//    (menos retornos, percursos regulares, menos cabo…), não dados técnicos.
//
// ESTRUTURA: a primeira metade são contas puras (testáveis em Node); a segunda
// é a interface (só corre com `document`).
(function (root) {
  "use strict";

  var BITS_PX = { "8": 24, "10": 48, "12": 48 };
  var USABLE_BPS = 930000000;
  var EPS = 1e-9;
  var deps = {};

  function configurar(d) { deps = d || {}; if (d && d.BITS_PER_PIXEL) BITS_PX = d.BITS_PER_PIXEL; if (d && d.USABLE_BPS) USABLE_BPS = d.USABLE_BPS; }

  // ================================================================ CONTAS PURAS

  function debitoGbps(px, hz, bits, amostras) {
    amostras = amostras == null ? 3 : amostras;
    if (deps.debitoGbps) return deps.debitoGbps(px, hz, bits, amostras);
    if (!(px > 0) || !(hz > 0) || !(bits > 0)) return null;
    return (bits * amostras * hz * px) / 1e9;
  }

  /** Píxeis que cabem numa porta: a conta da aba Sinal (ver calcSinal). */
  function pxPorPorta(o) {
    if (o.tipo === "manual") return o.manualPx > 0 ? Math.floor(o.manualPx) : null;
    if (o.tipo === "fibra") return null;                 // sem dados na app
    if (!(o.hz > 0)) return null;
    var bpp = BITS_PX[String(o.bits)] || 24;
    var bps = o.portGbpsUsable ? o.portGbpsUsable * 1e9 : (o.usableBps || USABLE_BPS);
    return Math.floor(bps / (bpp * o.hz));
  }

  /** A grelha de cabinets. colPx/rowPx = píxeis de cada coluna/linha (meios-tiles incluídos). */
  function criarGrelha(C, R, colPx, rowPx) {
    var g = { C: C, R: R, colPx: colPx, rowPx: rowPx, total: 0, maxPx: 0 };
    for (var c = 0; c < C; c++) for (var r = 0; r < R; r++) {
      var p = colPx[c] * rowPx[r];
      g.total += p;
      if (p > g.maxPx) g.maxPx = p;
    }
    g.px = function (cel) { return g.colPx[cel.c] * g.rowPx[cel.r]; };
    return g;
  }

  /** Uma grelha simples: C × R cabinets iguais de rx × ry píxeis. */
  function grelhaUniforme(C, R, rx, ry) {
    var colPx = [], rowPx = [], i;
    for (i = 0; i < C; i++) colPx.push(rx);
    for (i = 0; i < R; i++) rowPx.push(ry);
    return criarGrelha(C, R, colPx, rowPx);
  }

  // ---- percursos --------------------------------------------------------
  // Quadro de caminhada: canto de partida + eixo. «linhas» = anda ao longo de
  // uma linha e passa à seguinte; «colunas» = o mesmo, por colunas.
  var CANTOS = { SE: "superior esquerdo", SD: "superior direito", IE: "inferior esquerdo", ID: "inferior direito" };

  function quadro(g, cfg) {
    var porLinhas = cfg.eixo !== "colunas";
    var fy = cfg.canto.charAt(0) === "I", fx = cfg.canto.charAt(1) === "D";
    var U = porLinhas ? g.C : g.R, V = porLinhas ? g.R : g.C;
    return {
      U: U, V: V,
      cel: function (u, v) {
        var a = porLinhas ? u : v, b = porLinhas ? v : u;
        return { c: fx ? g.C - 1 - a : a, r: fy ? g.R - 1 - b : b };
      }
    };
  }

  /** Percorre um retângulo [u0,u1)×[v0,v1) fila a fila; serp = sentido alterna. */
  function retangulo(q, u0, u1, v0, v1, serp) {
    var out = [];
    for (var v = v0; v < v1; v++) {
      var inverte = serp && ((v - v0) % 2 === 1);
      for (var i = 0; i < u1 - u0; i++) {
        var u = inverte ? u1 - 1 - i : u0 + i;
        out.push(q.cel(u, v));
      }
    }
    return out;
  }

  /** Corta uma cadeia em portas. «cheia»: enche uma e passa à seguinte. «equilibrada»: o mesmo nº de portas, com o mesmo peso em cada. */
  function cortar(seq, pxDe, portPx, forma) {
    var grupos = [], atual = [], soma = 0;
    seq.forEach(function (cel) {
      var p = pxDe(cel);
      if (atual.length && soma + p > portPx + EPS) { grupos.push(atual); atual = []; soma = 0; }
      atual.push(cel); soma += p;
    });
    if (atual.length) grupos.push(atual);
    if (forma !== "equilibrada" || grupos.length <= 1) return grupos;
    var P = grupos.length, total = 0;
    seq.forEach(function (cel) { total += pxDe(cel); });
    var meta = total / P, novos = [], acum = 0;
    for (var i = 0; i < P; i++) novos.push([]);
    seq.forEach(function (cel) {
      var p = pxDe(cel);
      var idx = Math.min(P - 1, Math.floor((acum + p / 2) / meta + EPS));
      novos[idx].push(cel);
      acum += p;
    });
    novos = novos.filter(function (n) { return n.length; });
    var cabe = novos.every(function (n) {
      var s = 0; n.forEach(function (cel) { s += pxDe(cel); });
      return s <= portPx + EPS || n.length === 1;
    });
    return cabe ? novos : grupos;
  }

  /** Formas de bloco regulares: (w ao longo da fila, h em filas) com w×h ≤ K, sem repetidas. */
  function formasDeBloco(U, V, K) {
    var vistas = {}, out = [];
    for (var bh = 1; bh <= Math.min(V, K); bh++) {
      var bw0 = Math.min(U, Math.floor(K / bh));
      if (bw0 < 1) continue;
      var k = Math.ceil(U / bw0), bw = Math.ceil(U / k);
      var m = Math.ceil(V / bh), bh2 = Math.ceil(V / m);
      if (bh2 * bw <= K) bh = bh2 > bh ? bh : bh;       // (mantém bh; bh2 só equilibra abaixo)
      var forma = [{ w: bw, h: bh }];
      if (bh2 * bw <= K && bh2 !== bh) forma.push({ w: bw, h: bh2 });
      forma.forEach(function (f) {
        var chave = f.w + "x" + f.h;
        if (!vistas[chave]) { vistas[chave] = 1; out.push(f); }
      });
    }
    return out;
  }
  function nBlocos(U, V, f) { return Math.ceil(U / f.w) * Math.ceil(V / f.h); }
  function melhorBloco(U, V, K) {
    var fs = formasDeBloco(U, V, Math.max(1, K));
    fs.sort(function (a, b) { return nBlocos(U, V, a) - nBlocos(U, V, b) || b.w - a.w || a.h - b.h; });
    return fs[0] || { w: 1, h: 1 };
  }

  /** O esquema inteiro: lista de portas, cada uma com a sua fila de cabinets. */
  function construir(g, cfg, portPx) {
    var q = quadro(g, cfg), serp = cfg.padrao !== "retorno", grupos = [], bloco = null;
    var K = Math.max(1, Math.floor((portPx + EPS) / (g.maxPx || 1)));
    if (cfg.forma === "blocos") {
      bloco = cfg.bloco && cfg.bloco.w * cfg.bloco.h <= K ? cfg.bloco : melhorBloco(q.U, q.V, K);
      for (var v0 = 0; v0 < q.V; v0 += bloco.h) for (var u0 = 0; u0 < q.U; u0 += bloco.w) {
        grupos.push(retangulo(q, u0, Math.min(q.U, u0 + bloco.w), v0, Math.min(q.V, v0 + bloco.h), serp));
      }
    } else {
      grupos = cortar(retangulo(q, 0, q.U, 0, q.V, serp), g.px, portPx, cfg.forma === "cheia" ? "cheia" : "equilibrada");
    }
    var portas = grupos.map(function (cels) {
      var px = 0; cels.forEach(function (cel) { px += g.px(cel); });
      return { cels: cels, px: px };
    });
    return { cfg: cfg, bloco: bloco, portas: portas, q: q, K: K };
  }

  /** O ponto de entrada do sinal (em unidades de cabinet, fora do ecrã). */
  function pontoEntrada(g, lado) {
    if (lado === "topo") return { x: g.C / 2, y: 0 };
    if (lado === "esq") return { x: 0, y: g.R / 2 };
    if (lado === "dir") return { x: g.C, y: g.R / 2 };
    return { x: g.C / 2, y: g.R };
  }

  /** Mede um esquema: enchimento, retornos, comprimento de cabo (em cabinets ou metros). */
  function medir(g, esq, lado, portPx, esc) {
    esc = esc || { cw: 1, ch: 1 };
    var E = pontoEntrada(g, lado), portas = esq.portas;
    var m = { P: portas.length, retornos: 0, cabo: 0, feedTotal: 0, caboPorPorta: [], tam: [], fill: [], sobre: 0 };
    portas.forEach(function (p) {
      var first = p.cels[0];
      var feed = Math.abs(first.c + 0.5 - E.x) * esc.cw + Math.abs(first.r + 0.5 - E.y) * esc.ch;
      var intra = 0, saltos = 0;
      for (var i = 1; i < p.cels.length; i++) {
        var a = p.cels[i - 1], b = p.cels[i];
        var dx = Math.abs(a.c - b.c), dy = Math.abs(a.r - b.r);
        intra += dx * esc.cw + dy * esc.ch;
        if (dx + dy !== 1) saltos++;
      }
      p.feed = feed; p.intra = intra; p.saltos = saltos; p.fill = portPx > 0 ? p.px / portPx * 100 : null;
      m.retornos += saltos; m.feedTotal += feed; m.cabo += feed + intra;
      m.caboPorPorta.push(feed + intra); m.tam.push(p.cels.length);
      if (p.fill != null) { m.fill.push(p.fill); if (p.px > portPx + EPS) m.sobre++; }
    });
    var soma = function (a) { return a.reduce(function (s, x) { return s + x; }, 0); };
    m.fillMed = m.fill.length ? soma(m.fill) / m.fill.length : null;
    m.fillMin = m.fill.length ? Math.min.apply(null, m.fill) : null;
    m.fillMax = m.fill.length ? Math.max.apply(null, m.fill) : null;
    m.tamMin = Math.min.apply(null, m.tam); m.tamMax = Math.max.apply(null, m.tam);
    m.spread = m.tamMax - m.tamMin;
    var cmed = soma(m.caboPorPorta) / m.P;
    m.desequilibrioCabo = cmed > 0 ? (Math.max.apply(null, m.caboPorPorta) - Math.min.apply(null, m.caboPorPorta)) / cmed : 0;
    m.feedMed = m.feedTotal / m.P;
    var f0 = portas[0].cels[0];
    m.inicioNoLado = lado === "topo" ? f0.r === 0 : lado === "esq" ? f0.c === 0 : lado === "dir" ? f0.c === g.C - 1 : f0.r === g.R - 1;
    var comp = esq.bloco ? (esq.bloco.w >= esq.q.U ? "faixas" : "retangulos") : "cadeia";
    m.tipo = comp;
    m.sig = [esq.cfg.canto, esq.cfg.eixo, esq.cfg.padrao, esq.cfg.forma, esq.bloco ? esq.bloco.w + "x" + esq.bloco.h : ""].join("|");
    return m;
  }

  // ---- candidatos e sugestões -----------------------------------------
  function candidatos(g, portPx, lado, esc) {
    var out = [];
    var K = Math.max(1, Math.floor((portPx + EPS) / (g.maxPx || 1)));
    ["SE", "SD", "IE", "ID"].forEach(function (canto) {
      ["linhas", "colunas"].forEach(function (eixo) {
        ["serp", "retorno"].forEach(function (padrao) {
          var q = quadro(g, { canto: canto, eixo: eixo });
          var base = { canto: canto, eixo: eixo, padrao: padrao };
          var cfgs = [Object.assign({ forma: "equilibrada", bloco: null }, base)];
          formasDeBloco(q.U, q.V, K).forEach(function (f) { cfgs.push(Object.assign({ forma: "blocos", bloco: f }, base)); });
          cfgs.forEach(function (cfg) {
            var esq = construir(g, cfg, portPx);
            out.push({ cfg: cfg, esq: esq, m: medir(g, esq, lado, portPx, esc) });
          });
        });
      });
    });
    var Pmin = Math.min.apply(null, out.map(function (c) { return c.m.P; }));
    out.forEach(function (c) {
      var m = c.m;
      var rel = m.spread / Math.max(1, (m.tamMin + m.tamMax) / 2);
      var pen = m.tipo === "faixas" ? 0 : m.tipo === "retangulos" ? 1.5 : 3;
      // Critério de ordenação (não é um dado técnico): quanto MENOR, mais fácil de montar e explicar.
      m.facil = (m.retornos > 0 ? 6 + 0.25 * m.retornos : 0) + 6 * Math.max(0, rel - 0.1) + 1.0 * (m.P - Pmin) +
        8 * (m.feedMed / (g.C + g.R)) + 6 * m.desequilibrioCabo + pen + (m.inicioNoLado ? 0 : 2);
    });
    return { lista: out, Pmin: Pmin };
  }

  /** Medidas de um bloco em termos do ecrã (colunas × linhas), seja qual for o eixo. */
  function blocoNoEcra(cfg, bloco) {
    return cfg.eixo === "colunas" ? { cols: bloco.h, lin: bloco.w } : { cols: bloco.w, lin: bloco.h };
  }
  function descreverCfg(cfg, bloco) {
    var b = bloco ? blocoNoEcra(cfg, bloco) : null;
    var forma = cfg.forma === "blocos" && b ? "blocos de " + b.cols + (b.cols === 1 ? " coluna × " : " colunas × ") + b.lin + (b.lin === 1 ? " linha" : " linhas")
      : cfg.forma === "cheia" ? "portas cheias (a última sai mais vazia)" : "portas com o mesmo nº de cabinets";
    return "começa no canto " + CANTOS[cfg.canto] + ", " + (cfg.eixo === "colunas" ? "por colunas" : "por linhas") + ", " +
      (cfg.padrao === "retorno" ? "com retorno (volta ao início de cada fila)" : "em S (serpentina)") + ", " + forma;
  }

  function sugerir(g, portPx, lado, esc) {
    var cd = candidatos(g, portPx, lado, esc), lista = cd.lista, escolhidas = [];
    var porFacil = lista.slice().sort(function (a, b) { return a.m.facil - b.m.facil || a.m.P - b.m.P || a.m.cabo - b.m.cabo; });
    var prin = porFacil[0];
    escolhidas.push({ chave: "facil", cfg: prin.cfg, esq: prin.esq, m: prin.m });
    var alt = [];
    function juntar(chave, filtro, cmp) {
      var cs = lista.filter(filtro).sort(cmp);
      if (cs.length) alt.push({ chave: chave, cfg: cs[0].cfg, esq: cs[0].esq, m: cs[0].m });
    }
    // Cada alternativa só aparece se tiver mesmo uma vantagem sobre a principal.
    juntar("portas", function (c) { return c.m.P < prin.m.P; },
      function (a, b) { return a.m.P - b.m.P || a.m.facil - b.m.facil; });
    juntar("cabo", function (c) { return c.m.cabo < prin.m.cabo * 0.97; },
      function (a, b) { return a.m.cabo - b.m.cabo || a.m.P - b.m.P; });
    juntar("simples", function (c) { return c.m.tipo === "faixas" && c.m.retornos === 0 && prin.m.tipo !== "faixas"; },
      function (a, b) { return a.m.facil - b.m.facil; });
    juntar("equilibrio", function (c) {
      return c.m.P <= prin.m.P && c.m.retornos <= prin.m.retornos && c.m.spread + c.m.desequilibrioCabo * 10 < prin.m.spread + prin.m.desequilibrioCabo * 10 - 0.5;
    }, function (a, b) { return (a.m.spread + a.m.desequilibrioCabo * 10) - (b.m.spread + b.m.desequilibrioCabo * 10) || a.m.P - b.m.P; });
    alt.forEach(function (c) {
      var igual = escolhidas.some(function (e) { return e.m.sig === c.m.sig; });
      if (!igual && escolhidas.length < 3) escolhidas.push(c);
    });
    escolhidas.forEach(function (s) { s.razao = razao(s, escolhidas[0], cd.Pmin, g, lado); s.desc = descreverCfg(s.cfg, s.esq.bloco); });
    return { sugestoes: escolhidas, Pmin: cd.Pmin };
  }

  var LADOS = { topo: "por cima", baixo: "por baixo", esq: "pela esquerda", dir: "pela direita" };

  function razao(s, prin, Pmin, g, lado) {
    var m = s.m;
    var gabs = m.tamMin === m.tamMax ? String(m.tamMax) : m.tamMin + "–" + m.tamMax;
    if (s.chave === "facil") {
      return "Percurso regular: " + (m.retornos === 0 ? "sem retornos" : m.retornos + " retornos") +
        (m.tipo === "faixas" ? ", cada porta leva filas inteiras" : m.tipo === "retangulos" ? ", cada porta leva um bloco retangular" : ", uma só cadeia cortada em partes iguais") +
        ", " + gabs + " cabinets por porta" +
        (m.P > Pmin ? " (" + (m.P - Pmin) + (m.P - Pmin === 1 ? " porta a mais" : " portas a mais") + " do que o mínimo possível)" : " (o mínimo possível de portas)") +
        " e entrada " + LADOS[lado] + ".";
    }
    if (s.chave === "portas") {
      return "Usa menos portas: " + m.P + " em vez de " + prin.m.P + (m.tipo === "cadeia" ? ", mas o cabo é cortado a meio das filas." : ".");
    }
    if (s.chave === "cabo") {
      return "Gasta menos cabo desde a entrada (menos " + Math.round((1 - m.cabo / prin.m.cabo) * 100) + " % do que a principal), com " + m.P + " portas.";
    }
    if (s.chave === "simples") {
      var extra = m.P - prin.m.P;
      return "Cada porta leva filas inteiras (" + gabs + " cabinets): a mais simples de explicar à equipa" +
        (extra > 0 ? ", à custa de " + extra + (extra === 1 ? " porta a mais" : " portas a mais") + " do que a principal." : ".");
    }
    return "A mais equilibrada: portas com " + gabs + " cabinets e cabos de comprimentos parecidos.";
  }

  // ---- divisão do sinal por ligações -----------------------------------
  /**
   * Reparte as portas (por ordem) em L ligações contíguas, o mais iguais possível.
   * gbpsPorPx = débito de 1 píxel; cap = capacidade EFETIVA de cada ligação (Gb/s).
   */
  function dividirLigacoes(portas, gbpsPorPx, cap) {
    var n = portas.length, rates = portas.map(function (p) { return p.px * gbpsPorPx; });
    var total = rates.reduce(function (s, x) { return s + x; }, 0);
    if (!(cap > 0) || !n) return { estado: "sem-dados", total: total };
    var L0 = Math.max(1, Math.ceil(total / cap - 1e-9)), L, grupos;
    function partir(L) {
      var meta = total / L, acum = 0, gs = [];
      for (var i = 0; i < L; i++) gs.push({ ini: -1, fim: -1, rate: 0 });
      rates.forEach(function (r, i) {
        var idx = Math.min(L - 1, Math.floor((acum + r / 2) / meta + EPS));
        var gr = gs[idx];
        if (gr.ini < 0) gr.ini = i;
        gr.fim = i; gr.rate += r; acum += r;
      });
      return gs.filter(function (x) { return x.ini >= 0; });
    }
    for (L = L0; L <= n; L++) {
      grupos = partir(L);
      if (grupos.every(function (x) { return x.rate <= cap + 1e-9; })) break;
    }
    if (L > n) grupos = rates.map(function (r, i) { return { ini: i, fim: i, rate: r }; });
    return { estado: "ok", total: total, grupos: grupos, n: grupos.length, minimo: L0, max: Math.max.apply(null, grupos.map(function (x) { return x.rate; })) };
  }

  /** Quantas ligações cada transporte pediria (só conta, sem repartir porta a porta). */
  function ligacoesPorTransporte(total, lista, margemPct) {
    return lista.map(function (t) {
      var cap = t.gbps * (margemPct / 100);
      return { id: t.id, nome: t.nome, gbps: t.gbps, n: cap > 0 ? Math.max(1, Math.ceil(total / cap - 1e-9)) : null };
    });
  }

  /**
   * A lista de transportes: os de data/transportes.json mais as saídas óticas dos
   * processadores de LED que a app já conhece (processors.json › optica.gbps).
   */
  var GRUPO_PROC = "Saídas óticas dos processadores de LED";
  function montarTransportes(dados, processadores) {
    var lista = ((dados && dados.transportes) || []).map(function (t) { return Object.assign({}, t); });
    var vistos = {};
    var aparelhos = ((processadores && processadores.ledProcessors) || []).concat((processadores && processadores.switchers) || []);
    aparelhos.forEach(function (p) {
      if (!p.optica || !(p.optica.gbps > 0)) return;
      var id = "proc-" + (p.marca + "-" + p.modelo).toLowerCase().replace(/[^a-z0-9]+/g, "-");
      if (vistos[id]) return; vistos[id] = 1;
      lista.push({
        id: id, grupo: GRUPO_PROC, nome: p.marca + " " + p.modelo + " · saída ótica",
        gbps: p.optica.gbps, origem: "processors.json › optica", confianca: "dados da app",
        fonte: p.optica.fonte || p.fonte || null,
        nota: "Débito nominal da saída ótica deste aparelho, tal como está em processors.json." + (p.optica.nota ? " " + p.optica.nota : "")
      });
    });
    // Ordem: as famílias pela ordem de `dados.grupos`, e dentro de cada uma pela capacidade
    // (depois pelo nome), para se encontrar depressa; a ordem de origem desempata.
    var ordem = ((dados && dados.grupos) || []).concat([GRUPO_PROC]);
    var rank = function (g) { var i = ordem.indexOf(g); return i < 0 ? ordem.length : i; };
    lista.forEach(function (t, i) { t._i = i; });
    lista.sort(function (a, b) { return rank(a.grupo) - rank(b.grupo) || a.gbps - b.gbps || String(a.nome).localeCompare(String(b.nome), "pt") || a._i - b._i; });
    lista.forEach(function (t) { delete t._i; });
    return lista;
  }

  /** Para cada transporte: ligações, enchimento máximo e aviso (tabela de comparação). */
  function tabelaTransportes(portas, gbpsPorPx, lista, margemPct) {
    return lista.map(function (t) {
      var cap = t.gbps * (margemPct / 100);
      var r = dividirLigacoes(portas, gbpsPorPx, cap);
      var linha = { t: t, cap: cap, r: r, n: r.n, maxRate: r.max, fillMax: r.max != null ? r.max / t.gbps * 100 : null, aviso: null };
      if (r.estado === "ok") {
        if (r.max > cap + 1e-9) linha.aviso = "acima";
        else if (t.gbpsUtil && r.max > t.gbpsUtil + 1e-9) linha.aviso = "acima-util";
      }
      return linha;
    });
  }

  // ---- as três colunas 8/10/12 ----------------------------------------
  function tabelaBits(ent) {
    var out = [];
    [8, 10, 12].forEach(function (bits) {
      var portPx = pxPorPorta({ tipo: ent.tipoPorta, usableBps: ent.usableBps, portGbpsUsable: ent.portGbpsUsable, bits: bits, hz: ent.hz, manualPx: ent.pxManual });
      var linha = { bits: bits, debito: debitoGbps(ent.g.total, ent.hz, bits, 3), portPx: portPx };
      if (portPx) {
        linha.K = Math.floor((portPx + EPS) / ent.g.maxPx);
        if (linha.K >= 1) {
          var s = sugerir(ent.g, portPx, ent.lado, ent.esc).sugestoes[0];
          linha.P = s.m.P; linha.fillMin = s.m.fillMin; linha.fillMax = s.m.fillMax; linha.fillMed = s.m.fillMed;
          linha.esq = s;
        }
        if (ent.cap > 0) linha.lig = dividirLigacoes(linha.esq ? linha.esq.esq.portas : [], linha.debito / ent.g.total, ent.cap);
        else if (ent.cap === 0) linha.lig = null;
        if (!linha.esq && ent.cap > 0) linha.lig = dividirLigacoes([{ px: ent.g.total }], linha.debito / ent.g.total, ent.cap);
      }
      out.push(linha);
    });
    return out;
  }

  var api = {
    configurar: configurar, pxPorPorta: pxPorPorta, debitoGbps: debitoGbps,
    criarGrelha: criarGrelha, grelhaUniforme: grelhaUniforme, quadro: quadro, retangulo: retangulo,
    cortar: cortar, formasDeBloco: formasDeBloco, melhorBloco: melhorBloco, construir: construir,
    pontoEntrada: pontoEntrada, medir: medir, candidatos: candidatos, sugerir: sugerir,
    descreverCfg: descreverCfg, blocoNoEcra: blocoNoEcra, dividirLigacoes: dividirLigacoes, ligacoesPorTransporte: ligacoesPorTransporte,
    tabelaBits: tabelaBits, montarTransportes: montarTransportes, GRUPO_PROC: GRUPO_PROC, tabelaTransportes: tabelaTransportes,
    CANTOS: CANTOS, LADOS: LADOS
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  // A interface (separador «LED Wall Help») está em js/ledwall-help.js, que carrega a seguir.
  root.ligacaoLed = api;
})(typeof window !== "undefined" ? window : globalThis);
