// CONFIGURAÇÕES DOS APARELHOS PIXELHUE — as contas, sem tocar na página.
//
// Os dados estão em data/pixelhue-configuracoes.json (cada valor com a sua
// `fonte`; o que a ficha não publica fica `null` e «sem dados»). Aqui só se
// transforma a configuração ESCOLHIDA (modo do P80, ou cartões de saída × quantidade
// do Q8) num «switcher efetivo»: o mesmo objeto de processors.json, com o nº de
// saídas, o pixel clock por saída e a capacidade dessa configuração. Assim as
// contas de «Saídas a usar (N)» (js/saidas-switcher.js) e da aba Sinal & Data
// Rate NÃO mudam: continuam a ler `outputs`, `maxPixelClockMHz` e `maxMPSwitcher`.
//
// O pixel clock por saída NÃO está na ficha (a PixelHue publica a resolução
// máxima, não os MHz): calcula-se com a MESMA função CVT-RB2 da página
// (`deps.cvt`), a partir da resolução máxima por saída, como já se faz para os
// outros aparelhos (Aquilon, H5, E3).
//
// Mistura de cartões com limites diferentes: a conta usa a saída mais fraca
// (prudente) e diz-se num aviso.
(function (root) {
  "use strict";

  function criar(deps) {
    var cvt = deps.cvt;
    var DADOS = null;

    function definir(d) { DADOS = d || null; }
    function modelos() { return (DADOS && DADOS.modelos) || []; }
    function modeloDe(s) {
      var lista = modelos();
      for (var i = 0; i < lista.length; i++) if (lista[i].marca === s.marca && lista[i].modelo === s.modelo) return lista[i];
      return null;
    }
    function txt(o, campo, en) { return en && o[campo + "_en"] ? o[campo + "_en"] : o[campo]; }

    // ---------- opções do seletor «Configuração» ----------
    function idCartao(cartao, n) { return "c:" + cartao + ":" + n; }
    function opcoes(m, en) {
      var out = [];
      if (m.tipo === "cartoes") {
        var max = m.max_cartoes_saida || 1;
        m.cartoes.forEach(function (c) {
          var qs = max > 1 ? [1, max] : [1];
          qs.forEach(function (n) {
            out.push({ id: idCartao(c.id, n), rotulo: n + " × " + c.nome + (n === max && max > 1 ? (en ? " (max.)" : " (máx.)") : ""), grupo: c.nome });
          });
        });
        out.push({ id: "manual", rotulo: en ? "By hand (cards and quantity)" : "À mão (cartões e quantidade)", grupo: "" });
      } else {
        m.configuracoes.forEach(function (c) { out.push({ id: c.id, rotulo: txt(c, "rotulo", en), grupo: "" }); });
      }
      return out;
    }
    function padrao(m) {
      if (m.tipo === "cartoes") {
        return { id: idCartao(m.cartoes[0].id, m.max_cartoes_saida || 1), qtd: null };
      }
      var c = m.configuracoes.filter(function (x) { return x.padrao; })[0] || m.configuracoes[0];
      return { id: c.id, qtd: null };
    }
    function estadoValido(m, e) {
      if (!e || !e.id) return padrao(m);
      if (e.id === "manual") return m.tipo === "cartoes" ? e : padrao(m);
      var ok = opcoes(m).some(function (o) { return o.id === e.id; });
      if (!ok && m.tipo === "cartoes") {
        var p = e.id.split(":"), n = parseInt(p[2], 10);
        ok = p[0] === "c" && n >= 1 && n <= (m.max_cartoes_saida || 1) && m.cartoes.some(function (c) { return c.id === p[1]; });
      }
      return ok ? e : padrao(m);
    }

    // ---------- resolver uma configuração ----------
    function qtdDe(m, e) {
      var q = {};
      m.cartoes.forEach(function (c) { q[c.id] = 0; });
      if (e.id === "manual") {
        m.cartoes.forEach(function (c) { var n = e.qtd && e.qtd[c.id]; q[c.id] = n > 0 ? Math.floor(n) : 0; });
      } else {
        var p = e.id.split(":");
        if (q[p[1]] != null) q[p[1]] = parseInt(p[2], 10) || 0;
      }
      return q;
    }
    function aviso(pt, en) { return { pt: pt, en: en }; }

    function resolver(m, estado) {
      var e = estadoValido(m, estado);
      var r = { modelo: m, estado: e, avisos: [], semDados: (m.sem_dados || []).map(function (t, i) { return { pt: t, en: (m.sem_dados_en && m.sem_dados_en[i]) || t }; }), cartoes: [], saidas: null, porSaida: null, optica: null, tipo: m.tipo };
      if (m.tipo !== "cartoes") {
        var c = m.configuracoes.filter(function (x) { return x.id === e.id; })[0] || m.configuracoes[0];
        r.config = c; r.rotulo = c.rotulo; r.rotulo_en = c.rotulo_en || c.rotulo;
        r.saidas = c.saidas == null ? null : c.saidas;
        r.porSaida = c.porSaida || null;
        r.optica = c.optica || null;
        r.saidasFonte = c.saidas_fonte || null;
        r.saidasNota = c.saidas_nota || null;
        if (m.aviso) r.avisos.push(aviso(m.aviso, m.aviso_en || m.aviso));
        return r;
      }
      // ---- cartões × quantidade ----
      var q = qtdDe(m, e);
      var maxC = m.max_cartoes_saida || null;
      var total = 0;
      m.cartoes.forEach(function (c) { total += q[c.id]; });
      if (maxC && total > maxC) {
        r.avisos.push(aviso("⚠ " + total + " cartões excedem o máximo publicado (" + maxC + " cartões de saída): as contas usam " + maxC + ".",
          "⚠ " + total + " cards exceed the published maximum (" + maxC + " output cards): the calculations use " + maxC + "."));
        // tira dos últimos tipos até caber
        var excesso = total - maxC;
        for (var i = m.cartoes.length - 1; i >= 0 && excesso > 0; i--) {
          var id = m.cartoes[i].id, tira = Math.min(q[id], excesso);
          q[id] -= tira; excesso -= tira;
        }
        total = maxC;
      }
      var saidas = 0, px = 0, opt = 0, tipos = [], fracos = null;
      m.cartoes.forEach(function (c) {
        var n = q[c.id];
        if (!n) return;
        r.cartoes.push({ id: c.id, nome: c.nome, qtd: n, saidas: c.saidas, porSaida: c.porSaida, optica: c.optica, fonte: c.fonte });
        saidas += n * c.saidas;
        if (c.porSaida) px += n * c.saidas * c.porSaida.w * c.porSaida.h;
        if (c.optica) opt += n * c.optica.portas;
        tipos.push(c);
        var clk = c.porSaida ? cvt(c.porSaida.w, c.porSaida.h, c.porSaida.hz) : null;
        if (clk != null && (fracos == null || clk < fracos.clk)) fracos = { clk: clk, c: c };
      });
      if (m.max_saidas && saidas > m.max_saidas) saidas = m.max_saidas;
      r.rotulo = r.cartoes.length ? r.cartoes.map(function (c) { return c.qtd + " × " + c.nome; }).join(" + ") : "—";
      r.rotulo_en = r.rotulo;
      r.saidas = total ? saidas : null;
      r.porSaida = fracos ? fracos.c.porSaida : null;
      r.pxTotal = px;
      r.opticaPortas = opt || null;
      if (!total) r.avisos.push(aviso("Escolhe pelo menos um cartão de saída.", "Choose at least one output card."));
      if (tipos.length > 1) {
        r.avisos.push(aviso("⚠ A ficha da PixelHue não diz se se podem misturar tipos de cartão de saída no mesmo Q8 (sem dados).",
          "⚠ The PixelHue datasheet doesn't say whether output card types can be mixed in the same Q8 (no data)."));
        var difere = tipos.some(function (c) { return c.porSaida && fracos && (c.porSaida.w !== fracos.c.porSaida.w || c.porSaida.h !== fracos.c.porSaida.h || c.porSaida.hz !== fracos.c.porSaida.hz); });
        if (difere) r.avisos.push(aviso("Os cartões têm limites por saída diferentes: as contas usam a saída mais fraca.", "The cards have different per-output limits: the calculations use the weakest output."));
      }
      return r;
    }

    // ---------- o switcher efetivo ----------
    function fonteTxt(p) { return p.tipo + " " + p.w + "×" + p.h + "@" + p.hz; }
    function efetivo(s, m, estado) {
      var r = resolver(m, estado);
      var s2 = {};
      Object.keys(s).forEach(function (k) { s2[k] = s[k]; });
      delete s2.outputModes;
      if (r.saidas != null) s2.outputs = r.saidas; else delete s2.outputs;
      if (r.porSaida) {
        s2.maxPixelClockMHz = cvt(r.porSaida.w, r.porSaida.h, r.porSaida.hz);
        s2.maxPixelClockSource = "derivado de " + r.porSaida.w + "×" + r.porSaida.h + "@" + r.porSaida.hz + "Hz (" + r.porSaida.tipo + ", máximo por saída na ficha da PixelHue) via CVT-RB2 — a PixelHue não publica MHz diretamente";
      } else { delete s2.maxPixelClockMHz; delete s2.maxPixelClockSource; }
      if (m.capacidade === "derivada") {
        if (r.pxTotal) { s2.maxMPSwitcher = r.pxTotal / 1e6; delete s2.maxMPPgmOnly; }
        else { s2.maxMPSwitcher = 0; delete s2.maxMPPgmOnly; }
      }
      s2.configuracaoPixelhue = r;
      return { s: s2, info: r };
    }

    // Variantes para as sugestões «outros switchers»: todos os modos (P80), ou a
    // configuração escolhida/por omissão.
    function variantes(s, m, estado) {
      if (m.tipo === "modos") {
        return m.configuracoes.map(function (c) { return efetivo(s, m, { id: c.id }).s; });
      }
      return [efetivo(s, m, estado).s];
    }

    // Tudo o que o teste e a página precisam de saber sobre a validade de um valor.
    function valoresSemFonte() {
      var maus = [];
      modelos().forEach(function (m) {
        (m.configuracoes || []).forEach(function (c) {
          if (c.porSaida && !c.porSaida.fonte) maus.push(m.modelo + "/" + c.id);
        });
        (m.cartoes || []).forEach(function (c) {
          if (!c.fonte || (c.porSaida && !c.porSaida.fonte)) maus.push(m.modelo + "/" + c.id);
        });
      });
      return maus;
    }

    return { definir: definir, modeloDe: modeloDe, opcoes: opcoes, padrao: padrao, estadoValido: estadoValido,
      resolver: resolver, efetivo: efetivo, variantes: variantes, valoresSemFonte: valoresSemFonte, fonteTxt: fonteTxt, modelos: modelos };
  }

  var api = { criar: criar };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.PixelhueConfig = api;
})(typeof window !== "undefined" ? window : globalThis);
