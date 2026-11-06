// LED WALL HELP — separador novo: como transportar e dividir o sinal de um ecrã
// LED e como ligar os gabinetes (portas, cabo, entrada).
//
// As contas estão em js/ligacao-led.js (puras, testáveis em Node); aqui é a
// interface: o ecrã, os valores do sinal (ligados à aba «Sinal & Data Rate»),
// as sub-abas «Transporte», «Divisão» e «Ligação», o desenho SVG e o resumo
// para «Adicionar ao projeto».
//
// DADOS: nada é inventado. A capacidade das portas vem do que a aba Sinal já
// usa (processors.json); a das ligações vem de data/transportes.json, onde cada
// valor tem fonte ou vem rotulado «indicado pelo Mike». O que faltar mostra-se
// «sem dados».
(function (root) {
  "use strict";
  var L = root.ligacaoLed;
  var raiz = root.document && root.document.getElementById("lw-raiz");
  if (!L || !raiz) return;

  // Este separador traduz-se a si próprio (ver js/ledwall-help-en.js): o motor
  // global não lhe toca, para as palavras soltas dele não mexerem nas outras abas.
  raiz.setAttribute("translate", "no");
  var CHAVE = "calculadores-ledwall-v1";
  var PALETA = 10;
  var BITS_OPC = [8, 10, 12];
  var $ = function (id) { return root.document.getElementById(id); };
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); };
  var nf = function (x, d) { return typeof root.fmt === "function" ? root.fmt(x, d) : String(x); };
  var ni = function (x) { return typeof root.fmtInt === "function" ? root.fmtInt(x) : String(x); };
  var num = function (v) { var n = parseFloat(String(v).replace(",", ".")); return isFinite(n) ? n : NaN; };

  // ------------------------------------------------------------------ estado
  var PADRAO = {
    cols: "", rows: "", rx: "", ry: "", mw: "", mh: "", nits: "", amp: "", ampmax: "",
    link: true, hz: "60", bits: "8", proc: "", tipoPorta: "eth", pxManual: "", disp: "",
    transp: "eth10", capManual: "10", margem: "100",
    sub: "transporte", cfg: null, entrada: "baixo", montagem: "empilhada",
    corrente: false, colorir: "ligacao", cabos: true, tam: "ajustado", noProjeto: false
  };
  var E = JSON.parse(JSON.stringify(PADRAO));
  var TRANSPORTES = [];          // lista (transportes.json + saídas óticas dos processadores)
  var S = { getProc: function () { return ""; }, setProc: function () {} };
  var sincro = false;
  var memo = {};

  function guardar() { try { root.localStorage.setItem(CHAVE, JSON.stringify(E)); } catch (e) {} }
  try {
    var bruto = JSON.parse(root.localStorage.getItem(CHAVE) || "null");
    if (bruto && typeof bruto === "object") Object.keys(PADRAO).forEach(function (k) { if (k in bruto) E[k] = bruto[k]; });
  } catch (e) {}

  // ---------------------------------------------------------------- esqueleto
  function opc(v, t, sel) { return '<option value="' + esc(v) + '"' + (sel ? " selected" : "") + ">" + esc(t) + "</option>"; }

  raiz.innerHTML =
    '<details class="howto"><summary>Como usar o LED Wall Help</summary><div class="howto-body">' +
      '<p>Define o ecrã (ou traz o da aba <strong>Ecrã LED &amp; Pixel Pitch</strong> com um toque), o refresh e os bits por canal. A app diz quantos gabinetes cabem em cada porta, quantas portas são precisas e como dividir o sinal por ligações sem passar a capacidade do transporte que escolheres.</p>' +
      '<p><strong>Transporte</strong>: escolhe o tipo de ligação e a capacidade (e compara vários lado a lado). <strong>Divisão</strong>: quantas ligações, % de cada uma e o que levam. <strong>Ligação</strong>: sugestões de percurso do cabo, e o desenho dos gabinetes e das portas — podes escolher onde começar e por onde entra o sinal.</p>' +
    '</div></details>' +
    '<div class="sinal-col">' +
    '<details class="card sinal-block" open id="lw-card-ecra"><summary>Ecrã</summary><div class="sinal-block-body">' +
      '<div class="lw-linha-botoes">' +
        '<button type="button" class="copy" id="lw-trazer">↙ Trazer o ecrã do Ecrã LED &amp; Pixel Pitch</button>' +
        '<button type="button" class="copy" id="lw-exemplo" title="Carrega um ecrã de 19 × 3 m com gabinetes de 500 × 500 mm e 192 × 192 px (pitch 2,6 mm)">Exemplo: 19 × 3 m, P2,6</button>' +
      '</div>' +
      '<div class="hint" id="lw-trazer-msg"></div>' +
      '<div class="row2">' +
        '<div class="field"><label for="lw-cols">Gabinetes na horizontal</label><div class="inputgroup"><input id="lw-cols" data-k="cols" type="number" inputmode="numeric" autocomplete="off" min="1" step="1" placeholder="38"></div></div>' +
        '<div class="field"><label for="lw-rows">Gabinetes na vertical</label><div class="inputgroup"><input id="lw-rows" data-k="rows" type="number" inputmode="numeric" autocomplete="off" min="1" step="1" placeholder="6"></div></div>' +
      '</div>' +
      '<div class="row2">' +
        '<div class="field"><label for="lw-rx">Píxeis do gabinete (horizontal)</label><div class="inputgroup"><input id="lw-rx" data-k="rx" type="number" inputmode="numeric" autocomplete="off" min="1" step="1" placeholder="192"><span class="unit">px</span></div></div>' +
        '<div class="field"><label for="lw-ry">Píxeis do gabinete (vertical)</label><div class="inputgroup"><input id="lw-ry" data-k="ry" type="number" inputmode="numeric" autocomplete="off" min="1" step="1" placeholder="192"><span class="unit">px</span></div></div>' +
      '</div>' +
      '<div class="row2">' +
        '<div class="field"><label for="lw-mw">Largura do gabinete</label><div class="inputgroup"><input id="lw-mw" data-k="mw" type="number" inputmode="decimal" autocomplete="off" min="1" step="1" placeholder="500"><span class="unit">mm</span></div></div>' +
        '<div class="field"><label for="lw-mh">Altura do gabinete</label><div class="inputgroup"><input id="lw-mh" data-k="mh" type="number" inputmode="decimal" autocomplete="off" min="1" step="1" placeholder="500"><span class="unit">mm</span></div></div>' +
      '</div>' +
      '<div class="field"><label for="lw-nits">Brilho (opcional)</label><div class="inputgroup"><input id="lw-nits" data-k="nits" type="number" inputmode="decimal" autocomplete="off" min="0" step="50"><span class="unit">nits</span></div></div>' +
      '<div class="divider">Sinal</div>' +
      '<label class="addproject lw-interruptor"><input type="checkbox" id="lw-link" data-k="link">Usar os valores do Sinal &amp; Data Rate</label>' +
      '<div class="hint" id="lw-link-hint"></div>' +
      '<div class="row2">' +
        '<div class="field"><label for="lw-hz">Refresh</label><div class="inputgroup"><input id="lw-hz" data-k="hz" type="number" inputmode="numeric" autocomplete="off" min="1" step="1"><span class="unit">Hz</span></div>' +
          '<div class="lw-rapido"><button type="button" class="copy lw-hzbtn" data-hz="50">50 Hz</button><button type="button" class="copy lw-hzbtn" data-hz="60">60 Hz</button></div></div>' +
        '<div class="field"><label for="lw-bits">Profundidade de cor</label><select id="lw-bits" data-k="bits" class="plain">' +
          BITS_OPC.map(function (b) { return opc(b, b + " bits por canal"); }).join("") + '</select></div>' +
      '</div>' +
      '<div class="field"><label for="lw-proc">Controlador / processador</label><select id="lw-proc" data-k="proc" class="plain"></select><div class="hint" id="lw-proc-hint"></div></div>' +
      '<div class="field"><label for="lw-tipo">Tipo de porta</label><select id="lw-tipo" data-k="tipoPorta" class="plain"></select>' +
        '<div id="lw-pxmanual-wrap" style="display:none; margin-top:8px;"><div class="inputgroup"><input id="lw-pxmanual" data-k="pxManual" type="number" inputmode="numeric" autocomplete="off" min="1" step="1" placeholder="px por porta"><span class="unit">px</span></div></div>' +
      '</div>' +
    '</div></details>' +

    '<details class="card results sinal-block" data-accent="ledwall" open id="lw-card-res"><div class="stripe"></div><summary>Resultado</summary><div class="sinal-block-body">' +
      '<div class="readout" id="lw-res-fis"></div>' +
      '<h2 style="margin-top:16px;">Sinal e ligações</h2>' +
      '<div class="readout" id="lw-res-sinal"></div>' +
      '<div id="lw-avisos"></div>' +
    '</div></details>' +

    '<div class="lw-sub" role="tablist" aria-label="LED Wall Help">' +
      '<button type="button" class="lw-subbtn" role="tab" data-sub="transporte">Transporte</button>' +
      '<button type="button" class="lw-subbtn" role="tab" data-sub="divisao">Divisão</button>' +
      '<button type="button" class="lw-subbtn" role="tab" data-sub="ligacao">Ligação</button>' +
    '</div>' +

    '<div class="card lw-painel" id="lw-p-transporte">' +
      '<div class="field"><label for="lw-transp">Tipo de transporte</label><select id="lw-transp" data-k="transp" class="plain"></select></div>' +
      '<div id="lw-cap-wrap" style="display:none;"><div class="field"><label for="lw-cap">Capacidade por ligação</label><div class="inputgroup"><input id="lw-cap" data-k="capManual" type="number" inputmode="decimal" autocomplete="off" min="0.01" step="0.1"><span class="unit">Gb/s</span></div></div></div>' +
      '<div class="field"><label for="lw-margem">Margem de segurança (percentagem da capacidade que se pode usar)</label><div class="inputgroup"><input id="lw-margem" data-k="margem" type="number" inputmode="decimal" autocomplete="off" min="1" max="100" step="1"><span class="unit">%</span></div>' +
        '<div class="hint">100 % = o próprio limite da ligação, sem margem extra. Com 80 % cada ligação leva no máximo 80 % da capacidade.</div></div>' +
      '<div id="lw-transp-info"></div>' +
      '<h2 style="margin-top:18px;">Comparar transportes neste ecrã</h2>' +
      '<div class="hint">Com o refresh e os bits de cima. Toca numa linha para escolher esse transporte.</div>' +
      '<div id="lw-comp"></div>' +
    '</div>' +

    '<div class="card lw-painel" id="lw-p-divisao">' +
      '<div id="lw-div-resumo"></div><div id="lw-div-avisos"></div><div id="lw-div-lista"></div>' +
      '<h2 style="margin-top:18px;">O mesmo ecrã a 8, 10 e 12 bits</h2>' +
      '<div class="hint" id="lw-bits-hint"></div><div id="lw-bits-tab"></div>' +
    '</div>' +

    '<div class="card lw-painel" id="lw-p-ligacao">' +
      '<div class="readout" id="lw-lig-res"></div>' +
      '<div id="lw-lig-avisos"></div>' +
      '<div class="row2" style="margin-top:12px;">' +
        '<div class="field"><label for="lw-montagem">Montagem</label><select id="lw-montagem" data-k="montagem" class="plain"><option value="empilhada">Empilhada</option><option value="pendurada">Pendurada</option></select></div>' +
        '<div class="field"><label for="lw-entrada">Entrada do sinal</label><select id="lw-entrada" data-k="entrada" class="plain"><option value="baixo">Por baixo</option><option value="topo">Por cima</option><option value="esq">Pela esquerda</option><option value="dir">Pela direita</option></select></div>' +
      '</div>' +
      '<div class="hint">Pressuposto a confirmar: empilhada no chão → o sinal entra por baixo; pendurada → por cima (os cabos descem do ponto de suspensão). Podes mudar a entrada à mão.</div>' +
      '<h2 style="margin-top:16px;">Sugestões de ligação</h2><div id="lw-sug"></div>' +
      '<details class="lw-ajuste" id="lw-ajuste"><summary>Ajustar à mão</summary>' +
        '<div class="row2">' +
          '<div class="field"><label for="lw-canto">Ponto de partida</label><select id="lw-canto" class="plain"><option value="SE">Canto superior esquerdo</option><option value="SD">Canto superior direito</option><option value="IE">Canto inferior esquerdo</option><option value="ID">Canto inferior direito</option></select></div>' +
          '<div class="field"><label for="lw-eixo">Percurso</label><select id="lw-eixo" class="plain"><option value="linhas">Por linhas</option><option value="colunas">Por colunas</option></select></div>' +
        '</div><div class="row2">' +
          '<div class="field"><label for="lw-padrao">Padrão</label><select id="lw-padrao" class="plain"><option value="serp">Em S (serpentina)</option><option value="retorno">Com retorno (volta ao início)</option></select></div>' +
          '<div class="field"><label for="lw-forma">Repartição pelas portas</label><select id="lw-forma" class="plain"><option value="equilibrada">Equilibrada (mesmo nº em todas)</option><option value="cheia">Cheias (a última sai mais vazia)</option><option value="blocos">Blocos regulares</option></select></div>' +
        '</div>' +
        '<div class="field"><label for="lw-disp">Portas disponíveis (opcional)</label><div class="inputgroup"><input id="lw-disp" data-k="disp" type="number" inputmode="numeric" autocomplete="off" min="1" step="1" placeholder="sem limite"><span class="unit">portas</span></div><div class="hint">Se indicares quantas portas tens, os gabinetes das portas que faltarem ficam assinalados como sem ligação.</div></div>' +
        '<div class="field"><label for="lw-amp">Corrente por gabinete (opcional)</label><div class="row2"><div class="inputgroup"><input id="lw-amp" data-k="amp" type="number" inputmode="decimal" autocomplete="off" min="0" step="0.01" placeholder="A por gabinete"><span class="unit">A</span></div><div class="inputgroup"><input id="lw-ampmax" data-k="ampmax" type="number" inputmode="decimal" autocomplete="off" min="0" step="0.1" placeholder="corrente máx. de saída"><span class="unit">A</span></div></div><div class="hint">Só para a camada de corrente do desenho (a margem de segurança é a da aba Ecrã LED).</div></div>' +
      '</details>' +
      '<div class="lw-camadas">' +
        '<label class="lw-chk"><input type="checkbox" id="lw-cabos" data-k="cabos"> Cabos desde a entrada</label>' +
        '<label class="lw-chk"><input type="checkbox" id="lw-corrente" data-k="corrente"> Camada da corrente</label>' +
        '<label class="lw-chk">Cor por <select id="lw-colorir" data-k="colorir" class="plain"><option value="ligacao">ligação</option><option value="porta">porta</option></select></label>' +
        '<label class="lw-chk">Desenho <select id="lw-tam" data-k="tam" class="plain"><option value="ajustado">ajustado ao ecrã</option><option value="grande">grande (deslizar)</option></select></label>' +
      '</div>' +
      '<div class="hint">Toca num canto do desenho para começar aí.</div>' +
      '<div class="lw-svg-wrap" id="lw-svg-wrap"></div>' +
      '<div id="lw-leg"></div>' +
      '<details class="lw-portas"><summary>Lista de portas</summary><div id="lw-portas"></div></details>' +
    '</div>' +

    '<details class="card sinal-block" open><summary>Relatório</summary><div class="sinal-block-body">' +
      '<div class="summary"><div class="summary-head"><span class="k">Resumo do LED Wall Help</span><div class="summary-actions">' +
        '<label class="addproject"><input type="checkbox" id="lw-addproject">Adicionar ao projeto</label>' +
        '<select class="copy" id="lw-share" title="Partilhar ou guardar — escolhe o formato e por onde enviar"><option value="" selected>↗ Partilhar/Guardar</option><option value="text">Como texto (mensagem)</option><option value="txt">Como ficheiro .txt</option><option value="csv">Como ficheiro .csv (Excel)</option><option value="pdf">Como PDF</option></select>' +
        '<button class="copy" data-target="lw-sum">Copiar resumo</button>' +
      '</div></div><pre class="sumbox" id="lw-sum"></pre></div>' +
    '</div></details>' +
    '</div>';

  // --------------------------------------------------------------- contas
  function processadores() {
    var p = root.PROCESSORS_DATA;
    return (p && p.ledProcessors) || [];
  }
  function chaveProc(p) { return p.marca + "|" + p.modelo; }
  function procEscolhido() {
    var ps = processadores(), k = E.proc;
    for (var i = 0; i < ps.length; i++) if (chaveProc(ps[i]) === k) return ps[i];
    return null;
  }
  function transporteAtual() {
    if (E.transp === "outro") {
      var c = num(E.capManual);
      return { id: "outro", nome: "Outro / valor à mão", gbps: c > 0 ? c : null, manual: true, confianca: "valor à mão" };
    }
    for (var i = 0; i < TRANSPORTES.length; i++) if (TRANSPORTES[i].id === E.transp) return TRANSPORTES[i];
    return null;
  }

  function contexto() {
    var C = Math.round(num(E.cols)), R = Math.round(num(E.rows)), rx = Math.round(num(E.rx)), ry = Math.round(num(E.ry));
    var x = { ok: false, E: E };
    x.hz = num(E.hz); x.bits = parseInt(E.bits, 10);
    x.mw = num(E.mw); x.mh = num(E.mh);
    x.proc = procEscolhido();
    x.transp = transporteAtual();
    x.margem = Math.min(100, Math.max(1, num(E.margem) || 100));
    x.cap = x.transp && x.transp.gbps > 0 ? x.transp.gbps * x.margem / 100 : null;
    x.esc = x.mw > 0 && x.mh > 0 ? { cw: x.mw / 1000, ch: x.mh / 1000, m: true } : { cw: 1, ch: 1, m: false };
    if (!(C >= 1 && R >= 1 && rx >= 1 && ry >= 1)) { x.falta = "ecra"; return x; }
    x.C = C; x.R = R; x.rx = rx; x.ry = ry;
    x.g = L.grelhaUniforme(C, R, rx, ry);
    x.totalPx = x.g.total;
    if (!(x.hz > 0)) { x.falta = "hz"; return x; }
    x.debito = L.debitoGbps(x.totalPx, x.hz, x.bits, 3);
    x.gbpsPorPx = x.debito / x.totalPx;
    x.portaTipo = E.tipoPorta === "fibra" && !(x.proc && x.proc.optica) ? "eth" : E.tipoPorta;
    x.portPx = L.pxPorPorta({ tipo: x.portaTipo, portGbpsUsable: x.proc && x.proc.portGbpsUsable, bits: x.bits, hz: x.hz, manualPx: num(E.pxManual) });
    x.ok = true;
    return x;
  }

  function chaveMemo(x, portPx) { return [x.C, x.R, x.rx, x.ry, portPx, E.entrada, x.esc.cw, x.esc.ch].join("|"); }
  function sugestoes(x, portPx) {
    var k = chaveMemo(x, portPx);
    if (!memo[k]) { var chaves = Object.keys(memo); if (chaves.length > 40) memo = {}; memo[k] = L.sugerir(x.g, portPx, E.entrada, x.esc); }
    return memo[k];
  }

  function calcular() {
    var x = contexto();
    if (!x.ok) return x;
    if (!(x.portPx > 0)) { x.semPorta = true; return x; }
    x.K = Math.floor((x.portPx + 1e-9) / x.g.maxPx);
    x.sug = sugestoes(x, x.portPx);
    var cfg = E.cfg || x.sug.sugestoes[0].cfg;
    x.cfg = cfg;
    x.esq = L.construir(x.g, cfg, x.portPx);
    x.m = L.medir(x.g, x.esq, E.entrada, x.portPx, x.esc);
    x.portas = x.esq.portas;
    x.liga = x.cap ? L.dividirLigacoes(x.portas, x.gbpsPorPx, x.cap) : { estado: "sem-dados" };
    x.disp = Math.round(num(E.disp));
    x.nPortas = x.portas.length;
    // Unidades de processador (a mesma conta da aba Sinal).
    if (x.proc && x.portaTipo === "eth") {
      var pp = x.proc, unidCap = Math.min(x.portPx * pp.ports, pp.maxPixelsHardCap || Infinity);
      x.unidades = Math.max(Math.ceil(x.nPortas / pp.ports), Math.ceil(x.totalPx / unidCap));
    }
    // Comparação de transportes (com o esquema desenhado).
    x.comp = L.tabelaTransportes(x.portas, x.gbpsPorPx, TRANSPORTES.filter(function (t) { return t.grupo !== "Processadores de LED (dados da app)"; }), x.margem);
    // Tabela por bits (a melhor sugestão de cada um).
    x.tabBits = L.tabelaBits({ g: x.g, hz: x.hz, tipoPorta: x.portaTipo, portGbpsUsable: x.proc && x.proc.portGbpsUsable, pxManual: num(E.pxManual), lado: E.entrada, esc: x.esc, cap: x.cap || 0 });
    // Corrente (a conta da v4.68), se houver dados.
    if (root.correnteSerie && num(E.amp) > 0 && num(E.ampmax) > 0) {
      x.corr = root.correnteSerie.calcular({ imax: num(E.ampmax), icab: num(E.amp), n: x.C * x.R, margemPct: root.correnteSerie.parametros().margem });
    }
    return x;
  }

  // ---------------------------------------------------------- apresentação
  function gb(x) { return nf(x, 2) + " Gb/s"; }
  function nomeBits(b) { return b + "-bit"; }

  function textoTransporte(t) {
    if (!t) return "sem dados";
    return t.nome + " (" + nf(t.gbps, t.gbps % 1 ? 2 : 0) + " Gb/s por ligação)";
  }
  function etiqueta(t) {
    if (!t) return "";
    if (t.indicadoPeloMike) return '<span class="lw-tag lw-tag-mike">indicado pelo Mike</span>';
    if (t.manual) return '<span class="lw-tag">valor à mão</span>';
    var c = t.confianca === "norma" ? "norma" : t.confianca === "indicativo" ? "indicativo" : esc(t.confianca || "");
    return '<span class="lw-tag">' + c + "</span>";
  }

  function preencherSelects() {
    // Controlador
    var ps = processadores().slice().sort(function (a, b) { return (a.marca + a.modelo).localeCompare(b.marca + b.modelo, "pt"); });
    var sel = $("lw-proc");
    sel.innerHTML = opc("", "Porta Gigabit genérica (0,93 Gb/s úteis, como no Sinal & Data Rate)", !E.proc) +
      ps.map(function (p) { return opc(chaveProc(p), p.marca + " " + p.modelo + " — " + p.ports + " portas", chaveProc(p) === E.proc); }).join("");
    // Tipo de porta
    var p = procEscolhido();
    $("lw-tipo").innerHTML = opc("eth", "Ethernet (RJ45), com a capacidade da app", E.tipoPorta === "eth") +
      (p && p.optica ? opc("fibra", "Fibra do processador (sem dados da capacidade)", E.tipoPorta === "fibra") : "") +
      opc("manual", "Capacidade por porta à mão", E.tipoPorta === "manual");
    // Transporte
    var grupos = {}, ordem = [];
    TRANSPORTES.forEach(function (t) { if (!grupos[t.grupo]) { grupos[t.grupo] = []; ordem.push(t.grupo); } grupos[t.grupo].push(t); });
    $("lw-transp").innerHTML = ordem.map(function (g) {
      return '<optgroup label="' + esc(g) + '">' + grupos[g].map(function (t) {
        return opc(t.id, t.nome + " — " + nf(t.gbps, t.gbps % 1 ? 2 : 0) + " Gb/s" + (t.indicadoPeloMike ? " (indicado pelo Mike)" : ""), t.id === E.transp);
      }).join("") + "</optgroup>";
    }).join("") + '<optgroup label="Outro">' + opc("outro", "Outro / valor à mão", E.transp === "outro") + "</optgroup>";
  }

  function pintarCampos() {
    ["cols", "rows", "rx", "ry", "mw", "mh", "nits", "hz", "pxManual", "disp", "amp", "ampmax"].forEach(function (k) {
      var id = { pxManual: "lw-pxmanual", ampmax: "lw-ampmax" }[k] || "lw-" + k;
      var el = $(id); if (el && root.document.activeElement !== el) el.value = E[k] == null ? "" : E[k];
    });
    var cm = $("lw-cap"); if (cm && root.document.activeElement !== cm) cm.value = E.capManual;
    var mg = $("lw-margem"); if (mg && root.document.activeElement !== mg) mg.value = E.margem;
    $("lw-link").checked = !!E.link;
    $("lw-bits").value = String(E.bits);
    $("lw-entrada").value = E.entrada; $("lw-montagem").value = E.montagem;
    $("lw-cabos").checked = !!E.cabos; $("lw-corrente").checked = !!E.corrente;
    $("lw-colorir").value = E.colorir; $("lw-tam").value = E.tam;
    $("lw-addproject").checked = !!E.noProjeto;
    $("lw-pxmanual-wrap").style.display = E.tipoPorta === "manual" ? "block" : "none";
    $("lw-cap-wrap").style.display = E.transp === "outro" ? "block" : "none";
    raiz.querySelectorAll(".lw-subbtn").forEach(function (b) {
      var a = b.dataset.sub === E.sub; b.classList.toggle("active", a); b.setAttribute("aria-selected", a ? "true" : "false");
    });
    ["transporte", "divisao", "ligacao"].forEach(function (s) { $("lw-p-" + s).style.display = s === E.sub ? "block" : "none"; });
  }

  function leituraFisica(x) {
    if (!x.ok) return '<div class="item wide"><div class="k">Falta o ecrã</div><div class="v">—</div></div>';
    var w = x.mw > 0 ? x.C * x.mw / 1000 : null, h = x.mh > 0 ? x.R * x.mh / 1000 : null;
    var pitch = x.mw > 0 ? x.mw / x.rx : null;
    var pw = x.C * x.rx, ph = x.R * x.ry;
    var it = function (k, v, wide) { return '<div class="item' + (wide ? " wide" : "") + '"><div class="k">' + k + '</div><div class="v">' + v + "</div></div>"; };
    return it("Resolução", ni(pw) + " × " + ni(ph) + "<small>px</small>") +
      (w ? it("Tamanho", nf(w, 2) + " × " + nf(h, 2) + "<small>m</small>") : "") +
      (w ? it("Área", nf(w * h, 2) + "<small>m²</small>") : "") +
      (pitch ? it("Pixel pitch", nf(pitch, 2) + "<small>mm</small>") : "") +
      it("Formato", typeof root.describeRatio === "function" ? root.describeRatio(pw, ph) : nf(pw / ph, 2) + ":1") +
      (num(E.nits) > 0 ? it("Brilho", ni(num(E.nits)) + "<small>nits</small>") : "") +
      it("Gabinetes", ni(x.C * x.R));
  }

  function leituraSinal(x) {
    if (!x.ok) return "";
    var it = function (k, v, wide) { return '<div class="item' + (wide ? " wide" : "") + '"><div class="k">' + k + '</div><div class="v">' + v + "</div></div>"; };
    var h = it("Débito total", nf(x.debito, 2) + "<small>Gb/s</small>");
    if (x.liga && x.liga.estado === "ok") {
      h += it("Ligações", ni(x.liga.n) + "<small>de " + nf(x.transp.gbps, x.transp.gbps % 1 ? 2 : 0) + " Gb/s</small>");
      h += it("Mais carregada", nf(x.liga.max / x.transp.gbps * 100, 0) + "<small>%</small>");
    } else h += it("Ligações", "sem dados");
    if (x.semPorta) h += it("Portas", "sem dados");
    else {
      h += it("Gabinetes por porta", ni(x.K) + (x.K < 1 ? "<small>⚠</small>" : ""));
      h += it("Portas", ni(x.nPortas));
      h += it("Enchimento das portas", nf(x.m.fillMin, 0) + "–" + nf(x.m.fillMax, 0) + "<small>%</small>");
    }
    return h;
  }

  function avisosGerais(x) {
    var av = [];
    if (!x.ok) {
      av.push(x.falta === "hz" ? "Indica o refresh (Hz)." : "Indica os gabinetes na horizontal e na vertical e os píxeis de cada gabinete — ou traz o ecrã da aba Ecrã LED & Pixel Pitch.");
      return av;
    }
    if (!x.transp || !(x.transp.gbps > 0)) av.push("Sem dados: escolhe um transporte ou indica a capacidade por ligação à mão.");
    if (x.semPorta) av.push("Sem dados: " + (E.tipoPorta === "fibra" ? "a capacidade em píxeis da fibra deste processador não está nos dados da app (só há o débito nominal). Escolhe «Capacidade por porta à mão» se a souberes." : "indica os píxeis por porta."));
    else {
      if (x.K < 1) av.push("⚠ Um só gabinete (" + ni(x.g.maxPx) + " px) já excede uma porta (" + ni(x.portPx) + " px) a " + nf(x.hz, 0) + " Hz e " + x.bits + " bits. Baixa o refresh ou os bits.");
      else if (x.m.sobre) av.push("⚠ " + x.m.sobre + (x.m.sobre === 1 ? " porta ultrapassa" : " portas ultrapassam") + " a capacidade.");
      if (x.disp >= 1 && x.nPortas > x.disp) av.push("⚠ Faltam " + (x.nPortas - x.disp) + " portas: os gabinetes das portas " + (x.disp + 1) + " a " + x.nPortas + " ficam sem ligação.");
    }
    if (x.liga && x.liga.estado === "ok" && x.liga.max > x.cap + 1e-9) av.push("⚠ Pelo menos uma ligação passa o limite de " + nf(x.cap, 2) + " Gb/s. " + sugestaoExcede(x));
    if (x.transp && x.transp.gbpsUtil && x.liga && x.liga.estado === "ok" && x.liga.max > x.transp.gbpsUtil + 1e-9)
      av.push("Atenção: a ligação mais carregada (" + nf(x.liga.max, 2) + " Gb/s) passa o débito útil que a fonte indica para " + x.transp.nome + " (" + nf(x.transp.gbpsUtil, 2) + " Gb/s); a conta usa o nominal.");
    if (x.portaTipo === "eth" && E.link === false) { /* valores só deste ecrã: nada a avisar */ }
    return av;
  }

  function sugestaoExcede(x) {
    var o = [];
    var tenta = function (bits, hz) {
      var d = L.debitoGbps(x.totalPx, hz, bits, 3);
      return d / x.totalPx;
    };
    if (x.bits > 8) o.push("baixar para 8 bits");
    if (x.hz > 50) o.push("baixar o refresh para 50 Hz");
    o.push("usar um transporte de maior capacidade");
    o.push("dividir por mais ligações (mais portas, cada uma com menos gabinetes)");
    return "Sugestão: " + o.join(", ") + ".";
  }

  function htmlAvisos(av) {
    return av.map(function (a) {
      var vermelho = /^⚠/.test(a);
      return '<div class="' + (vermelho ? "warn lw-aviso" : "note lw-aviso-suave") + '">' + esc(a) + "</div>";
    }).join("");
  }

  // ---- Transporte
  function pintarTransporte(x) {
    var t = x.transp, h = "";
    if (t && t.gbps > 0) {
      h += '<div class="lw-info"><div><strong>' + esc(t.nome) + "</strong> " + etiqueta(t) + "</div>" +
        '<div>Capacidade nominal: <strong>' + nf(t.gbps, t.gbps % 1 ? 2 : 0) + " Gb/s</strong> por ligação · usável com a margem: <strong>" + nf(x.cap, 2) + " Gb/s</strong></div>" +
        (t.gbpsUtil ? "<div>Débito útil indicado pela fonte: " + nf(t.gbpsUtil, 2) + " Gb/s (a conta usa o nominal; a margem cobre a diferença).</div>" : "") +
        (t.nota ? '<div class="hint">' + esc(t.nota) + "</div>" : "") +
        (t.fonte ? "<div>" + (typeof root.srcLinkHtml === "function" ? root.srcLinkHtml(t.fonte, "Fonte") : "") + "</div>" : "") + "</div>";
    } else h += '<div class="note">Sem dados: escolhe um transporte da lista ou «Outro / valor à mão».</div>';
    $("lw-transp-info").innerHTML = h;
    if (!x.ok || !x.comp) { $("lw-comp").innerHTML = '<div class="note">Indica o ecrã para comparar.</div>'; return; }
    var rows = x.comp.map(function (c) {
      var sel = c.t.id === E.transp;
      var av = c.aviso === "acima" ? "⚠ acima do limite" : c.aviso === "acima-util" ? "⚠ acima do débito útil da fonte" : "—";
      return '<button type="button" class="lw-linhatab' + (sel ? " ativa" : "") + (c.aviso === "acima" ? " lw-mau" : "") + '" data-transp="' + esc(c.t.id) + '">' +
        '<span class="lw-c1">' + esc(c.t.nome) + (c.t.indicadoPeloMike ? " <em>(indicado pelo Mike)</em>" : "") + " · " + nf(c.t.gbps, c.t.gbps % 1 ? 2 : 0) + ' Gb/s</span>' +
        '<span class="lw-c2">' + (c.n != null ? ni(c.n) : "—") + '</span><span class="lw-c3">' + (c.fillMax != null ? nf(c.fillMax, 0) + " %" : "—") + '</span><span class="lw-c4">' + av + "</span></button>";
    }).join("");
    $("lw-comp").innerHTML = '<div class="lw-tabela lw-tab-comp"><div class="lw-linhatab lw-cab"><span class="lw-c1">Transporte</span><span class="lw-c2">Ligações</span><span class="lw-c3">Enchimento máx.</span><span class="lw-c4">Aviso</span></div>' + rows +
      '<button type="button" class="lw-linhatab' + (E.transp === "outro" ? " ativa" : "") + '" data-transp="outro"><span class="lw-c1">Outro / valor à mão</span><span class="lw-c2">' + (E.transp === "outro" && x.liga && x.liga.n ? ni(x.liga.n) : "—") + '</span><span class="lw-c3">—</span><span class="lw-c4">escolhe e indica os Gb/s</span></button></div>';
  }

  // ---- Divisão
  function zonaDoGrupo(x, g) {
    var cols = {}, rows = {}, n = 0, px = 0;
    for (var i = g.ini; i <= g.fim; i++) x.portas[i].cels.forEach(function (c) { cols[c.c] = 1; rows[c.r] = 1; n++; });
    var cs = Object.keys(cols).map(Number).sort(function (a, b) { return a - b; }), rs = Object.keys(rows).map(Number).sort(function (a, b) { return a - b; });
    return { n: n, c0: cs[0] + 1, c1: cs[cs.length - 1] + 1, r0: rs[0] + 1, r1: rs[rs.length - 1] + 1 };
  }
  function pintarDivisao(x) {
    var box = $("lw-div-resumo"), lst = $("lw-div-lista");
    if (!x.ok || x.semPorta) { box.innerHTML = ""; lst.innerHTML = '<div class="note">' + esc(avisosGerais(x)[0] || "Sem dados.") + "</div>"; $("lw-div-avisos").innerHTML = ""; return; }
    if (!x.liga || x.liga.estado !== "ok") { box.innerHTML = ""; lst.innerHTML = '<div class="note">Sem dados: escolhe o transporte (capacidade por ligação) no separador Transporte.</div>'; $("lw-div-avisos").innerHTML = ""; return; }
    var l = x.liga, soma = 0;
    l.grupos.forEach(function (g) { soma += g.rate; });
    box.innerHTML = '<p class="lw-frase">O sinal total de <strong>' + gb(x.debito) + "</strong> (" + ni(x.totalPx) + " px × " + nf(x.hz, 0) + " Hz × " + x.bits + " bits × 3 canais) divide-se em <strong>" + ni(l.n) + (l.n === 1 ? " ligação" : " ligações") +
      "</strong> de " + nf(x.transp.gbps, x.transp.gbps % 1 ? 2 : 0) + " Gb/s" + (x.margem < 100 ? " (usáveis " + nf(x.cap, 2) + " Gb/s, margem " + nf(x.margem, 0) + " %)" : "") + ", repartidas por igual. Soma das ligações: " + gb(soma) + ".</p>";
    $("lw-div-avisos").innerHTML = htmlAvisos(avisosGerais(x).filter(function (a) { return /ligação|útil|Sem dados/.test(a); }));
    lst.innerHTML = l.grupos.map(function (g, i) {
      var z = zonaDoGrupo(x, g), pct = g.rate / x.transp.gbps * 100, mau = g.rate > x.cap + 1e-9;
      return '<div class="lw-liga' + (mau ? " lw-mau" : "") + '"><div class="lw-liga-topo"><span class="lw-chip" style="background:var(--lw-c' + (i % PALETA) + ')"></span><strong>Ligação ' + (i + 1) + "</strong>" +
        '<span class="lw-liga-v">' + gb(g.rate) + " · " + nf(pct, 0) + " %" + (mau ? " ⚠" : "") + "</span></div>" +
        '<div class="lw-barra"><span style="width:' + Math.min(100, pct) + '%;background:var(--lw-c' + (i % PALETA) + ')"></span></div>' +
        '<div class="hint">Portas ' + (g.ini + 1) + (g.fim > g.ini ? "–" + (g.fim + 1) : "") + " · " + ni(z.n) + " gabinetes · colunas " + z.c0 + "–" + z.c1 + ", linhas " + z.r0 + "–" + z.r1 + "</div></div>";
    }).join("");
  }

  function pintarBits(x) {
    var box = $("lw-bits-tab");
    if (!x.ok) { box.innerHTML = ""; return; }
    $("lw-bits-hint").textContent = "A " + nf(x.hz, 0) + " Hz, com a melhor sugestão de ligação para cada profundidade de cor. A 10 e 12 bits a conta das portas é a mesma (a NovaStar conta 48 bits por píxel); o débito do sinal não.";
    var cab = '<div class="lw-linhatab lw-cab"><span class="lw-c1"></span>' + x.tabBits.map(function (t) { return '<span class="lw-cb' + (t.bits === x.bits ? " ativa" : "") + '">' + t.bits + " bits</span>"; }).join("") + "</div>";
    var linha = function (rot, f) { return '<div class="lw-linhatab"><span class="lw-c1">' + rot + "</span>" + x.tabBits.map(function (t) { return '<span class="lw-cb' + (t.bits === x.bits ? " ativa" : "") + '">' + f(t) + "</span>"; }).join("") + "</div>"; };
    var capNom = x.transp && x.transp.gbps > 0 ? nf(x.transp.gbps, x.transp.gbps % 1 ? 2 : 0) : null;
    box.innerHTML = '<div class="lw-tabela">' + cab +
      linha("Débito total", function (t) { return t.debito != null ? nf(t.debito, 2) + " Gb/s" : "—"; }) +
      linha("Píxeis por porta", function (t) { return t.portPx ? ni(t.portPx) : "sem dados"; }) +
      linha("Gabinetes por porta", function (t) { return t.K != null ? (t.K < 1 ? "⚠ 0" : ni(t.K)) : "—"; }) +
      linha("Portas", function (t) { return t.P ? ni(t.P) : "—"; }) +
      linha("Enchimento das portas", function (t) { return t.fillMin != null ? nf(t.fillMin, 0) + "–" + nf(t.fillMax, 0) + " %" : "—"; }) +
      linha(capNom ? "Ligações de " + capNom + " Gb/s" : "Ligações", function (t) { return t.lig && t.lig.estado === "ok" ? ni(t.lig.n) : "—"; }) +
      linha("Mais carregada", function (t) { return t.lig && t.lig.estado === "ok" && x.transp ? nf(t.lig.max / x.transp.gbps * 100, 0) + " %" : "—"; }) +
      "</div>";
  }

  // ---- Ligação
  function pintarLigacao(x) {
    var res = $("lw-lig-res");
    if (!x.ok || x.semPorta) {
      res.innerHTML = ""; $("lw-sug").innerHTML = ""; $("lw-svg-wrap").innerHTML = ""; $("lw-leg").innerHTML = ""; $("lw-portas").innerHTML = "";
      $("lw-lig-avisos").innerHTML = htmlAvisos(avisosGerais(x).slice(0, 1)); return;
    }
    var it = function (k, v, wide) { return '<div class="item' + (wide ? " wide" : "") + '"><div class="k">' + k + '</div><div class="v">' + v + "</div></div>"; };
    res.innerHTML = it("Píxeis por porta", ni(x.portPx) + "<small>px</small>") + it("Gabinete", ni(x.rx) + "×" + ni(x.ry) + "<small>px</small>") +
      it("Gabinetes por porta", x.K < 1 ? "⚠ 0" : ni(x.K)) + it("Portas", ni(x.nPortas)) +
      it("Enchimento", nf(x.m.fillMin, 0) + "–" + nf(x.m.fillMax, 0) + "<small>%</small>") +
      it("Retornos", ni(x.m.retornos)) +
      (x.unidades ? it(x.proc.marca + " " + x.proc.modelo, ni(x.unidades) + "×<small>" + ni(x.proc.ports) + " portas</small>", true) : "") +
      (x.corr && x.corr.estado === "ok" ? it("Corrente", ni(x.corr.M) + "<small>entradas (até " + ni(x.corr.N) + " em série)</small>", true) : "");
    var avs = avisosGerais(x).filter(function (a) { return /portas|Um só gabinete|ultrapass/.test(a); });
    $("lw-lig-avisos").innerHTML = htmlAvisos(avs);

    // sugestões
    var sel = JSON.stringify(sigCfg(x.cfg, x.esq.bloco));
    $("lw-sug").innerHTML = x.sug.sugestoes.map(function (s, i) {
      var tit = { facil: "Mais fácil de montar", portas: "Menos portas", cabo: "Menos cabo", simples: "Filas inteiras por porta", equilibrio: "Mais equilibrada" }[s.chave];
      var ativa = JSON.stringify(sigCfg(s.cfg, s.esq.bloco)) === sel;
      return '<button type="button" class="lw-sugcard' + (ativa ? " ativa" : "") + '" data-sug="' + i + '"><span class="lw-sugtit">' + (i === 0 ? "★ " : "") + tit + (i === 0 ? " — sugestão principal" : "") +
        '</span><span class="lw-sugn">' + ni(s.m.P) + " portas · " + nf(s.m.fillMin, 0) + "–" + nf(s.m.fillMax, 0) + " % · " + ni(s.m.retornos) + " retornos · cabo " + (x.esc.m ? nf(s.m.cabo, 0) + " m" : nf(s.m.cabo, 0) + " gab.") + "</span>" +
        '<span class="lw-sugdesc">' + esc(s.desc.charAt(0).toUpperCase() + s.desc.slice(1)) + ".</span><span class=\"lw-sugraz\">" + esc(s.razao) + "</span></button>";
    }).join("");

    // controlos à mão
    $("lw-canto").value = x.cfg.canto; $("lw-eixo").value = x.cfg.eixo; $("lw-padrao").value = x.cfg.padrao; $("lw-forma").value = x.cfg.forma;

    desenhar(x);
    legenda(x);
  }

  function sigCfg(c, b) { return [c.canto, c.eixo, c.padrao, c.forma, c.forma === "blocos" && b ? b.w + "x" + b.h : ""]; }

  function ligacaoDaPorta(x) {
    var v = []; if (!x.liga || x.liga.estado !== "ok") return v;
    x.liga.grupos.forEach(function (g, i) { for (var p = g.ini; p <= g.fim; p++) v[p] = i; });
    return v;
  }

  function legenda(x) {
    var lp = ligacaoDaPorta(x), partes = [];
    if (x.liga && x.liga.estado === "ok") {
      partes.push('<div class="lw-leg-lista">' + x.liga.grupos.map(function (g, i) {
        return '<span class="lw-leg-item"><span class="lw-chip" style="background:var(--lw-c' + (i % PALETA) + ')"></span>Ligação ' + (i + 1) + " · portas " + (g.ini + 1) + (g.fim > g.ini ? "–" + (g.fim + 1) : "") + " · " + gb(g.rate) + "</span>";
      }).join("") + "</div>");
    }
    partes.push('<div class="hint">O número redondo marca onde cada porta começa; as linhas seguem o cabo de gabinete em gabinete' + (E.cabos ? "; as linhas a tracejado vão da entrada ao início de cada porta" : "") + ". Sem ligação: gabinetes às riscas vermelhas.</div>");
    $("lw-leg").innerHTML = partes.join("");
    $("lw-portas").innerHTML = '<div class="lw-tabela lw-tab-portas"><div class="lw-linhatab lw-cab"><span class="lw-c1">Porta</span><span class="lw-c2">Ligação</span><span class="lw-c3">Gabinetes</span><span class="lw-c4">Enchimento</span></div>' +
      x.portas.map(function (p, i) {
        var mau = p.px > x.portPx + 1e-9, sem = x.disp >= 1 && i >= x.disp;
        return '<div class="lw-linhatab' + (mau || sem ? " lw-mau" : "") + '"><span class="lw-c1">' + (i + 1) + '</span><span class="lw-c2">' + (lp[i] != null ? lp[i] + 1 : "—") + '</span><span class="lw-c3">' + ni(p.cels.length) + '</span><span class="lw-c4">' + nf(p.fill, 0) + " %" + (mau ? " ⚠" : sem ? " sem ligação" : "") + "</span></div>";
      }).join("") + "</div>";
  }

  // ---- Desenho SVG
  function desenhar(x) {
    var wrap = $("lw-svg-wrap"), S0 = 20, M = 34, C = x.C, R = x.R;
    var W = C * S0 + 2 * M, H = R * S0 + 2 * M;
    var larg = wrap.clientWidth || 340;
    var escala = E.tam === "grande" ? 1.25 : larg / W;
    var pxCel = S0 * escala;
    var lp = ligacaoDaPorta(x), porLigacao = E.colorir === "ligacao" && x.liga && x.liga.estado === "ok";
    var cor = function (i) { return "var(--lw-c" + ((porLigacao ? lp[i] || 0 : i) % PALETA) + ")"; };
    var sem = function (i) { return x.disp >= 1 && i >= x.disp; };
    var cx = function (c) { return M + c * S0 + S0 / 2; }, cy = function (r) { return M + r * S0 + S0 / 2; };
    var s = '<svg id="lw-svg" role="img" aria-label="Desenho da ligação dos gabinetes" viewBox="0 0 ' + W + " " + H + '" width="' + (E.tam === "grande" ? Math.round(W * escala) : "100%") + '" style="display:block;' + (E.tam === "grande" ? "max-width:none;" : "") + '">' +
      '<defs><pattern id="lw-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" style="fill:var(--lw-semfundo)"/><line x1="0" y1="0" x2="0" y2="6" style="stroke:var(--lw-erro);stroke-width:2.2"/></pattern></defs>';
    // gabinetes
    x.portas.forEach(function (p, i) {
      p.cels.forEach(function (c, k) {
        s += '<rect x="' + (M + c.c * S0 + 0.5) + '" y="' + (M + c.r * S0 + 0.5) + '" width="' + (S0 - 1) + '" height="' + (S0 - 1) + '" rx="2" style="fill:' + (sem(i) ? "url(#lw-hatch)" : cor(i)) + ";fill-opacity:" + (sem(i) ? 1 : 0.28) + ';stroke:var(--line);stroke-width:0.6"/>';
        if (pxCel >= 17 && !sem(i)) s += '<text x="' + cx(c.c) + '" y="' + (cy(c.r) + 3.2) + '" text-anchor="middle" style="font:600 ' + (S0 * 0.4) + 'px system-ui,sans-serif;fill:var(--ink)">' + (k + 1) + "</text>";
      });
    });
    // corrente
    if (E.corrente && x.corr && x.corr.estado === "ok") {
      var seq = L.retangulo(L.quadro(x.g, { canto: x.cfg.canto, eixo: "linhas" }), 0, C, 0, R, true);
      var cadeias = L.cortar(seq, function () { return 1; }, x.corr.N, "equilibrada");
      cadeias.forEach(function (ch) {
        s += '<polyline points="' + ch.map(function (c) { return (cx(c.c) + 3) + "," + (cy(c.r) + 3); }).join(" ") + '" fill="none" style="stroke:var(--lw-corr);stroke-width:1.6;stroke-dasharray:5 3;stroke-linejoin:round"/>';
      });
    }
    // entrada
    var E0 = L.pontoEntrada(x.g, E.entrada), ex = M + E0.x * S0, ey = M + E0.y * S0;
    var bx = ex, by = ey, tw = 62, th = 16, dx = 0, dy = 0;
    if (E.entrada === "baixo") { by = ey + 12; dy = 1; } else if (E.entrada === "topo") { by = ey - 12; dy = -1; } else if (E.entrada === "esq") { bx = ex - 30; } else { bx = ex + 30; }
    x.portas.forEach(function (p, i) {
      if (!E.cabos || sem(i)) return;
      var f = p.cels[0];
      s += '<line x1="' + ex + '" y1="' + ey + '" x2="' + cx(f.c) + '" y2="' + cy(f.r) + '" style="stroke:' + cor(i) + ';stroke-width:1;stroke-dasharray:3 3;stroke-opacity:0.65"/>';
    });
    // percursos
    x.portas.forEach(function (p, i) {
      if (sem(i) || p.cels.length < 2) return;
      s += '<polyline points="' + p.cels.map(function (c) { return cx(c.c) + "," + cy(c.r); }).join(" ") + '" fill="none" style="stroke:' + cor(i) + ';stroke-width:2.4;stroke-linejoin:round;stroke-linecap:round"/>';
    });
    // inícios
    var rb = Math.max(S0 * 0.34, 7 / escala);
    x.portas.forEach(function (p, i) {
      if (sem(i)) return;
      var f = p.cels[0], mau = p.px > x.portPx + 1e-9;
      s += '<circle cx="' + cx(f.c) + '" cy="' + cy(f.r) + '" r="' + rb + '" style="fill:' + cor(i) + ";stroke:" + (mau ? "var(--lw-erro)" : "var(--paper-raised)") + ';stroke-width:' + (mau ? 2.2 : 1.2) + '"/>';
      if (rb * escala >= 6.5) s += '<text x="' + cx(f.c) + '" y="' + (cy(f.r) + rb * 0.36) + '" text-anchor="middle" style="font:700 ' + rb * 1.05 + 'px system-ui,sans-serif;fill:#fff">' + (i + 1) + "</text>";
    });
    // caixa da entrada
    s += '<rect x="' + (bx - tw / 2) + '" y="' + (by - th / 2) + '" width="' + tw + '" height="' + th + '" rx="3" style="fill:var(--ink);fill-opacity:0.9"/><text x="' + bx + '" y="' + (by + 4) + '" text-anchor="middle" style="font:700 10px system-ui,sans-serif;fill:var(--paper-raised)">Entrada</text>';
    // cantos clicáveis
    var cantos = { SE: [0, 0], SD: [C - 1, 0], IE: [0, R - 1], ID: [C - 1, R - 1] };
    Object.keys(cantos).forEach(function (k) {
      var c = cantos[k], ativo = x.cfg.canto === k;
      s += '<rect class="lw-alvo" data-canto="' + k + '" x="' + (M + c[0] * S0 - 1) + '" y="' + (M + c[1] * S0 - 1) + '" width="' + (S0 + 2) + '" height="' + (S0 + 2) + '" rx="3" style="fill:transparent;stroke:' + (ativo ? "var(--ink)" : "var(--ink-faint)") + ";stroke-width:" + (ativo ? 2 : 1) + ';stroke-dasharray:' + (ativo ? "none" : "2 2") + ';cursor:pointer"><title>Começar neste canto</title></rect>';
    });
    s += "</svg>";
    wrap.innerHTML = s;
    wrap.style.overflowX = E.tam === "grande" ? "auto" : "visible";
  }

  // ---------------------------------------------------------------- resumo
  function resumo(x) {
    var l = [];
    l.push("LED WALL HELP");
    if (!x.ok) { l.push("Ecrã por definir."); return l.join("\n"); }
    var pw = x.C * x.rx, ph = x.R * x.ry;
    l.push("Ecrã: " + x.C + " × " + x.R + " gabinetes (" + (x.mw > 0 ? nf(x.mw, 0) + " × " + nf(x.mh, 0) + " mm, " : "") + ni(x.rx) + " × " + ni(x.ry) + " px cada) = " + ni(pw) + " × " + ni(ph) + " px" +
      (x.mw > 0 ? ", " + nf(x.C * x.mw / 1000, 2) + " × " + nf(x.R * x.mh / 1000, 2) + " m, pitch " + nf(x.mw / x.rx, 2) + " mm" : "") + (num(E.nits) > 0 ? ", " + ni(num(E.nits)) + " nits" : ""));
    l.push("Sinal: " + nf(x.hz, 0) + " Hz, " + x.bits + "-bit, 3 canais — débito total " + gb(x.debito));
    if (x.transp && x.transp.gbps > 0) {
      l.push("Transporte: " + x.transp.nome + " — " + nf(x.transp.gbps, x.transp.gbps % 1 ? 2 : 0) + " Gb/s por ligação" + (x.transp.indicadoPeloMike ? " (indicado pelo Mike, a confirmar na ficha)" : x.transp.manual ? " (valor à mão)" : " (nominal)") + ", margem " + nf(x.margem, 0) + " %");
      if (x.liga && x.liga.estado === "ok") {
        l.push("Divisão: " + ni(x.liga.n) + (x.liga.n === 1 ? " ligação" : " ligações") + ", a mais carregada com " + nf(x.liga.max / x.transp.gbps * 100, 0) + " % (soma " + gb(x.liga.grupos.reduce(function (s, g) { return s + g.rate; }, 0)) + ")");
        x.liga.grupos.forEach(function (g, i) {
          var z = zonaDoGrupo(x, g);
          l.push("    Ligação " + (i + 1) + ": " + gb(g.rate) + " (" + nf(g.rate / x.transp.gbps * 100, 0) + " %) — portas " + (g.ini + 1) + (g.fim > g.ini ? "–" + (g.fim + 1) : "") + ", " + ni(z.n) + " gabinetes");
        });
        if (x.liga.max > x.cap + 1e-9) l.push("⚠ Pelo menos uma ligação passa o limite de " + nf(x.cap, 2) + " Gb/s.");
      }
    } else l.push("Transporte: sem dados (escolher o tipo ou indicar a capacidade).");
    if (x.semPorta) l.push("Portas: sem dados (" + (E.tipoPorta === "fibra" ? "capacidade em píxeis da fibra não está nos dados" : "indicar os píxeis por porta") + ")");
    else {
      l.push("Portas: " + (x.proc ? x.proc.marca + " " + x.proc.modelo : "porta Gigabit genérica") + " — " + ni(x.portPx) + " px por porta, " + ni(x.K) + " gabinetes por porta, " + ni(x.nPortas) + " portas, enchimento " + nf(x.m.fillMin, 0) + "–" + nf(x.m.fillMax, 0) + " %" + (x.unidades ? ", " + ni(x.unidades) + "× " + x.proc.modelo : ""));
      if (x.K < 1) l.push("⚠ Um só gabinete excede uma porta a este refresh e bits.");
      var dsc = L.descreverCfg(x.cfg, x.esq.bloco);
      l.push("Ligação dos gabinetes: " + dsc + "; entrada " + L.LADOS[E.entrada] + " (montagem " + (E.montagem === "pendurada" ? "pendurada" : "empilhada no chão") + "); " + ni(x.m.retornos) + " retornos");
      x.portas.forEach(function (p, i) {
        var a = p.cels[0], b = p.cels[p.cels.length - 1];
        l.push("    Porta " + (i + 1) + ": " + ni(p.cels.length) + " gabinetes, " + nf(p.fill, 0) + " %, de (coluna " + (a.c + 1) + ", linha " + (a.r + 1) + ") a (coluna " + (b.c + 1) + ", linha " + (b.r + 1) + ")");
      });
      if (x.disp >= 1 && x.nPortas > x.disp) l.push("⚠ Faltam " + (x.nPortas - x.disp) + " portas: gabinetes das portas " + (x.disp + 1) + " a " + x.nPortas + " sem ligação.");
    }
    if (x.corr && x.corr.estado === "ok") l.push("Alimentação: " + ni(x.corr.M) + " entradas, até " + ni(x.corr.N) + " gabinetes em série por entrada.");
    return l.join("\n");
  }

  // ------------------------------------------------------------- tradução EN
  var ATTRS = ["title", "placeholder", "aria-label"];
  var DICT_EN = null, CHAVES_EN = null;
  function idioma() { return typeof root.i18nGetLang === "function" ? root.i18nGetLang() : (root.document.documentElement.lang || "pt"); }
  function dicionario() {
    if (!DICT_EN && root.LEDWALL_EN) {
      DICT_EN = root.LEDWALL_EN.frases;
      CHAVES_EN = Object.keys(DICT_EN).sort(function (a, b) { return b.length - a.length; });
    }
    return DICT_EN;
  }
  var ehLetra = function (c) { return !!c && /[A-Za-zÀ-ÖØ-öø-ÿ0-9]/.test(c); };
  function trStr(s) {
    var out = s;
    for (var i = 0; i < CHAVES_EN.length; i++) {
      var k = CHAVES_EN[i], ini = ehLetra(k.charAt(0)), fim = ehLetra(k.charAt(k.length - 1));
      var idx = out.indexOf(k);
      while (idx !== -1) {
        var antes = idx > 0 ? out.charAt(idx - 1) : "", depois = idx + k.length < out.length ? out.charAt(idx + k.length) : "";
        if ((!ini || !ehLetra(antes)) && (!fim || !ehLetra(depois))) {
          var r = DICT_EN[k]; out = out.slice(0, idx) + r + out.slice(idx + k.length); idx = out.indexOf(k, idx + r.length);
        } else idx = out.indexOf(k, idx + 1);
      }
    }
    return out;
  }
  function trNo(base) {
    var t = base.trim(), ex = root.LEDWALL_EN.exatas;
    if (t && Object.prototype.hasOwnProperty.call(ex, t)) return base.replace(t, ex[t]);
    return trStr(base);
  }
  function traduzirPainel() {
    var en = idioma() === "en";
    if (en && !dicionario()) return;
    var w = root.document.createTreeWalker(raiz, NodeFilter.SHOW_TEXT, null), n, nos = [];
    while ((n = w.nextNode())) nos.push(n);
    nos.forEach(function (no) {
      if (no.__pt === undefined) { if (!en || !no.nodeValue.trim()) return; no.__pt = no.nodeValue; }
      var novo = en ? trNo(no.__pt) : no.__pt;
      if (no.nodeValue !== novo) no.nodeValue = novo;
    });
    raiz.querySelectorAll("[title],[placeholder],[aria-label]").forEach(function (el) {
      ATTRS.forEach(function (a) {
        if (!el.hasAttribute(a)) return;
        el.__pta = el.__pta || {};
        if (el.__pta[a] === undefined) { if (!en) return; el.__pta[a] = el.getAttribute(a); }
        var novo = en ? trStr(el.__pta[a]) : el.__pta[a];
        if (el.getAttribute(a) !== novo) el.setAttribute(a, novo);
      });
    });
  }
  if (root.MutationObserver) new root.MutationObserver(function () { traduzirPainel(); }).observe(root.document.documentElement, { attributes: true, attributeFilter: ["lang"] });

  // ---------------------------------------------------------------- render
  var ultimo = null;
  function render() {
    guardar();
    preencherSelects();
    pintarCampos();
    var x = calcular();
    ultimo = x;
    $("lw-res-fis").innerHTML = leituraFisica(x);
    $("lw-res-sinal").innerHTML = leituraSinal(x);
    $("lw-avisos").innerHTML = htmlAvisos(avisosGerais(x).filter(function (a) { return x.ok ? true : true; }));
    $("lw-link-hint").textContent = E.link ? "Ligado: o refresh, os bits e o controlador são os mesmos da aba Sinal & Data Rate — mudar aqui muda lá, e vice-versa." : "Desligado: estes valores são só deste ecrã e não mexem na aba Sinal & Data Rate.";
    var p = procEscolhido();
    $("lw-proc-hint").textContent = p ? (p.portGbpsUsable ? "Porta com " + nf(p.portGbpsUsable, 2) + " Gb/s úteis (processors.json)." : "Porta GigE: 0,93 Gb/s úteis (processors.json)." ) + (p.maxPixelsHardCap ? " Tecto de " + ni(p.maxPixelsHardCap) + " px por unidade." : "") : "Sem controlador escolhido, usa-se a porta Gigabit genérica da aba Sinal & Data Rate.";
    pintarTransporte(x); pintarDivisao(x); pintarBits(x); pintarLigacao(x);
    var txt = resumo(x);
    $("lw-sum").textContent = txt;
    traduzirPainel();
    if (typeof root.renderProjectItems === "function") root.renderProjectItems();
  }

  // ---------------------------------------------------- ligação ao Sinal
  function lerDoSinal() {
    var f = $("sg-fps"), b = $("sg-bits");
    if (f) E.hz = f.value; if (b) E.bits = b.value;
    E.proc = S.getProc() || "";
  }
  function deSinal() {
    if (sincro) return;
    if (!E.link) return;
    sincro = true;
    try { lerDoSinal(); render(); } finally { sincro = false; }
  }
  function paraSinal(k) {
    if (!E.link || sincro) return;
    sincro = true;
    try {
      if (k === "hz") { var f = $("sg-fps"); if (f && f.value !== String(E.hz)) { f.value = E.hz; f.dispatchEvent(new Event("input", { bubbles: true })); } }
      if (k === "bits") { var b = $("sg-bits"); if (b && b.value !== String(E.bits)) { b.value = E.bits; b.dispatchEvent(new Event("change", { bubbles: true })); } }
      if (k === "proc") S.setProc(E.proc);
    } finally { sincro = false; }
  }

  // -------------------------------------------------------------- eventos
  function mudou(el) {
    var k = el.dataset.k; if (!k) return;
    var v = el.type === "checkbox" ? el.checked : el.value;
    E[k] = v;
    if (k === "montagem") E.entrada = v === "pendurada" ? "topo" : "baixo";
    if (k === "entrada" || k === "bits" || k === "hz" || k === "proc" || k === "tipoPorta") { /* o esquema automático acompanha */ }
    if (k === "link" && v) { sincro = true; try { lerDoSinal(); } finally { sincro = false; } }
    if (k === "proc") {
      var p = procEscolhido();
      if (E.tipoPorta === "fibra" && !(p && p.optica)) E.tipoPorta = "eth";
    }
    render();
    if (k === "hz" || k === "bits" || k === "proc") paraSinal(k);
  }
  raiz.addEventListener("input", function (e) { var t = e.target; if (t.dataset && t.dataset.k && t.type !== "checkbox" && t.tagName !== "SELECT") mudou(t); });
  raiz.addEventListener("change", function (e) {
    var t = e.target;
    if (t.dataset && t.dataset.k && (t.type === "checkbox" || t.tagName === "SELECT")) mudou(t);
    else if (t.id === "lw-canto" || t.id === "lw-eixo" || t.id === "lw-padrao" || t.id === "lw-forma") {
      var base = ultimo && ultimo.cfg ? Object.assign({}, ultimo.cfg) : { canto: "IE", eixo: "linhas", padrao: "serp", forma: "equilibrada", bloco: null };
      base[t.id.slice(3)] = t.value;
      if (t.id !== "lw-forma" && base.forma === "blocos") base.bloco = null;
      if (t.id === "lw-forma") base.bloco = null;
      E.cfg = base; render();
    }
  });
  raiz.addEventListener("click", function (e) {
    var t = e.target.closest ? e.target.closest("button, .lw-alvo") : null;
    if (!t) return;
    if (t.classList.contains("lw-subbtn")) { E.sub = t.dataset.sub; render(); return; }
    if (t.classList.contains("lw-hzbtn")) { E.hz = t.dataset.hz; render(); paraSinal("hz"); return; }
    if (t.dataset && t.dataset.transp) { E.transp = t.dataset.transp; render(); return; }
    if (t.dataset && t.dataset.sug != null && ultimo && ultimo.sug) { var s = ultimo.sug.sugestoes[+t.dataset.sug]; E.cfg = JSON.parse(JSON.stringify(s.cfg)); if (s.esq.bloco) E.cfg.bloco = s.esq.bloco; render(); return; }
    if (t.classList.contains("lw-alvo") || (t.getAttribute && t.getAttribute("data-canto"))) {
      var base = ultimo && ultimo.cfg ? Object.assign({}, ultimo.cfg) : { canto: "IE", eixo: "linhas", padrao: "serp", forma: "equilibrada", bloco: null };
      base.canto = t.getAttribute("data-canto"); if (base.forma === "blocos") base.bloco = null; E.cfg = base; render(); return;
    }
    if (t.id === "lw-trazer") { trazer(true); return; }
    if (t.id === "lw-exemplo") { exemplo(); return; }
  });
  // O SVG não é um "button": os alvos dos cantos
  raiz.addEventListener("click", function (e) {
    var a = e.target && e.target.closest ? e.target.closest("[data-canto]") : null;
    if (!a || !ultimo || !ultimo.cfg) return;
    var base = Object.assign({}, ultimo.cfg); base.canto = a.getAttribute("data-canto"); if (base.forma === "blocos") base.bloco = null;
    E.cfg = base; render();
  });
  $("lw-addproject").addEventListener("change", function () {
    E.noProjeto = this.checked; guardar();
    if (typeof root.renderProjectItems === "function") root.renderProjectItems();
  });
  var redim = null;
  if (root.ResizeObserver) new root.ResizeObserver(function () {
    clearTimeout(redim);
    redim = setTimeout(function () { if (ultimo && ultimo.ok && !ultimo.semPorta && $("lw-p-ligacao").style.display !== "none") { desenhar(ultimo); traduzirPainel(); } }, 120);
  }).observe($("lw-svg-wrap"));

  // ---------------------------------------------- trazer / exemplo / estado
  function valorDe(id) { var el = $(id); return el ? el.value : ""; }
  function trazer(avisar) {
    var mx = valorDe("l-mx"), my = valorDe("l-my"), rx = valorDe("l-rx"), ry = valorDe("l-ry");
    var msg = $("lw-trazer-msg");
    if (!(num(mx) >= 1 && num(my) >= 1 && num(rx) >= 1 && num(ry) >= 1)) {
      if (msg) msg.textContent = "A aba Ecrã LED & Pixel Pitch ainda não tem o ecrã definido (tiles e resolução do módulo).";
      if (avisar && typeof root.showToast === "function") root.showToast("A aba Ecrã LED & Pixel Pitch ainda não tem o ecrã definido.");
      return false;
    }
    E.cols = mx; E.rows = my; E.rx = rx; E.ry = ry; E.mw = valorDe("l-mw"); E.mh = valorDe("l-mh"); E.nits = valorDe("l-nits");
    E.amp = valorDe("l-amp"); E.ampmax = valorDe("l-ampmax"); E.cfg = null;
    if (msg) msg.textContent = "Trazido: " + mx + " × " + my + " gabinetes de " + rx + " × " + ry + " px.";
    render();
    return true;
  }
  function exemplo() {
    E.cols = "38"; E.rows = "6"; E.rx = "192"; E.ry = "192"; E.mw = "500"; E.mh = "500"; E.nits = "1000"; E.cfg = null;
    $("lw-trazer-msg").textContent = "Exemplo carregado: 19 × 3 m, 38 × 6 gabinetes de 500 × 500 mm (192 × 192 px).";
    render();
  }

  function estado() {
    var o = JSON.parse(JSON.stringify(E));
    return o;
  }
  function aplicar(o) {
    if (!o || typeof o !== "object") return;
    Object.keys(PADRAO).forEach(function (k) { if (k in o) E[k] = o[k]; });
    if (E.link) { sincro = true; try { lerDoSinal(); } finally { sincro = false; } }
    else { paraSinal("hz"); }
    render();
    if (E.noProjeto) { var cb = $("lw-addproject"); cb.checked = true; }
    if (typeof root.renderProjectItems === "function") root.renderProjectItems();
  }

  // Os transportes (data/transportes.json) + as saídas óticas dos processadores.
  function carregarTransportes() {
    var dados = null;
    var fim = function () {
      TRANSPORTES = L.montarTransportes(dados, root.PROCESSORS_DATA);
      if (!TRANSPORTES.some(function (t) { return t.id === E.transp; }) && E.transp !== "outro") E.transp = "eth10";
      render();
    };
    if (typeof root.fetch !== "function") { fim(); return; }
    root.fetch("data/transportes.json").then(function (r) { return r.json(); }).then(function (d) { dados = d; fim(); }).catch(function () { fim(); });
  }

  root.ledWallHelp = {
    ligar: function (o) { if (o && o.getProc) S.getProc = o.getProc; if (o && o.setProc) S.setProc = o.setProc; if (E.link) { sincro = true; try { lerDoSinal(); } finally { sincro = false; } } carregarTransportes(); },
    deSinal: deSinal, trazer: trazer, exemplo: exemplo, estado: estado, aplicar: aplicar, render: render,
    // Para os testes: o que está calculado agora.
    _ultimo: function () { return ultimo; }, _estado: function () { return E; }
  };
  render();
})(typeof window !== "undefined" ? window : globalThis);
