// SAÍDAS A USAR NUM SWITCHER — as contas, sem tocar na página.
//
// Pedido do Mike: na aba «Sinal & Data Rate», poder dar o nº de saídas do
// switcher e ver a resolução, a capacidade e a possibilidade, mais uma
// sugestão — para cada switcher ESCOLHIDO, porque ele quer poder trocar de
// switcher e comparar a compatibilidade.
//
// COMO ISTO SE LIGA AO QUE JÁ EXISTIA
//
// Nada aqui repete uma conta da página: as funções de base (pixel clock
// CVT-RB2, divisão do canvas por pixel clock ou por capacidade, arredondar
// ao par, margem de segurança, capacidade do modo avançado) entram por
// `criar(deps)`, e quem as passa é o index.html com as MESMAS funções que o
// calcSinal() já usa. Assim há uma régua só: se a conta de ligações mudar
// num dia, muda aqui também. (Os testes carregam as funções verdadeiras do
// index.html — ver scripts/verificar-saidas-switcher.mjs.)
//
// AS DUAS DISPOSIÇÕES (o Mike não disse qual prefere — mostram-se as duas):
//
//  - CANVAS CONTÍNUO: as N saídas juntas num único ecrã grande. O sinal
//    indicado é o canvas INTEIRO. É a conta que a página já fazia (a divisão
//    em faixas iguais ao longo da dimensão maior, cada faixa a caber no
//    pixel clock de uma ligação), só que ao contrário: dado N, qual é o
//    maior canvas, com a mesma proporção do sinal, que N faixas aguentam —
//    sem passar da capacidade em MP do switcher (com a margem de 90%).
//
//  - N ECRÃS INDEPENDENTES: cada saída alimenta o seu ecrã. O sinal
//    indicado é o de CADA ecrã. A resolução máxima por saída é a que o
//    pixel clock de uma ligação aguenta (e que N ecrãs juntos não faça
//    passar a capacidade total), com a mesma proporção do sinal.
//
// SEM PIXEL CLOCK PUBLICADO (ex: PixelHUE): a página já usa o orçamento de
// píxeis por ligação (capacidade em MP a dividir pelas saídas). Aqui
// igual, e o resultado fica marcado como estimado (`estimado: true`; a
// página escreve «~»).
//
// O QUE NÃO SE INVENTA: a profundidade de cor e a amostragem NÃO entram no
// pixel clock nem nos MP desta app (a própria página di-lo assim), por isso
// baixar a cor não resolve nada nestas contas — a sugestão avisa disso em
// vez de fingir que resolve. A capacidade a 30p só entra quando a ficha tem o
// valor (`maxMPPgmOnly30p`).
(function (root) {
  "use strict";

  // Frame rates de referência para a sugestão «baixar o frame rate».
  var FPS_COMUNS = [120, 100, 60, 50, 30, 25, 24];
  var MAX_LADO = 200000;      // limite da procura do canvas máximo (px)

  function criar(deps) {
    var cvt = deps.cvtRb2ClockMHz;
    var par = deps.roundUpEven;
    var MARGEM = deps.margem;
    var capAvancada = deps.switcherAdvancedCap;
    var dividirPorClock = deps.splitCanvasForClock;
    var dividirPorCapacidade = deps.splitCanvasForCapacity;

    // Saídas do switcher (ou do modo de saída escolhido).
    function saidasDe(s, modeIdx) {
      if (s.outputModes) {
        var m = s.outputModes[modeIdx || 0] || s.outputModes[0];
        return m ? m.outputs : undefined;
      }
      return s.outputs;
    }

    // Capacidades em MP: switcher (PGM + Preview) e só PGM — as mesmas que o
    // calcSinal() usa. `usar30p` só serve às hipóteses «e se baixar para 30p».
    function capacidades(s, avancado, usar30p) {
      var adv = avancado ? capAvancada(s) : null;
      var sw = (adv ? adv.switcher : s.maxMPSwitcher) || 0;
      var pgm = (adv ? adv.pgm : s.maxMPPgmOnly) || sw;
      var de30p = false;
      if (usar30p) {
        var p30 = adv
          ? (s.maxMPPgmOnly30pAdvanced != null ? s.maxMPPgmOnly30pAdvanced : (s.unitsOwned >= 2 ? s.maxMPPgmOnly30pLinked : null))
          : s.maxMPPgmOnly30p;
        if (p30 && p30 > pgm) { pgm = p30; de30p = true; }
      }
      return { sw: sw, pgm: pgm, adv: adv, de30p: de30p };
    }

    // O que uma LIGAÇÃO aguenta: pixel clock publicado ou, sem ele, o
    // orçamento de píxeis (capacidade ÷ saídas do aparelho, dado da ficha).
    function limiteLigacao(s, saidas, capPgm) {
      if (s.maxPixelClockMHz) return { tipo: "clock", mhz: s.maxPixelClockMHz };
      if (saidas && capPgm) return { tipo: "capacidade", px: (capPgm * 1e6) / saidas };
      return null;
    }
    function cabeLigacao(lim, w, h, fps) {
      if (!lim) return true;
      return lim.tipo === "clock" ? cvt(w, h, fps) <= lim.mhz + 0.05 : w * h <= lim.px;
    }
    function dividir(h, v, fps, lim) {
      if (!lim) return null;
      return lim.tipo === "clock" ? dividirPorClock(h, v, fps, lim.mhz) : dividirPorCapacidade(h, v, lim.px);
    }

    function dimPar(w, aspH, aspV) {
      return Math.max(2, 2 * Math.floor((w * aspV) / aspH / 2));
    }
    // Maior k em [1, maxK] para o qual teste(k) === null (nada falha).
    function maiorK(maxK, teste) {
      var lo = 0, hi = maxK;
      while (lo < hi) {
        var mid = Math.ceil((lo + hi) / 2);
        if (teste(mid) === null) lo = mid; else hi = mid - 1;
      }
      return lo;
    }

    // MAIOR CANVAS CONTÍNUO que N faixas iguais aguentam (a conta de
    // splitCanvasForClock/Capacity ao contrário). Mesma proporção do sinal;
    // largura e altura pares; faixas ao longo da dimensão maior.
    function canvasMaximo(aspH, aspV, n, fps, lim, capMP) {
      if (!lim && !capMP) return null;
      var porLargura = aspH >= aspV;
      function teste(k) {
        var w = 2 * k, h = dimPar(w, aspH, aspV);
        if (capMP && w * h > capMP * 1e6) return "capacidade";
        var pw = porLargura ? par(w / n) : w;
        var ph = porLargura ? h : par(h / n);
        if (!cabeLigacao(lim, pw, ph, fps)) return "ligacao";
        return null;
      }
      var k = maiorK(MAX_LADO / 2, teste);
      if (!k) return null;
      var w = 2 * k, h = dimPar(w, aspH, aspV);
      var porque = teste(k + 1);
      return {
        w: w, h: h, mp: (w * h) / 1e6,
        limite: porque || "ilimitado",
        faixaW: porLargura ? par(w / n) : w,
        faixaH: porLargura ? h : par(h / n)
      };
    }

    // MAIOR RESOLUÇÃO POR SAÍDA (ecrãs independentes): cabe numa ligação e
    // não passa de `pxMax` (a parte da capacidade que cabe a cada saída).
    function resolucaoPorSaida(aspH, aspV, fps, lim, pxMax) {
      if (!lim && !pxMax) return null;
      function teste(k) {
        var w = 2 * k, h = dimPar(w, aspH, aspV);
        if (pxMax && w * h > pxMax) return "capacidade";
        if (!cabeLigacao(lim, w, h, fps)) return "ligacao";
        return null;
      }
      var k = maiorK(MAX_LADO / 2, teste);
      if (!k) return null;
      var w = 2 * k, h = dimPar(w, aspH, aspV);
      return { w: w, h: h, mp: (w * h) / 1e6, limite: teste(k + 1) || "ilimitado" };
    }

    function modoDe(mp, cap) {
      return mp <= cap.sw * MARGEM ? "pgmPreview" : "soPgm";
    }

    /**
     * AVALIA UM SWITCHER PARA N SAÍDAS.
     *
     * s       — um item de PROCESSORS_DATA.switchers
     * sinal   — { h, v, fps }
     * o       — { n (inteiro >= 1 ou null = todas), avancado, modeIdx, usar30p }
     */
    function avaliar(s, sinal, o) {
      o = o || {};
      var h = sinal.h, v = sinal.v, fps = sinal.fps;
      var totalPx = h * v, totalMP = totalPx / 1e6;
      var cap = capacidades(s, !!o.avancado, !!o.usar30p);
      var saidas = saidasDe(s, o.modeIdx);
      var nPedido = o.n != null ? o.n : null;
      var n = nPedido != null ? (saidas ? Math.min(nPedido, saidas) : nPedido) : (saidas || null);
      var av = {
        s: s, sinal: { h: h, v: v, fps: fps, totalPx: totalPx, totalMP: totalMP, clock: cvt(h, v, fps) },
        saidas: saidas || null, nPedido: nPedido, n: n,
        nExcede: !!(nPedido != null && saidas && nPedido > saidas),
        saidasDesconhecidas: !saidas,
        cap: cap, avancado: !!o.avancado, modeIdx: o.modeIdx || 0,
        estimado: !s.maxPixelClockMHz,
        uso: { pct: cap.pgm ? (totalMP / cap.pgm) * 100 : null, modo: cap.pgm ? modoDe(totalMP, cap) : null }
      };
      if (!n || !cap.pgm) { av.semDados = true; return av; }

      var lim = limiteLigacao(s, saidas, cap.pgm);
      av.lim = lim;
      av.semLimite = !lim;
      var capUtil = cap.pgm * MARGEM;          // MP que se pode usar (margem de segurança)
      var cabeCap = totalMP <= capUtil;

      // ---------- CANVAS CONTÍNUO ----------
      var lig = dividir(h, v, fps, lim);
      var precisa = lig ? lig.n : null;
      var c = { ligacoes: lig, precisa: precisa };
      c.cabeSaidas = lim ? (precisa != null && precisa <= n) : null;
      c.cabeCap = cabeCap;
      c.cabeEntradas = (precisa != null && s.inputs) ? precisa <= s.inputs : null;
      c.motivos = [];
      if (lim && !c.cabeSaidas) c.motivos.push({ tipo: "saidas", precisa: precisa, tem: n });
      if (!cabeCap) c.motivos.push({ tipo: "capacidade", mp: totalMP, cap: capUtil });
      if (c.cabeEntradas === false) c.motivos.push({ tipo: "entradas", precisa: precisa, tem: s.inputs });
      c.cabe = c.motivos.length === 0;
      c.max = canvasMaximo(h, v, n, fps, lim, capUtil);
      c.maxPreview = (cap.sw && cap.sw < cap.pgm) ? canvasMaximo(h, v, n, fps, lim, cap.sw * MARGEM) : null;
      c.pctMax = c.max && cap.pgm ? (c.max.mp / cap.pgm) * 100 : null;
      av.continuo = c;

      // ---------- N ECRÃS INDEPENDENTES ----------
      var ind = {};
      ind.ligacaoOk = lim ? cabeLigacao(lim, h, v, fps) : null;
      ind.totalMP = n * totalMP;
      ind.pct = (ind.totalMP / cap.pgm) * 100;
      ind.modo = modoDe(ind.totalMP, cap);
      ind.cabeCap = ind.totalMP <= capUtil;
      ind.nMax = ind.ligacaoOk === false ? 0 : Math.min(saidas || Infinity, Math.floor(capUtil / totalMP + 1e-9));
      if (ind.nMax === Infinity) ind.nMax = null;
      ind.motivos = [];
      if (ind.ligacaoOk === false) ind.motivos.push({ tipo: "ligacao", mhz: lim.tipo === "clock" ? lim.mhz : null, clock: av.sinal.clock, px: lim && lim.tipo === "capacidade" ? lim.px : null });
      if (!ind.cabeCap) ind.motivos.push({ tipo: "capacidade", mp: ind.totalMP, cap: capUtil });
      ind.cabe = ind.motivos.length === 0;
      ind.porSaida = resolucaoPorSaida(h, v, fps, lim, (capUtil * 1e6) / n);
      ind.totalMax = ind.porSaida ? n * ind.porSaida.mp : null;
      ind.pctMax = ind.totalMax != null && cap.pgm ? (ind.totalMax / cap.pgm) * 100 : null;
      av.indep = ind;
      return av;
    }

    // ---------- SUGESTÃO ----------

    function opcoesDeSaida(s) {
      if (s.outputModes) return s.outputModes.map(function (m, i) { return { modeIdx: i, outputs: m.outputs, label: m.label }; });
      return s.outputs ? [{ modeIdx: 0, outputs: s.outputs, label: null }] : [];
    }

    // Outros switchers que servem a mesma conta com N saídas.
    function outrosQueServem(av, ctx, disp, filtro) {
      var lista = [];
      (ctx.todos || []).forEach(function (s2) {
        if (s2 === av.s || (ctx.escolhidos && ctx.escolhidos(s2))) return;
        var opcoes = opcoesDeSaida(s2).filter(function (op) { return op.outputs >= av.n; });
        for (var i = 0; i < opcoes.length; i++) {
          var a2 = avaliar(s2, av.sinal, { n: av.n, avancado: av.avancado, modeIdx: opcoes[i].modeIdx });
          if (a2.semDados) continue;
          var blk = disp === "continuo" ? a2.continuo : a2.indep;
          if (!blk.cabe) continue;
          var pct = disp === "continuo" ? a2.uso.pct : a2.indep.pct;
          if (filtro && !filtro(pct, a2)) continue;
          lista.push({ s: s2, pct: pct, modeLabel: opcoes[i].label, modeIdx: opcoes[i].modeIdx, estimado: a2.estimado, precisa: a2.continuo.precisa });
          break;
        }
      });
      lista.sort(function (a, b) { return (a.s.mercado ? 1 : 0) - (b.s.mercado ? 1 : 0) || a.pct - b.pct; });
      return lista;
    }

    function cabeEm(av, disp) { return (disp === "continuo" ? av.continuo : av.indep).cabe; }

    // O que cederia, mantendo o mesmo switcher e N: baixar o frame rate (com a
    // capacidade a 30p da ficha, quando existe) ou ligar as unidades (modo
    // avançado).
    function cedencias(av, disp) {
      var itens = [];
      var o0 = { n: av.nPedido, avancado: av.avancado, modeIdx: av.modeIdx };
      var fps0 = av.sinal.fps;
      for (var i = 0; i < FPS_COMUNS.length; i++) {
        var f = FPS_COMUNS[i];
        if (f >= fps0) continue;
        var a2 = avaliar(av.s, { h: av.sinal.h, v: av.sinal.v, fps: f }, { n: o0.n, avancado: o0.avancado, modeIdx: o0.modeIdx, usar30p: f <= 30 });
        if (!a2.semDados && cabeEm(a2, disp)) {
          itens.push({ tipo: "fps", disp: disp, fps: f, precisa: a2.continuo.precisa, capNova: a2.cap.de30p ? a2.cap.pgm : null, capAntes: av.cap.pgm });
          break;
        }
      }
      if (!av.avancado) {
        var adv = capAvancada(av.s);
        if (adv) {
          var a3 = avaliar(av.s, av.sinal, { n: o0.n, avancado: true, modeIdx: o0.modeIdx });
          if (!a3.semDados && cabeEm(a3, disp)) itens.push({ tipo: "unidades", disp: disp, capNova: a3.cap.pgm, nota: adv.nota });
        }
      }
      return itens;
    }

    /**
     * SUGESTÃO para um switcher já avaliado.
     * ctx = { todos: [switchers], escolhidos: function(s) -> bool }
     * Devolve { itens: [...] } — texto fica para a página (PT/EN).
     */
    function sugerir(av, ctx) {
      var itens = [];
      if (av.semDados) return { itens: itens };
      var c = av.continuo, ind = av.indep;

      // --- canvas contínuo ---
      if (c.cabe) {
        itens.push({ tipo: "folga", disp: "continuo", pct: av.uso.pct, precisa: c.precisa, n: av.n, modo: av.uso.modo });
        var melhores = outrosQueServem(av, ctx, "continuo", function (pct) { return pct <= av.uso.pct - 10; });
        if (melhores.length) itens.push({ tipo: "maisFolga", disp: "continuo", lista: melhores.slice(0, 3), mais: Math.max(0, melhores.length - 3) });
      } else {
        if (c.motivos.some(function (m) { return m.tipo === "saidas"; })) {
          if (c.precisa != null && (!av.saidas || c.precisa <= av.saidas)) {
            // Com mais saídas já cabia nas ligações; se a capacidade (ou as
            // entradas) também falha, diz-se — as outras linhas tratam disso.
            itens.push({ tipo: "saidasMin", disp: "continuo", n: c.precisa, ainda: !c.cabeCap || c.cabeEntradas === false });
          } else {
            itens.push({ tipo: "semSaidas", disp: "continuo", precisa: c.precisa, tem: av.saidas || av.n });
          }
        }
        var servem = outrosQueServem(av, ctx, "continuo");
        if (servem.length) itens.push({ tipo: "outros", disp: "continuo", lista: servem.slice(0, 4), mais: Math.max(0, servem.length - 4) });
        else itens.push({ tipo: "nenhumOutro", disp: "continuo", n: av.n });
        itens = itens.concat(cedencias(av, "continuo"));
      }

      // --- ecrãs independentes ---
      if (ind.cabe) {
        itens.push({ tipo: "folga", disp: "indep", pct: ind.pct, n: av.n, modo: ind.modo });
      } else {
        if (ind.ligacaoOk !== false && !ind.cabeCap) itens.push({ tipo: "maxEcras", disp: "indep", n: ind.nMax });
        var servem2 = outrosQueServem(av, ctx, "indep");
        if (servem2.length) itens.push({ tipo: "outros", disp: "indep", lista: servem2.slice(0, 4), mais: Math.max(0, servem2.length - 4) });
        else itens.push({ tipo: "nenhumOutro", disp: "indep", n: av.n });
        itens = itens.concat(cedencias(av, "indep"));
      }

      if (!c.cabe || !ind.cabe) itens.push({ tipo: "cor" });
      return { itens: itens };
    }

    return {
      avaliar: avaliar, sugerir: sugerir, saidasDe: saidasDe, capacidades: capacidades,
      canvasMaximo: canvasMaximo, resolucaoPorSaida: resolucaoPorSaida, opcoesDeSaida: opcoesDeSaida
    };
  }

  // Lê o campo «Saídas a usar (N)»: vazio = todas; inteiro >= 1 = esse nº;
  // qualquer outra coisa é inválida (e conta como vazio, com aviso).
  function lerSaidas(texto, badInput) {
    var t = String(texto == null ? "" : texto).trim();
    if (!t && !badInput) return { n: null, invalido: false };
    if (badInput || !/^\d+$/.test(t) || parseInt(t, 10) < 1) return { n: null, invalido: true };
    return { n: parseInt(t, 10), invalido: false };
  }

  var api = { criar: criar, lerSaidas: lerSaidas, FPS_COMUNS: FPS_COMUNS };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.SaidasSwitcher = api;
})(typeof window !== "undefined" ? window : globalThis);
