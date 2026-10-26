// CABINETS EM SÉRIE POR ENTRADA DE ALIMENTAÇÃO — as contas e os textos, sem tocar na página.
//
// Pedido do Mike: ter a conta da CORRENTE MÁXIMA DE SAÍDA que cada cabinet
// suporta, para saber quantos se podem ligar em série a partir de UMA entrada
// de corrente.
//
// COMO SE LÊ A CONTA
//
// Os cabinets de LED têm entrada e saída de alimentação (passagem em
// «daisy-chain»). O 1.º cabinet de uma cadeia, onde a corrente entra, leva a
// corrente de TODA a cadeia — e o conector de passagem tem um limite, que o
// fabricante publica («corrente máx. de saída»). Para ficar com segurança
// só se usa uma parte dessa capacidade: a MARGEM DE SEGURANÇA (por omissão
// 20 %, pedido do Mike; editável de 0 a 50 %).
//
//     corrente utilizável = I_max × (1 − margem)
//     cabinets em série   = floor( corrente utilizável ÷ I_cab )
//     entradas necessárias = ceil( n_cabinets ÷ cabinets em série )
//
// As cadeias repartem-se de forma EQUILIBRADA (100 cabinets com 15 em série
// dão 7 cadeias de 14/15, não 6 de 15 e 1 de 10): a mais carregada passa a
// ter ceil(n ÷ entradas) cabinets, e é essa a corrente que passa no 1.º
// cabinet e a ocupação da capacidade que se mostra.
//
// O QUE NÃO SE MEXE: o consumo total e «A/fase» (÷ 3) continuam a ser os que a
// página já calculava. Isto só ACRESCENTA. Trifásica: as entradas repartem-se
// pelas 3 fases (L1/L2/L3); diz-se quantas, no máximo, ficam em cada uma.
//
// Campo vazio = sem cálculo e sem linhas no relatório (regra «só mostrar o que
// foi escolhido»). O catálogo não traz este valor (não se inventa): vem do
// que a pessoa escreve, ou de um campo `ampSaidaMax` se um dia o catálogo o tiver.
(function (root) {
  "use strict";

  var MARGEM_PADRAO = 20;
  var MARGEM_MIN = 0;
  var MARGEM_MAX = 50;
  var BASE_PADRAO = 0;
  var CHAVE_PARAMS = "calculadores-alimentacao-v1";
  // OS 5 PATAMARES DE BRILHO, de 100 para 10 (pedido do Mike). Estão aqui, à
  // vista, para se mudarem num sítio só. 100 é o pior caso (o que dimensiona
  // disjuntores e cadeias); os outros quatro descem em degraus de 25 e acabam
  // em 10, que é o mínimo que ainda interessa para saber o que se poupa.
  var PATAMARES = [100, 75, 50, 25, 10];
  var EPS = 1e-9;                     // 8 ÷ 0,4 = 19,999999… em vírgula flutuante

  // ---------------------------------------------------------------- formatação
  function num(x, max) {
    if (!isFinite(x)) return "—";
    return x.toLocaleString("pt-PT", { minimumFractionDigits: 0, maximumFractionDigits: max == null ? 2 : max });
  }
  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; });
  }

  // --------------------------------------------------------- parâmetros comuns
  //
  // São UM conjunto só, para todas as zonas e ecrãs (os campos da aba Ecrã LED
  // e os do Ecrã Complexo acompanham-se), guardados neste aparelho e no
  // ficheiro do projeto:
  //   margem  — margem de segurança da corrente de saída (%), 0–50, origem 20
  //   base    — consumo mínimo («em repouso») na tabela por brilho (%), 0–50, origem 0
  //   tensao  — tensão por cabinet (V), opcional; sem ela a tabela fica só em A
  //   incluir — pôr a tabela de consumo por brilho no relatório (desligado)
  var PADRAO = { margem: MARGEM_PADRAO, base: BASE_PADRAO, tensao: null, incluir: false };
  var P = { margem: PADRAO.margem, base: PADRAO.base, tensao: PADRAO.tensao, incluir: PADRAO.incluir };
  var ouvintes = [];
  var campos = [];                    // [{ el, chave }]

  function lerNumero(v) {
    if (typeof v === "number") return v;
    return parseFloat(String(v).replace(",", "."));
  }
  function margemValida(v) {
    var n = lerNumero(v);
    return isFinite(n) && n >= MARGEM_MIN && n <= MARGEM_MAX;
  }
  var VALIDOS = {
    margem: margemValida,
    base: margemValida,
    tensao: function (v) { var n = lerNumero(v); return isFinite(n) && n > 0 && n <= 1000; },
    incluir: function () { return true; }
  };
  function guardar() {
    try { root.localStorage.setItem(CHAVE_PARAMS, JSON.stringify(P)); } catch (e) {}
  }
  function normalizar(chave, v) {
    if (chave === "incluir") return !!v;
    if (chave === "tensao" && (v === "" || v == null)) return null;
    return lerNumero(v);
  }
  // Muda um parâmetro (valor inválido = não faz nada). Devolve true se mudou.
  function definir(chave, v, origem) {
    if (!(chave in P)) return false;
    if (chave === "tensao" && (v === "" || v == null)) v = null;
    else if (!VALIDOS[chave](v)) return false;
    P[chave] = normalizar(chave, v);
    guardar();
    campos.forEach(function (c) {
      if (c.chave !== chave || c.el === origem) return;
      if (root.document && root.document.activeElement === c.el) return;
      if (chave === "incluir") c.el.checked = P.incluir;
      else c.el.value = P[chave] == null ? "" : String(P[chave]);
    });
    ouvintes.forEach(function (f) { try { f(); } catch (e) {} });
    return true;
  }
  var margem = function () { return P.margem; };
  var definirMargem = function (v, origem) { return definir("margem", v, origem); };
  function parametros() { return { margem: P.margem, base: P.base, tensao: P.tensao, incluir: P.incluir }; }
  // Abre um projeto: o que o ficheiro trouxer entra, o resto fica como está
  // (um ficheiro de antes disto não traz nada e não mexe em nada).
  function aplicarParametros(o) {
    if (!o || typeof o !== "object") return;
    ["margem", "base", "tensao", "incluir"].forEach(function (k) { if (k in o) definir(k, o[k]); });
  }
  try {
    var bruto = root.localStorage && JSON.parse(root.localStorage.getItem(CHAVE_PARAMS) || "null");
    if (bruto && typeof bruto === "object") {
      ["margem", "base", "tensao"].forEach(function (k) {
        if (bruto[k] != null && VALIDOS[k](bruto[k])) P[k] = lerNumero(bruto[k]);
      });
      P.incluir = bruto.incluir === true;
    }
  } catch (e) { /* sem localStorage ficam os valores de origem */ }

  function aoMudar(f) { if (typeof f === "function") ouvintes.push(f); }

  // Monta, dentro de `caixa`, os quatro controlos (ids «<pref>-cs-…»).
  function montarParametros(caixa, pref) {
    if (!caixa || caixa.getAttribute("data-cs-montado")) return;
    caixa.setAttribute("data-cs-montado", "1");
    caixa.classList.add("cs-params");
    caixa.innerHTML =
      '<div class="row2">' +
        '<div class="field"><label for="' + pref + '-cs-margem">Margem de segurança</label>' +
          '<div class="inputgroup"><input id="' + pref + '-cs-margem" data-cs="margem" type="number" inputmode="decimal" min="0" max="50" step="1"><span class="unit">%</span></div></div>' +
        '<div class="field"><label for="' + pref + '-cs-base">Consumo mínimo (base)</label>' +
          '<div class="inputgroup"><input id="' + pref + '-cs-base" data-cs="base" type="number" inputmode="decimal" min="0" max="50" step="1"><span class="unit">%</span></div></div>' +
      '</div>' +
      '<div class="field"><label for="' + pref + '-cs-tensao">Tensão por cabinet (opcional)</label>' +
        '<div class="inputgroup"><input id="' + pref + '-cs-tensao" data-cs="tensao" type="number" inputmode="decimal" min="1" max="1000" step="1" placeholder="230"><span class="unit">V</span></div></div>' +
      '<div class="hint">A margem fica de fora da capacidade de saída (por omissão 20 %, de 0 a 50 %) e vale para todas as zonas. O consumo mínimo e a tensão só servem para a estimativa por brilho; sem tensão a tabela fica só em amperes.</div>' +
      '<label class="cs-incluir"><input id="' + pref + '-cs-incluir" data-cs="incluir" type="checkbox"> <span>Incluir consumo por brilho no relatório</span></label>';
    Array.prototype.forEach.call(caixa.querySelectorAll("[data-cs]"), function (el) {
      var chave = el.getAttribute("data-cs");
      campos.push({ el: el, chave: chave });
      if (chave === "incluir") el.checked = P.incluir;
      else el.value = P[chave] == null ? "" : String(P[chave]);
      if (chave === "incluir") {
        el.addEventListener("change", function () { definir("incluir", el.checked, el); });
      } else {
        el.addEventListener("input", function () {
          if (el.value === "" && chave === "tensao") definir("tensao", null, el);
          else if (el.value !== "") definir(chave, el.value, el);
        });
        el.addEventListener("change", function () {
          el.value = P[chave] == null ? "" : String(P[chave]);
        });
      }
    });
  }

  // --------------------------------------------------------------------- conta
  // o = { imax (A), icab (A por cabinet), n (cabinets), margemPct }
  function calcular(o) {
    var imax = parseFloat(o.imax), icab = parseFloat(o.icab);
    var n = Math.round(parseFloat(o.n));
    var m = margemValida(o.margemPct) ? parseFloat(o.margemPct) : MARGEM_PADRAO;
    var base = { imax: imax, icab: icab, n: n, margemPct: m };
    if (!(imax > 0)) return Object.assign(base, { estado: "sem-imax" });
    if (!(icab > 0)) return Object.assign(base, { estado: "sem-icab" });
    if (!(n >= 1)) return Object.assign(base, { estado: "sem-n" });
    var util = imax * (1 - m / 100);
    base.util = util;
    var N = Math.floor(util / icab + EPS);
    if (N < 1) return Object.assign(base, { estado: "nenhum-cabe", N: 0 });
    var M = Math.ceil(n / N);
    var q = Math.floor(n / M), r = n % M;
    var grupos = r > 0
      ? [{ cadeias: r, cabinets: q + 1 }, { cadeias: M - r, cabinets: q }]
      : [{ cadeias: M, cabinets: q }];
    var maxCadeia = r > 0 ? q + 1 : q;
    var iCadeia = maxCadeia * icab;
    return Object.assign(base, {
      estado: "ok", N: N, M: M, grupos: grupos, maxCadeia: maxCadeia,
      iCadeia: iCadeia, ocupacao: iCadeia / imax * 100,
      porFase: Math.ceil(M / 3)
    });
  }

  // Várias zonas/ecrãs: soma das entradas das que têm cálculo.
  function somar(lista) {
    var t = { entradas: 0, cabinets: 0, zonas: 0, avisos: 0 };
    lista.forEach(function (r) {
      if (r.estado === "ok") { t.entradas += r.M; t.cabinets += r.n; t.zonas++; }
      else if (r.estado === "nenhum-cabe") t.avisos++;
    });
    t.porFase = Math.ceil(t.entradas / 3);
    return t;
  }

  // -------------------------------------------------------------------- textos
  function textoGrupos(res) {
    return res.grupos.map(function (g) {
      return g.cadeias + (g.cadeias === 1 ? " cadeia de " : " cadeias de ") + g.cabinets + " cabinets";
    }).join(" + ");
  }
  function textoCarga(res) {
    return num(res.iCadeia) + " A / " + num(res.imax) + " A (" + num(res.ocupacao, 0) + " %)";
  }
  function textoAvisoNenhum(res) {
    return "⚠ Nenhum cabinet cabe numa entrada: " + num(res.icab) + " A por cabinet é mais do que os " +
      num(res.util) + " A utilizáveis (capacidade de " + num(res.imax) + " A, margem de " + num(res.margemPct) + " %).";
  }
  function pl(n, s, p) { return n === 1 ? s : p; }

  // Linhas do relatório (texto). Vazio = sem linhas. `nome` só nas zonas.
  // Os prefixos «Alimentação em série» e «Cadeias» ficam no Simplificado;
  // «Conta da alimentação» e «Por fase (trifásica)» só no Completo
  // (ver TIRAR em js/relatorio-simples.js).
  function linhasRelatorio(res, nome) {
    var suf = nome ? " — " + nome : "";
    if (res.estado === "nenhum-cabe") return [textoAvisoNenhum(res)];
    if (res.estado !== "ok") return [];
    var l = [];
    l.push("Alimentação em série" + suf + " (margem de " + num(res.margemPct) + " %): máx. " + res.N +
      " cabinets em série por entrada → " + res.M + pl(res.M, " entrada de alimentação", " entradas de alimentação"));
    l.push("Cadeias" + suf + ": " + textoGrupos(res) + "; a mais carregada: " + textoCarga(res));
    l.push("Conta da alimentação" + suf + ": capacidade total " + num(res.imax) + " A → com margem de " +
      num(res.margemPct) + " %: " + num(res.util) + " A utilizáveis ÷ " + num(res.icab) + " A por cabinet = " + res.N);
    if (res.M > 1) l.push("Por fase (trifásica)" + suf + ": máx. de entradas por fase = " + res.porFase);
    return l;
  }

  // ------------------------------------------------------------------- HTML
  function item(k, v, largo) {
    return '<div class="item' + (largo ? " wide" : "") + '"><div class="k">' + k + '</div><div class="v">' + v + "</div></div>";
  }
  // Detalhe completo de UM cálculo (ecrã LED, ou a única zona com valor).
  // opts: { qtd, meio }
  function htmlDetalhe(res, opts) {
    opts = opts || {};
    if (res.estado === "nenhum-cabe") return '<p class="warn">' + esc(textoAvisoNenhum(res)) + "</p>";
    if (res.estado !== "ok") return "";
    var qtd = Math.max(1, opts.qtd || 1);
    var entradas = res.M * qtd;
    var h = '<div class="readout">' +
      item("Máx. de cabinets em série por entrada", esc(res.N)) +
      item("Entradas de alimentação necessárias", esc(entradas)) +
      item("Distribuição sugerida", esc(textoGrupos(res)) + (qtd > 1 ? "" : ""), true) +
      item("Corrente da cadeia mais carregada (1.º cabinet)", esc(textoCarga(res)), true) +
      "</div>";
    h += '<p class="note">' + esc("Capacidade total: " + num(res.imax) + " A → com margem de " + num(res.margemPct) +
      " %: " + num(res.util) + " A utilizáveis → " + res.N + " cabinets em série por entrada (" +
      num(res.util) + " A ÷ " + num(res.icab) + " A por cabinet).") + "</p>";
    if (qtd > 1) {
      h += '<p class="note">' + esc("Cada ecrã: " + res.M + " entradas; " + qtd + " ecrãs → " + entradas + " no total.") + "</p>";
    }
    if (entradas > 1) {
      h += '<p class="note">' + esc("Trifásica: as entradas repartem-se pelas 3 fases; máx. de entradas por fase = " + Math.ceil(entradas / 3) + ".") + "</p>";
    }
    if (opts.meio) {
      h += '<p class="note">Meios-tiles contados como tiles inteiros (conta prudente).</p>';
    }
    return h;
  }
  // Uma linha por zona (quando há várias).
  function htmlLinhaZona(res, nome) {
    if (res.estado === "nenhum-cabe") return '<p class="warn">' + esc(nome + ": " + textoAvisoNenhum(res)) + "</p>";
    if (res.estado !== "ok") return "";
    return '<p class="note"><strong>' + esc(nome) + "</strong>: " + res.N + " cabinets em série por entrada → " +
      res.M + pl(res.M, " entrada de alimentação", " entradas de alimentação") + ": " + esc(textoGrupos(res)) +
      "; a mais carregada: " + esc(textoCarga(res)) + "</p>";
  }

  // ------------------------------------------------- consumo estimado por brilho
  //
  // ESTIMATIVA LINEAR sobre o consumo MÁXIMO publicado (o «Amp máx. por tile»):
  //     I(b) = I_max × ( base + (1 − base) × b )
  // com b entre 0 e 1 e `base` o consumo em repouso (por omissão 0 %). A
  // potência é I × tensão, e só aparece se a tensão tiver sido escrita (a app
  // só calcula amperes; não se inventa uma tensão). A corrente por fase
  // segue a regra do planner: total ÷ 3. Isto NÃO entra no dimensionamento:
  // disjuntores e cadeias em série continuam a usar o máximo (100 %).
  var AVISO_ESTIMATIVA = "Estimativa: o consumo real depende do conteúdo e do ecrã; o dimensionamento de disjuntores e cadeias continua a usar o máximo (100 %).";

  function consumoPorBrilho(o) {
    var itotal = parseFloat(o.itotal);
    if (!(itotal > 0)) return null;
    var base = (margemValida(o.basePct) ? lerNumero(o.basePct) : 0) / 100;
    var v = parseFloat(o.tensao);
    if (!(v > 0)) v = null;
    return PATAMARES.map(function (b) {
      var f = base + (1 - base) * (b / 100);
      var i = itotal * f;
      return { brilho: b, i: i, iFase: i / 3, w: v ? i * v : null, poupanca: (1 - f) * 100 };
    });
  }
  function textoPotencia(w) {
    if (w == null) return "";
    return w >= 1000 ? num(w / 1000, 2) + " kW" : num(w, 0) + " W";
  }
  function pctBase(o) { return num(margemValida(o.basePct) ? lerNumero(o.basePct) : 0); }

  // Linhas do relatório (só quando o interruptor está ligado — quem chama decide).
  function linhasConsumo(linhas, o, nome) {
    if (!linhas) return [];
    var suf = nome ? " — " + nome : "";
    var l = ["Consumo estimado por brilho" + suf + " (estimativa linear, consumo mínimo de " + pctBase(o) + " %)"];
    linhas.forEach(function (r) {
      l.push("Brilho " + r.brilho + " %: " + num(r.i) + " A (" + num(r.iFase) + " A/fase)" +
        (r.w != null ? " — " + textoPotencia(r.w) : "") + " — poupança de " + num(r.poupanca, 0) + " %");
    });
    return l;
  }
  function linhaConsumoZona(nome, linhas) {
    if (!linhas) return "";
    return "Consumo por brilho — " + nome + ": " + linhas.map(function (r) {
      return r.brilho + " %: " + num(r.i) + " A";
    }).join(" · ");
  }
  function linhaAviso() { return AVISO_ESTIMATIVA; }

  function htmlTabelaConsumo(linhas, o, titulo) {
    if (!linhas) return "";
    var temW = linhas[0].w != null;
    var h = '<div class="saidas-comp cs-consumo"><h4>' + esc(titulo || "Consumo estimado por brilho") + '</h4>' +
      '<div class="saidas-comp-scroll"><table class="saidas-tab cs-tab"><thead><tr>' +
      "<th>Brilho</th><th>Corrente total</th><th>Corrente por fase (trifásica)</th>" +
      (temW ? "<th>Potência</th>" : "") + "<th>Poupança face a 100 %</th></tr></thead><tbody>";
    linhas.forEach(function (r) {
      h += "<tr><td>" + r.brilho + " %</td><td>" + esc(num(r.i)) + " A</td><td>" + esc(num(r.iFase)) + " A</td>" +
        (temW ? "<td>" + esc(textoPotencia(r.w)) + "</td>" : "") + "<td>" + esc(num(r.poupanca, 0)) + " %</td></tr>";
    });
    h += "</tbody></table></div>" +
      '<p class="note">' + esc("Modelo linear: I = I máx. × (base + (1 − base) × brilho); consumo mínimo (base) de " + pctBase(o) + " %.") + "</p>" +
      '<p class="note">' + esc(AVISO_ESTIMATIVA) + "</p></div>";
    return h;
  }
  // Várias zonas: corrente de cada uma, por patamar.
  function htmlTabelaZonasConsumo(zonas) {
    if (!zonas.length) return "";
    var h = '<div class="saidas-comp-scroll"><table class="saidas-tab cs-tab"><thead><tr><th>Zona</th>';
    PATAMARES.forEach(function (b) { h += "<th>" + b + " %</th>"; });
    h += "</tr></thead><tbody>";
    zonas.forEach(function (z) {
      h += "<tr><th>" + esc(z.nome) + "</th>";
      z.linhas.forEach(function (r) { h += "<td>" + esc(num(r.i)) + " A</td>"; });
      h += "</tr>";
    });
    return h + "</tbody></table></div>";
  }

  var api = {
    MARGEM_PADRAO: MARGEM_PADRAO, MARGEM_MIN: MARGEM_MIN, MARGEM_MAX: MARGEM_MAX,
    calcular: calcular, somar: somar, linhasRelatorio: linhasRelatorio,
    htmlDetalhe: htmlDetalhe, htmlLinhaZona: htmlLinhaZona, textoGrupos: textoGrupos,
    margem: margem, definirMargem: definirMargem, margemValida: margemValida,
    PATAMARES: PATAMARES, BASE_PADRAO: BASE_PADRAO,
    parametros: parametros, aplicarParametros: aplicarParametros, definir: definir,
    aoMudar: aoMudar, montarParametros: montarParametros,
    consumoPorBrilho: consumoPorBrilho, linhasConsumo: linhasConsumo, linhaConsumoZona: linhaConsumoZona,
    linhaAviso: linhaAviso, htmlTabelaConsumo: htmlTabelaConsumo, htmlTabelaZonasConsumo: htmlTabelaZonasConsumo,
    textoPotencia: textoPotencia
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.correnteSerie = api;
})(typeof window !== "undefined" ? window : globalThis);
