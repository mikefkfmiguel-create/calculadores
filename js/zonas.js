// Lógica das zonas do Ecrã Complexo — partilhada entre a aba integrada
// em index.html e a app dedicada em ecra-complexo.html. Depende de
// utils.js (fmt, fmtInt, escapeXml, showToast, addOption, etc.) e de um
// array global LED_TILES_DATA já preenchido antes de chamar calcLedZones().

  // Ecrã complexo — múltiplas zonas de LED (pitches/modelos diferentes por zona)
  var lzList = document.getElementById("lz-list");
  var lzNextId = 1;
  var lzLastTotals = null;
  // Cor atribuída a cada nome-base de zona fica fixa depois de decidida uma
  // vez (ver lzGroupColorMap) — nunca se reatribui às zonas existentes só
  // porque a ordem das zonas mudou (ex: depois de arrastar uma zona para
  // antes de outra na lista), senão as cores "saltavam" entre zonas sem a
  // zona em si ter mudado.
  var lzColorAssignments = {};
  var lzNextColorIndex = 0;

  function lzZoneModelOptionsHtml() {
    return '<option value="custom">Personalizado…</option>';
  }

  function lzPopulateModelSelect(sel) {
    while (sel.options.length > 1) sel.remove(0);
    if (!LED_TILES_DATA.length) return;
    var order = stockFirstIndices(LED_TILES_DATA);
    order.forEach(function (i) {
      var t = LED_TILES_DATA[i];
      addOption(sel, String(i), t.modelo + " — " + t.label, false, i);
    });
    sel.selectedIndex = 0;
    updateSelectStockColor(sel);
    lzAttachModelSearch(sel);
  }

  function lzCardWH(card) {
    var mw = parseFloat(card.querySelector(".lz-mw").value);
    var mh = parseFloat(card.querySelector(".lz-mh").value);
    var activeSeg = card.querySelector(".lz-sizemode-seg .seg-btn.active");
    var mx, my;
    if (activeSeg && activeSeg.dataset.sizemode === "meters") {
      var tw = parseFloat(card.querySelector(".lz-target-w").value);
      var th = parseFloat(card.querySelector(".lz-target-h").value);
      mx = (isNaN(tw) || !(mw > 0)) ? NaN : Math.max(1, Math.ceil((tw * 1000) / mw));
      my = (isNaN(th) || !(mh > 0)) ? NaN : Math.max(1, Math.ceil((th * 1000) / mh));
    } else {
      mx = parseFloat(card.querySelector(".lz-mx").value);
      my = parseFloat(card.querySelector(".lz-my").value);
    }
    return { w: (mx * mw) / 1000, h: (my * mh) / 1000 };
  }

  // Y por omissão = o Y mínimo já usado (o topo real do conjunto), não 0
  // fixo — se já houver zonas deslocadas verticalmente (ex: alinhadas ao
  // centro, cada uma com uma altura diferente), uma zona nova em Y=0
  // não fica encostada ao topo visualmente, só coincide com esse valor
  // por acaso. Sem zonas ainda, cai em 0.
  function lzNextDefaultPos() {
    var maxRight = 0;
    var minY = null;
    document.querySelectorAll("#lz-list .card").forEach(function (card) {
      var posX = parseFloat(card.querySelector(".lz-posx").value) || 0;
      var posY = parseFloat(card.querySelector(".lz-posy").value);
      if (isNaN(posY)) posY = 0;
      var wh = lzCardWH(card);
      if (!isNaN(wh.w)) maxRight = Math.max(maxRight, posX + wh.w);
      minY = minY === null ? posY : Math.min(minY, posY);
    });
    return { x: maxRight > 0 ? Math.round((maxRight + 0.1) * 100) / 100 : 0, y: minY === null ? 0 : minY };
  }

  // Aplica modelo/tamanho (mas nunca posição — cada zona mantém a sua) a um
  // card já existente. Usada tanto para preencher um card acabado de criar
  // como para "Atualizar réplicas" nos já existentes.
  function lzApplyOptsToCard(card, opts) {
    if (opts && opts.modelValue != null) {
      var modelSel = card.querySelector(".lz-model");
      var hasOption = Array.prototype.some.call(modelSel.options, function (o) { return o.value === opts.modelValue; });
      modelSel.value = hasOption ? opts.modelValue : "custom";
      updateSelectStockColor(modelSel);
    }
    lzApplyModel(card);
    if (!opts) return;
    if (opts.visible != null) card.querySelector(".lz-visible").checked = opts.visible;
    if (opts.mw != null) card.querySelector(".lz-mw").value = opts.mw;
    if (opts.mh != null) card.querySelector(".lz-mh").value = opts.mh;
    if (opts.rx != null) card.querySelector(".lz-rx").value = opts.rx;
    if (opts.ry != null) card.querySelector(".lz-ry").value = opts.ry;
    if (opts.weight != null) card.querySelector(".lz-weight").value = opts.weight;
    if (opts.amp != null) card.querySelector(".lz-amp").value = opts.amp;
    var isMeters = opts.sizeMode === "meters";
    card.querySelectorAll(".lz-sizemode-seg .seg-btn").forEach(function (b) { b.classList.toggle("active", (b.dataset.sizemode === "meters") === isMeters); });
    card.querySelector(".lz-tiles-inputs").style.display = isMeters ? "none" : "grid";
    card.querySelector(".lz-meters-inputs").style.display = isMeters ? "grid" : "none";
    card.querySelector(".lz-mx").readOnly = isMeters;
    card.querySelector(".lz-my").readOnly = isMeters;
    if (isMeters) {
      if (opts.targetW != null) card.querySelector(".lz-target-w").value = opts.targetW;
      if (opts.targetH != null) card.querySelector(".lz-target-h").value = opts.targetH;
    } else {
      if (opts.mx != null) card.querySelector(".lz-mx").value = opts.mx;
      if (opts.my != null) card.querySelector(".lz-my").value = opts.my;
    }
    if (opts.curveEnabled != null) {
      card.querySelector(".lz-curve-enabled").checked = opts.curveEnabled;
      card.querySelector(".lz-curve-fields").style.display = opts.curveEnabled ? "block" : "none";
    }
    if (opts.curveMode != null) {
      var isRadiusMode = opts.curveMode === "radius";
      card.querySelectorAll(".lz-curve-mode-seg .seg-btn").forEach(function (b) { b.classList.toggle("active", (b.dataset.curvemode === "radius") === isRadiusMode); });
      card.querySelector(".lz-curve-value-label").textContent = isRadiusMode ? "Raio desejado" : "Ângulo por tile";
      card.querySelector(".lz-curve-value-unit").textContent = isRadiusMode ? "m" : "°";
    }
    if (opts.curveValue != null) card.querySelector(".lz-curve-value").value = opts.curveValue;
    if (opts.curveDir != null) card.querySelector(".lz-curve-dir").value = opts.curveDir;
  }

  function lzOptsFromCard(card) {
    var activeSeg = card.querySelector(".lz-sizemode-seg .seg-btn.active");
    var curveModeSeg = card.querySelector(".lz-curve-mode-seg .seg-btn.active");
    return {
      visible: card.querySelector(".lz-visible").checked,
      modelValue: card.querySelector(".lz-model").value,
      sizeMode: activeSeg ? activeSeg.dataset.sizemode : "tiles",
      mx: card.querySelector(".lz-mx").value,
      my: card.querySelector(".lz-my").value,
      targetW: card.querySelector(".lz-target-w").value,
      targetH: card.querySelector(".lz-target-h").value,
      mw: card.querySelector(".lz-mw").value,
      mh: card.querySelector(".lz-mh").value,
      rx: card.querySelector(".lz-rx").value,
      ry: card.querySelector(".lz-ry").value,
      weight: card.querySelector(".lz-weight").value,
      amp: card.querySelector(".lz-amp").value,
      curveEnabled: card.querySelector(".lz-curve-enabled").checked,
      curveMode: curveModeSeg ? curveModeSeg.dataset.curvemode : "angle",
      curveValue: card.querySelector(".lz-curve-value").value,
      curveDir: card.querySelector(".lz-curve-dir").value
    };
  }

  function lzAddZone(name, opts, startOpen) {
    if (startOpen == null) startOpen = true;
    var id = "z" + (lzNextId++);
    var defaultPos = lzNextDefaultPos();
    var card = document.createElement("div");
    card.className = "card";
    card.dataset.zoneId = id;
    card.innerHTML =
      '<div style="display:flex; justify-content:space-between; align-items:flex-end; gap:10px; margin-bottom:14px; flex-wrap:wrap;">' +
        '<div class="field" style="width:32px; margin-bottom:0;">' +
          '<label style="text-align:center;">Sel.</label>' +
          '<div style="display:flex; align-items:center; justify-content:center; height:35px;">' +
            '<input type="checkbox" class="lz-select" title="Selecionar esta zona para mover em bloco">' +
          '</div>' +
        '</div>' +
        '<div class="field" style="width:34px; margin-bottom:0;">' +
          '<label style="text-align:center;">Vis.</label>' +
          '<div style="display:flex; align-items:center; justify-content:center; height:35px;">' +
            '<input type="checkbox" class="lz-visible" checked title="Incluir esta zona no desenho, nas contas do conjunto e nos PNG exportados — desmarca para a esconder sem apagar">' +
          '</div>' +
        '</div>' +
        '<div class="field" style="width:34px; margin-bottom:0;">' +
          '<label style="text-align:center;">Ref.</label>' +
          '<div style="display:flex; align-items:center; justify-content:center; height:35px;">' +
            '<input type="checkbox" class="lz-ref" title="Usar o pitch desta zona como referência do canvas combinado (posições/tamanhos das outras zonas convertidos para este pitch). Sem nenhuma marcada, usa-se a zona mais alta (m) — que pode mudar sozinha ao adicionar/remover zonas.">' +
          '</div>' +
        '</div>' +
        '<div class="field" style="width:44px; margin-bottom:0;">' +
          '<label style="text-align:center;">Cor</label>' +
          '<div style="display:flex; flex-direction:column; align-items:center; gap:2px; height:35px; justify-content:center;">' +
            '<input type="color" class="lz-color-input" title="Cor desta zona — por omissão as zonas com o mesmo nome-base (ex: &quot;Lateral&quot;, &quot;Lateral 2&quot;) partilham cor automática; escolhe aqui para dar uma cor própria só a esta." style="width:26px; height:22px; padding:0; border:none; background:none; cursor:pointer;">' +
            '<button type="button" class="lz-color-reset" title="Repor cor automática (por grupo)" style="font-size:9.5px; line-height:1; padding:0; border:none; background:none; color:var(--ink-faint); cursor:pointer; text-decoration:underline; visibility:hidden;">auto</button>' +
          '</div>' +
        '</div>' +
        '<div class="field" style="flex:1; min-width:160px; margin-bottom:0;">' +
          '<label>Nome da zona</label>' +
          '<div class="inputgroup"><input type="text" class="lz-name" value="' + (name || ("Zona " + (lzNextId - 1))) + '"></div>' +
        '</div>' +
        '<div class="field" style="width:100px; margin-bottom:0;">' +
          '<label>Cópias</label>' +
          '<div class="inputgroup"><input type="number" class="lz-dup-count" value="1" min="1" step="1"></div>' +
        '</div>' +
        '<div class="field" style="width:120px; margin-bottom:0;">' +
          '<label>Gap p/ cópia</label>' +
          '<div class="inputgroup"><input type="number" class="lz-dup-gap" value="0.05" min="0" step="0.01"></div>' +
        '</div>' +
        '<div class="field" style="width:118px; margin-bottom:0;">' +
          '<label>Direção cópias</label>' +
          '<select class="lz-dup-dir plain">' +
            '<option value="h" selected>→ horizontal</option>' +
            '<option value="v">↓ vertical</option>' +
          '</select>' +
        '</div>' +
        '<div style="display:flex; gap:8px; flex-wrap:wrap;">' +
          '<button type="button" class="copy lz-duplicate" title="Cria o nº de zonas indicado em Cópias, iguais a esta, em fila com o gap e direção indicados">Aplicar réplicas</button>' +
          '<button type="button" class="copy lz-update-replicas" title="Aplica o modelo/tamanho desta zona às outras zonas com o mesmo nome-base (ex: &quot;Lateral 2&quot;, &quot;Lateral 3&quot;), sem criar novas nem mexer nas posições delas">Atualizar réplicas</button>' +
          '<button type="button" class="copy lz-remove">Remover</button>' +
        '</div>' +
      '</div>' +
      '<div class="lz-readout-row">' +
        '<div class="hint lz-readout">—</div>' +
        '<button type="button" class="copy lz-edit-btn" title="Abre a posição, modelo, tamanho e curvatura desta zona num popup próprio">✎ Editar</button>' +
      '</div>' +
      '<div class="hint lz-curve-readout">Curvatura: desligada</div>' +
      '<dialog class="lz-details-dialog">' +
        '<div class="lz-dialog-head">' +
          '<strong class="lz-dialog-title">Editar zona</strong>' +
          '<button type="button" class="lz-dialog-close" aria-label="Fechar">✕</button>' +
        '</div>' +
        '<div class="row2 lz-position-inputs">' +
          '<div class="field"><label>Posição X (horizontal)</label><div class="inputgroup"><input class="lz-posx" type="number" inputmode="decimal" value="0" step="0.01"><span class="unit">m</span></div></div>' +
          '<div class="field"><label>Posição Y (vertical)</label><div class="inputgroup"><input class="lz-posy" type="number" inputmode="decimal" value="0" step="0.01"><span class="unit">m</span></div></div>' +
        '</div>' +
        '<div class="field">' +
          '<label>Modelo de tile</label>' +
          '<select class="lz-model plain">' + lzZoneModelOptionsHtml() + '</select>' +
        '</div>' +
        '<div class="field">' +
          '<label>Como queres indicar o tamanho desta zona?</label>' +
          '<div class="seg lz-sizemode-seg">' +
            '<button type="button" class="seg-btn active" data-sizemode="tiles">Nº de tiles</button>' +
            '<button type="button" class="seg-btn" data-sizemode="meters">Medida da zona (m)</button>' +
          '</div>' +
        '</div>' +
        '<div class="row2 lz-tiles-inputs">' +
          '<div class="field"><label>Tiles na horizontal</label><div class="inputgroup"><input class="lz-mx" type="number" value="4" min="1" step="1"></div></div>' +
          '<div class="field"><label>Tiles na vertical</label><div class="inputgroup"><input class="lz-my" type="number" value="3" min="1" step="1"></div></div>' +
        '</div>' +
        '<div class="row2 lz-meters-inputs" style="display:none;">' +
          '<div class="field"><label>Largura desejada</label><div class="inputgroup"><input class="lz-target-w" type="number" inputmode="decimal" value="2.0" min="0.1" step="0.1"><span class="unit">m</span></div></div>' +
          '<div class="field"><label>Altura desejada</label><div class="inputgroup"><input class="lz-target-h" type="number" inputmode="decimal" value="1.5" min="0.1" step="0.1"><span class="unit">m</span></div></div>' +
        '</div>' +
        '<div class="row2 lz-custom-fields" style="display:none;">' +
          '<div class="field"><label>Largura módulo</label><div class="inputgroup"><input class="lz-mw" type="number" value="500" min="1" step="1"><span class="unit">mm</span></div></div>' +
          '<div class="field"><label>Altura módulo</label><div class="inputgroup"><input class="lz-mh" type="number" value="500" min="1" step="1"><span class="unit">mm</span></div></div>' +
        '</div>' +
        '<div class="row2 lz-custom-fields" style="display:none;">' +
          '<div class="field"><label>Píxeis (horizontal)</label><div class="inputgroup"><input class="lz-rx" type="number" value="128" min="1" step="1"><span class="unit">px</span></div></div>' +
          '<div class="field"><label>Píxeis (vertical)</label><div class="inputgroup"><input class="lz-ry" type="number" value="128" min="1" step="1"><span class="unit">px</span></div></div>' +
        '</div>' +
        '<div class="row2 lz-custom-fields" style="display:none;">' +
          '<div class="field"><label>Peso por tile</label><div class="inputgroup"><input class="lz-weight" type="number" inputmode="decimal" value="6.0" min="0" step="0.1"><span class="unit">kg</span></div></div>' +
          '<div class="field"><label>Amp máx. por tile</label><div class="inputgroup"><input class="lz-amp" type="number" inputmode="decimal" value="0.52" min="0" step="0.01"><span class="unit">A</span></div></div>' +
        '</div>' +
        '<div class="field">' +
          '<label style="display:flex; align-items:center; gap:8px; cursor:pointer; font-weight:400;">' +
            '<input type="checkbox" class="lz-curve-enabled" style="width:auto;">' +
            'Zona curva' +
          '</label>' +
        '</div>' +
        '<div class="lz-curve-fields" style="display:none;">' +
          '<div class="field">' +
            '<label>Como queres indicar a curvatura?</label>' +
            '<div class="seg lz-curve-mode-seg">' +
              '<button type="button" class="seg-btn active" data-curvemode="angle">Ângulo por tile</button>' +
              '<button type="button" class="seg-btn" data-curvemode="radius">Raio desejado</button>' +
            '</div>' +
          '</div>' +
          '<div class="row2">' +
            '<div class="field">' +
              '<label class="lz-curve-value-label">Ângulo por tile</label>' +
              '<div class="inputgroup"><input class="lz-curve-value" type="number" inputmode="decimal" value="5" min="0" step="0.5"><span class="unit lz-curve-value-unit">°</span></div>' +
            '</div>' +
            '<div class="field">' +
              '<label>Direção</label>' +
              '<select class="lz-curve-dir plain">' +
                '<option value="concave" selected>Côncavo (para o público)</option>' +
                '<option value="convex">Convexo (para fora)</option>' +
              '</select>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</dialog>';
    lzList.appendChild(card);
    lzPopulateModelSelect(card.querySelector(".lz-model"));
    lzApplyOptsToCard(card, opts);
    card.querySelector(".lz-posx").value = (opts && opts.posX != null) ? opts.posX : defaultPos.x;
    card.querySelector(".lz-posy").value = (opts && opts.posY != null) ? opts.posY : defaultPos.y;
    // "ref" fica de fora de lzOptsFromCard/lzApplyOptsToCard de propósito —
    // só se aplica ao restaurar do localStorage, nunca a duplicar ("Aplicar
    // réplicas") ou a "Atualizar réplicas" (essas usam essas duas funções),
    // senão duplicar a zona de referência criava várias a competir.
    if (opts && opts.ref) card.querySelector(".lz-ref").checked = true;
    if (opts && opts.colorOverride) card.dataset.colorOverride = opts.colorOverride;
    calcLedZones();
    if (startOpen) card.querySelector(".lz-details-dialog").showModal();
    return card;
  }

  function lzBaseName(name) {
    var m = name.match(/^(.*?)\s+\d+$/);
    return (m ? m[1] : name).trim();
  }

  // Cor por grupo (zonas com o mesmo nome-base, ex: "Lateral"/"Lateral
  // 2"/"Lateral 3" partilham cor) — paleta categórica com boa distinção em
  // daltonismo, nas variantes escuras (a app fica sempre em tema escuro).
  var LZ_GROUP_PALETTE = ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181", "#008300", "#9085e9", "#e66767"];
  // Chave de agrupamento de cor de uma zona — só agrupa pelo nome-base
  // (ex: "Lateral 2" -> "Lateral") quando existe mesmo uma zona chamada
  // exatamente "Lateral" (a réplica original, criada por "Aplicar
  // réplicas"). Sem essa zona-raiz, cada zona fica com a sua própria cor —
  // senão zonas avulsas com o nome por omissão ("Zona 1", "Zona 2", "Zona
  // 3", nunca renomeadas) ficavam todas coladas na mesma cor, por
  // coincidirem no mesmo nome-base sem serem réplicas de facto.
  function lzColorKey(z, zones) {
    var base = lzBaseName(z.name);
    if (base === z.name) return z.name;
    var hasRoot = zones.some(function (o) { return o.name === base; });
    return hasRoot ? base : z.name;
  }
  // Cor efetiva de uma zona — a escolhida à mão para essa zona específica
  // (se houver), senão a automática do grupo.
  function lzZoneColor(z, colorMap, zones) {
    return z.colorOverride || colorMap[lzColorKey(z, zones)];
  }
  function lzGroupColorMap(zones) {
    var map = {};
    zones.forEach(function (z) {
      var key = lzColorKey(z, zones);
      if (!(key in lzColorAssignments)) {
        lzColorAssignments[key] = LZ_GROUP_PALETTE[lzNextColorIndex % LZ_GROUP_PALETTE.length];
        lzNextColorIndex++;
      }
      map[key] = lzColorAssignments[key];
    });
    return map;
  }
  // Arruma os cards na lista pela posição das zonas (mais à esquerda
  // primeiro, X depois Y como desempate) em vez de pela ordem em que foram
  // criados — mais fácil de encontrar o card certo depois de mexer em
  // posições. Não reordena enquanto o utilizador está a escrever num campo
  // de posição (perderia o foco a meio da edição); só quando o campo é
  // confirmado (blur) ou noutras ações (adicionar, duplicar, mover em bloco).
  function lzSortCardsByPosition() {
    var active = document.activeElement;
    if (active && lzList.contains(active) && (active.classList.contains("lz-posx") || active.classList.contains("lz-posy"))) return;
    var cards = Array.from(lzList.querySelectorAll(".card"));
    cards.sort(function (a, b) {
      var ax = parseFloat(a.querySelector(".lz-posx").value) || 0, ay = parseFloat(a.querySelector(".lz-posy").value) || 0;
      var bx = parseFloat(b.querySelector(".lz-posx").value) || 0, by = parseFloat(b.querySelector(".lz-posy").value) || 0;
      return ax - bx || ay - by;
    });
    var alreadySorted = cards.every(function (c, i) { return lzList.children[i] === c; });
    if (alreadySorted) return;
    cards.forEach(function (c) { lzList.appendChild(c); });
  }
  function lzHexToRgba(hex, alpha) {
    var h = hex.replace("#", "");
    var r = parseInt(h.substring(0, 2), 16), g = parseInt(h.substring(2, 4), 16), b = parseInt(h.substring(4, 6), 16);
    return "rgba(" + r + "," + g + "," + b + "," + alpha + ")";
  }

  function lzApplyModel(card) {
    var sel = card.querySelector(".lz-model");
    var isCustom = sel.value === "custom";
    card.querySelectorAll(".lz-custom-fields").forEach(function (el) { el.style.display = isCustom ? "grid" : "none"; });
    if (isCustom) return;
    var t = LED_TILES_DATA[parseInt(sel.value, 10)];
    if (!t) return;
    card.querySelector(".lz-mw").value = t.mw;
    card.querySelector(".lz-mh").value = t.mh;
    card.querySelector(".lz-rx").value = t.rx;
    card.querySelector(".lz-ry").value = t.ry;
    card.querySelector(".lz-weight").value = t.weight == null ? "" : t.weight;
    card.querySelector(".lz-amp").value = t.amp == null ? "" : t.amp;
  }

  document.querySelectorAll("#lz-add, #lz-add-top, #lz-add-canvas").forEach(function (btn) {
    btn.addEventListener("click", function () { lzAddZone(); });
  });
  document.getElementById("lz-preview-bar").addEventListener("click", function () {
    var totalsCard = document.getElementById("lz-totals-card");
    totalsCard.open = true;
    totalsCard.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  // Na página "Ecrã Complexo" à parte, o diagrama (#ecra-fixed-top) já foi
  // fixo no topo, com o resto da página a ganhar uma margem de compensação
  // calculada aqui via ResizeObserver — mas essa compensação ficava
  // sistematicamente desactualizada sempre que o diagrama mudava de altura
  // sem isso ser apanhado a tempo, escondendo o cabeçalho e cortando o
  // topo dos cards por baixo. O diagrama passou a fluxo normal (ver
  // "#ecra-fixed-top" em css/app.css) — sem posição fixa não há nada para
  // compensar, por isso esta função deixou de ser precisa.

  // Clicar numa zona no diagrama (ou na coluna de detalhes) salta para o
  // card de edição correspondente na lista — mais rápido do que procurar
  // pelo nome numa lista comprida.
  function lzJumpToZoneCard(zoneId) {
    var card = lzList.querySelector('.card[data-zone-id="' + zoneId + '"]');
    if (!card) return;
    card.scrollIntoView({ behavior: "smooth", block: "start" });
    card.classList.remove("lz-flash");
    void card.offsetWidth;
    card.classList.add("lz-flash");
    var dialog = card.querySelector(".lz-details-dialog");
    if (dialog) dialog.showModal();
  }
  document.getElementById("lz-diagram").addEventListener("click", function (e) {
    if (lzJustDragged) { lzJustDragged = false; return; }
    var rect = e.target.closest("[data-zone-id]");
    if (rect && rect.dataset.zoneId) lzJumpToZoneCard(rect.dataset.zoneId);
  });

  // Arrastar uma zona diretamente no diagrama — atalho visual para o
  // posicionamento; os campos Posição X/Y continuam a ser a forma de fazer
  // o ajuste fino (ficam sincronizados ao vivo durante o arrasto). Usa
  // Pointer Events (rato, caneta e touch no mesmo código) com os
  // listeners de movimento/soltar no document, não no próprio <rect> —
  // esse elemento é destruído e recriado a cada redesenho do SVG, por
  // isso não pode ser o alvo de um pointer capture que sobrevive ao
  // arrasto todo.
  var lzDrag = null;
  var lzJustDragged = false;
  var LZ_DRAG_CLICK_THRESHOLD_PX = 4;

  function lzSvgPoint(svg, clientX, clientY) {
    var pt = svg.createSVGPoint();
    pt.x = clientX; pt.y = clientY;
    var ctm = svg.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    var p = pt.matrixTransform(ctm.inverse());
    return { x: p.x, y: p.y };
  }

  document.getElementById("lz-diagram").addEventListener("pointerdown", function (e) {
    if (e.button != null && e.button !== 0) return; // só botão esquerdo/toque/caneta principal
    var rect = e.target.closest("[data-zone-id]");
    if (!rect || !rect.dataset.zoneId) return;
    var card = lzList.querySelector('.card[data-zone-id="' + rect.dataset.zoneId + '"]');
    if (!card) return;
    var xInput = card.querySelector(".lz-posx"), yInput = card.querySelector(".lz-posy");
    if (!xInput || !yInput) return;
    var svg = document.getElementById("lz-diagram");
    var start = lzSvgPoint(svg, e.clientX, e.clientY);
    lzDrag = {
      svg: svg, xInput: xInput, yInput: yInput,
      startClientX: e.clientX, startClientY: e.clientY,
      startSvgX: start.x, startSvgY: start.y,
      startPosX: parseFloat(xInput.value) || 0, startPosY: parseFloat(yInput.value) || 0,
      moved: false, pending: false
    };
    // Mantém a lista sem reordenar durante o arrasto (mesma proteção já
    // usada quando se edita X/Y à mão) — reordena só uma vez no fim.
    xInput.focus({ preventScroll: true });
    svg.classList.add("lz-dragging");
    e.preventDefault();
  });

  document.addEventListener("pointermove", function (e) {
    if (!lzDrag) return;
    if (!lzDrag.moved) {
      var dClientX = e.clientX - lzDrag.startClientX, dClientY = e.clientY - lzDrag.startClientY;
      if (Math.hypot(dClientX, dClientY) < LZ_DRAG_CLICK_THRESHOLD_PX) return;
      lzDrag.moved = true;
    }
    var cur = lzSvgPoint(lzDrag.svg, e.clientX, e.clientY);
    lzDrag.dx = cur.x - lzDrag.startSvgX;
    lzDrag.dy = cur.y - lzDrag.startSvgY;
    if (lzDrag.pending) return;
    lzDrag.pending = true;
    requestAnimationFrame(function () {
      if (!lzDrag) return;
      lzDrag.pending = false;
      var newX = Math.round((lzDrag.startPosX + lzDrag.dx) * 100) / 100;
      var newY = Math.round((lzDrag.startPosY + lzDrag.dy) * 100) / 100;
      lzDrag.xInput.value = newX.toFixed(2);
      lzDrag.yInput.value = newY.toFixed(2);
      calcLedZones();
    });
  });

  function lzEndDrag() {
    if (!lzDrag) return;
    var moved = lzDrag.moved;
    var xInput = lzDrag.xInput;
    lzDrag.svg.classList.remove("lz-dragging");
    lzDrag = null;
    if (moved) {
      lzJustDragged = true;
      // Reposição de segurança — nem todos os browsers/dispositivos disparam
      // um "click" a seguir ao mouseup/pointerup de um arrasto (foi o caso
      // encontrado em testes automatizados); sem isto, se esse click nunca
      // vier, a flag ficava presa a "true" e engolia o próximo clique
      // genuíno de saltar para outra zona.
      setTimeout(function () { lzJustDragged = false; }, 300);
      xInput.blur(); // liberta a proteção de "não reordenar" e aplica o sort final
      lzNormalizeZonePositions();
      calcLedZones();
    }
  }

  // A posição é sempre "a partir do canto superior esquerdo do conjunto" —
  // arrastar uma zona para lá do que hoje é o canto (X ou Y negativo) desloca
  // TODAS as zonas pela mesma quantidade, para a mais à esquerda/acima ficar
  // outra vez em 0 e as posições nunca ficarem negativas. É um deslocamento
  // uniforme (a disposição relativa entre zonas mantém-se sempre igual).
  function lzNormalizeZonePositions() {
    var cards = Array.from(lzList.querySelectorAll(".card"));
    if (!cards.length) return;
    var minX = 0, minY = 0;
    cards.forEach(function (c) {
      var x = parseFloat(c.querySelector(".lz-posx").value);
      var y = parseFloat(c.querySelector(".lz-posy").value);
      if (!isNaN(x)) minX = Math.min(minX, x);
      if (!isNaN(y)) minY = Math.min(minY, y);
    });
    if (minX >= 0 && minY >= 0) return;
    cards.forEach(function (c) {
      var xInput = c.querySelector(".lz-posx"), yInput = c.querySelector(".lz-posy");
      if (minX < 0) {
        var nx = (parseFloat(xInput.value) || 0) - minX;
        xInput.value = (Math.round(nx * 100) / 100).toFixed(2);
      }
      if (minY < 0) {
        var ny = (parseFloat(yInput.value) || 0) - minY;
        yInput.value = (Math.round(ny * 100) / 100).toFixed(2);
      }
    });
  }
  document.addEventListener("pointerup", lzEndDrag);
  document.addEventListener("pointercancel", lzEndDrag);
  document.getElementById("lz-diagram-details").addEventListener("click", function (e) {
    var row = e.target.closest(".lz-detail-row[data-zone-id]");
    if (row && row.dataset.zoneId) lzJumpToZoneCard(row.dataset.zoneId);
  });

  document.getElementById("lz-select-all").addEventListener("click", function () {
    lzList.querySelectorAll(".lz-select").forEach(function (cb) { cb.checked = true; });
    calcLedZones();
  });
  document.getElementById("lz-select-none").addEventListener("click", function () {
    lzList.querySelectorAll(".lz-select").forEach(function (cb) { cb.checked = false; });
    calcLedZones();
  });
  document.getElementById("lz-bulk-move").addEventListener("click", function () {
    var dx = parseFloat(document.getElementById("lz-bulk-dx").value) || 0;
    var dy = parseFloat(document.getElementById("lz-bulk-dy").value) || 0;
    if (!dx && !dy) { showToast("Indica um deslocamento em X e/ou Y primeiro."); return; }
    var selected = lzList.querySelectorAll(".lz-select:checked");
    if (!selected.length) { showToast("Marca a caixa \"Sel.\" de pelo menos uma zona primeiro — são as que vão ser deslocadas."); return; }
    selected.forEach(function (cb) {
      var card = cb.closest(".card");
      var xInput = card.querySelector(".lz-posx"), yInput = card.querySelector(".lz-posy");
      xInput.value = (Math.round(((parseFloat(xInput.value) || 0) + dx) * 100) / 100).toFixed(2);
      yInput.value = (Math.round(((parseFloat(yInput.value) || 0) + dy) * 100) / 100).toFixed(2);
    });
    calcLedZones();
  });

  lzList.addEventListener("click", function (e) {
    var editBtn = e.target.closest(".lz-edit-btn");
    if (editBtn) {
      editBtn.closest(".card").querySelector(".lz-details-dialog").showModal();
      return;
    }
    var dialogCloseBtn = e.target.closest(".lz-dialog-close");
    if (dialogCloseBtn) {
      dialogCloseBtn.closest(".lz-details-dialog").close();
      return;
    }
    if (e.target.classList.contains("lz-details-dialog")) {
      // Clique fora do conteúdo (no próprio elemento <dialog>, que ocupa
      // só a caixa do popup — clicar no fundo escurecido à volta conta
      // como clicar no <dialog> em si) fecha, como clicar fora de
      // qualquer popup costuma fazer.
      e.target.close();
      return;
    }
    var colorResetBtn = e.target.closest(".lz-color-reset");
    if (colorResetBtn) {
      delete colorResetBtn.closest(".card").dataset.colorOverride;
      calcLedZones();
      return;
    }
    var removeBtn = e.target.closest(".lz-remove");
    if (removeBtn) {
      removeBtn.closest(".card").remove();
      calcLedZones();
      return;
    }
    var dupBtn = e.target.closest(".lz-duplicate");
    if (dupBtn) {
      var srcCard = dupBtn.closest(".card");
      var count = Math.max(1, parseInt(srcCard.querySelector(".lz-dup-count").value, 10) || 1);
      var srcName = srcCard.querySelector(".lz-name").value.trim() || "Zona";
      var opts = lzOptsFromCard(srcCard);
      var root = lzBaseName(srcName) || srcName;
      var maxIndex = 0, rootCount = 0;
      document.querySelectorAll("#lz-list .lz-name").forEach(function (inp) {
        var n = inp.value.trim();
        if (lzBaseName(n) !== root) return;
        rootCount++;
        var m = n.match(/^.*?\s+(\d+)$/);
        if (m) maxIndex = Math.max(maxIndex, parseInt(m[1], 10));
      });
      var nextIdx = maxIndex > 0 ? maxIndex + 1 : rootCount + 1;
      var srcWH = lzCardWH(srcCard);
      var srcPosX = parseFloat(srcCard.querySelector(".lz-posx").value) || 0;
      var srcPosY = parseFloat(srcCard.querySelector(".lz-posy").value) || 0;
      var dupGap = parseFloat(srcCard.querySelector(".lz-dup-gap").value);
      if (isNaN(dupGap)) dupGap = 0;
      var dupDir = srcCard.querySelector(".lz-dup-dir").value;
      for (var i = 0; i < count; i++) {
        var step = (i + 1) * ((dupDir === "v" ? srcWH.h : srcWH.w) + dupGap);
        opts.posX = dupDir === "v" ? srcPosX : srcPosX + step;
        opts.posY = dupDir === "v" ? srcPosY + step : srcPosY;
        lzAddZone(root + " " + (nextIdx + i), opts, false);
      }
      return;
    }
    var updBtn = e.target.closest(".lz-update-replicas");
    if (updBtn) {
      var updSrcCard = updBtn.closest(".card");
      var updSrcName = updSrcCard.querySelector(".lz-name").value.trim() || "Zona";
      var updRoot = lzBaseName(updSrcName) || updSrcName;
      var updOpts = lzOptsFromCard(updSrcCard);
      var updated = 0;
      document.querySelectorAll("#lz-list .card").forEach(function (card) {
        if (card === updSrcCard) return;
        var n = card.querySelector(".lz-name").value.trim();
        if (lzBaseName(n) !== updRoot) return;
        lzApplyOptsToCard(card, updOpts);
        updated++;
      });
      if (!updated) {
        showToast("Não encontrei outras zonas com o mesmo nome-base (\"" + updRoot + "\") para atualizar — usa \"Aplicar réplicas\" primeiro para as criar.");
        return;
      }
      calcLedZones();
      return;
    }
    var modeBtn = e.target.closest(".lz-sizemode-seg .seg-btn");
    if (modeBtn) {
      var card = modeBtn.closest(".card");
      card.querySelectorAll(".lz-sizemode-seg .seg-btn").forEach(function (b) { b.classList.remove("active"); });
      modeBtn.classList.add("active");
      var isMeters = modeBtn.dataset.sizemode === "meters";
      card.querySelector(".lz-tiles-inputs").style.display = isMeters ? "none" : "grid";
      card.querySelector(".lz-meters-inputs").style.display = isMeters ? "grid" : "none";
      card.querySelector(".lz-mx").readOnly = isMeters;
      card.querySelector(".lz-my").readOnly = isMeters;
      calcLedZones();
    }
    var curveModeBtn = e.target.closest(".lz-curve-mode-seg .seg-btn");
    if (curveModeBtn) {
      var curveCard = curveModeBtn.closest(".card");
      curveCard.querySelectorAll(".lz-curve-mode-seg .seg-btn").forEach(function (b) { b.classList.remove("active"); });
      curveModeBtn.classList.add("active");
      var isRadius = curveModeBtn.dataset.curvemode === "radius";
      var valueInput = curveCard.querySelector(".lz-curve-value");
      curveCard.querySelector(".lz-curve-value-label").textContent = isRadius ? "Raio desejado" : "Ângulo por tile";
      curveCard.querySelector(".lz-curve-value-unit").textContent = isRadius ? "m" : "°";
      valueInput.value = isRadius ? "5" : "5";
      valueInput.step = isRadius ? "0.1" : "0.5";
      calcLedZones();
    }
  });
  lzList.addEventListener("change", function (e) {
    if (e.target.classList.contains("lz-model")) {
      lzApplyModel(e.target.closest(".card"));
      updateSelectStockColor(e.target);
    }
    // Só uma zona pode ser a referência de pitch de cada vez (como um
    // radio) — marcar uma desmarca as outras.
    if (e.target.classList.contains("lz-ref") && e.target.checked) {
      lzList.querySelectorAll(".lz-ref").forEach(function (cb) { if (cb !== e.target) cb.checked = false; });
    }
    if (e.target.classList.contains("lz-curve-enabled")) {
      e.target.closest(".card").querySelector(".lz-curve-fields").style.display = e.target.checked ? "block" : "none";
    }
    calcLedZones();
  });
  lzList.addEventListener("input", function (e) {
    if (e.target.classList.contains("lz-color-input")) {
      e.target.closest(".card").dataset.colorOverride = e.target.value;
    }
    calcLedZones();
  });

  // Desenha um diagrama SVG à escala das zonas (posição + tamanho), para dar
  // uma noção visual do conjunto e devolve a caixa (bounding box) que as
  // envolve — usada para "dimensão do conjunto" (já com os gaps incluídos,
  // ao contrário da área total que é só a soma das áreas de cada zona).
  // Pontos (não escalados, largura de tile = 1) da "espinha" de uma zona
  // curva — um arco de círculo aproximado por n cordas iguais (um ponto por
  // junta entre tiles), centrado em X e com o desvio em Y (a "barriga" da
  // curva) medido a partir da corda entre as duas pontas — mesma geometria
  // de calcCurvature (js/utils.js), só que aqui devolve os pontos em vez de
  // só as medidas agregadas, para desenhar o esquema no diagrama.
  function lzCurveSpinePoints(n, angleDeg, convex) {
    var count = Math.max(1, Math.round(n) || 1);
    if (!(angleDeg > 1e-6)) {
      var flat = [];
      for (var i = 0; i <= count; i++) flat.push({ x: i - count / 2, y: 0 });
      return flat;
    }
    var thetaRad = angleDeg * Math.PI / 180;
    var radius = 1 / (2 * Math.sin(thetaRad / 2));
    var halfTotalRad = (thetaRad * count) / 2;
    var cosHalf = Math.cos(halfTotalRad);
    var sign = convex ? 1 : -1;
    var pts = [];
    for (var j = 0; j <= count; j++) {
      var a = -halfTotalRad + j * thetaRad;
      pts.push({ x: radius * Math.sin(a), y: sign * radius * (Math.cos(a) - cosHalf) });
    }
    return pts;
  }

  function lzRenderDiagram(zones, colorMap, pm) {
    var wrap = document.getElementById("lz-diagram-wrap");
    var svg = document.getElementById("lz-diagram");
    var legend = document.getElementById("lz-diagram-legend");
    var valid = zones.filter(function (z) {
      return isFinite(z.posX) && isFinite(z.posY) && z.w > 0 && z.h > 0;
    });
    if (!valid.length) {
      wrap.style.display = "none";
      svg.innerHTML = "";
      legend.innerHTML = "";
      return null;
    }
    wrap.style.display = "block";
    var minX = Math.min.apply(null, valid.map(function (z) { return z.posX; }));
    var minY = Math.min.apply(null, valid.map(function (z) { return z.posY; }));
    var maxX = Math.max.apply(null, valid.map(function (z) { return z.posX + z.w; }));
    var maxY = Math.max.apply(null, valid.map(function (z) { return z.posY + z.h; }));
    var totalW = maxX - minX, totalH = maxY - minY;
    var unit = Math.max(totalW, totalH) || 1;
    var fontSize = unit * 0.028;
    var strokeW = unit * 0.004, radius = unit * 0.006;
    // A legenda fica acima de cada zona (fora do retângulo) — dentro do
    // retângulo fica ilegível quando as zonas são pequenas ou têm gaps
    // apertados entre si. O padding de topo tem de caber a linha de texto,
    // e o da direita tem de caber a legenda mais larga (estimativa de
    // largura de texto, já que não há como medir texto real num SVG gerado
    // à parte do DOM).
    var labelGap = fontSize * 0.5;
    var padSide = unit * 0.06;
    // A legenda no desenho fica só com o nome — curta, para não colidir
    // entre zonas vizinhas apertadas. O tamanho/posição de cada uma fica
    // na coluna de detalhes ao lado (fora do desenho).
    var labels = valid.map(function (z) {
      return { z: z, text: z.name, textW: z.name.length * fontSize * 0.56, level: 0 };
    });
    var maxLabelRight = 0;
    labels.forEach(function (l) {
      maxLabelRight = Math.max(maxLabelRight, (l.z.posX - minX) + l.textW);
    });
    var padRight = Math.max(padSide, maxLabelRight - totalW + padSide);

    // Zonas vizinhas (mesma posição Y, ex: várias tiras lado a lado, ou Y
    // só ligeiramente diferente, ex: uma tira ao lado de um ecrã maior) têm
    // legendas mais largas do que elas próprias — sem isto ficavam coladas
    // ou sobrepostas. Deteta colisão real em 2D (não só zonas com o mesmo
    // Y exato) e empilha as que colidem em "andares" alternados por cima,
    // tal como no mapa de píxeis exportado.
    var rowH = fontSize * 1.7;
    var gapPad = unit * 0.012;
    var placedBoxes = [];
    labels.slice().sort(function (a, b) { return (a.z.posX - minX) - (b.z.posX - minX); }).forEach(function (l) {
      var x0 = l.z.posX - minX, x1 = x0 + l.textW;
      var baseY = l.z.posY - minY;
      var lvl = 0;
      while (true) {
        var y1 = baseY - labelGap - lvl * rowH, y0 = y1 - fontSize;
        var overlaps = placedBoxes.some(function (p) {
          return x0 < p.x1 + gapPad && x1 + gapPad > p.x0 && y0 < p.y1 && y1 > p.y0;
        });
        if (!overlaps || lvl > 20) {
          l.level = lvl;
          placedBoxes.push({ x0: x0, x1: x1, y0: y0, y1: y1 });
          break;
        }
        lvl++;
      }
    });
    var maxLevel = labels.reduce(function (m, l) { return Math.max(m, l.level); }, 0);
    var padTop = Math.max(unit * 0.06, fontSize * 1.8) + maxLevel * rowH;
    var padBottom = fontSize * 2.4;

    var style = getComputedStyle(document.documentElement);
    var ink = style.getPropertyValue("--ink").trim() || "#10181F";
    var inkFaint = style.getPropertyValue("--ink-faint").trim() || "#7C8994";
    var rose = style.getPropertyValue("--rose-500").trim() || "#D14D78";

    var vbW = totalW + padSide + padRight, vbH = totalH + padTop + padBottom;
    svg.setAttribute("viewBox", "0 0 " + vbW + " " + vbH);

    // O retângulo do conjunto todo fica marcado a rosa (= gap, sem LED) por
    // baixo; as zonas com LED desenham-se por cima, cada uma com a cor do
    // seu grupo (mesmo nome-base), "tapando" essa marca onde há ecrã real —
    // distingue de imediato o que é pixel do que é só espaço vazio, e
    // agrupa visualmente zonas relacionadas (ex: as várias tiras).
    var parts = ['<rect x="' + padSide + '" y="' + padTop + '" width="' + totalW + '" height="' + totalH + '" fill="' + rose + '" fill-opacity="0.12" stroke="' + rose + '" stroke-width="' + strokeW + '" stroke-dasharray="' + (strokeW * 2.5) + ' ' + (strokeW * 2.5) + '"/>'];
    var zoneTitle = "Clicar para saltar para esta zona na lista, ou arrastar para mover (os campos Posição X/Y ficam para o ajuste fino)";
    labels.forEach(function (l) {
      var z = l.z;
      var x = z.posX - minX + padSide, y = z.posY - minY + padTop;
      var color = lzZoneColor(z, colorMap, zones);
      if (z.curve) {
        // Zona curva: em vez de um retângulo reto, desenha a "espinha" da
        // zona (uma curva de círculo por n cordas, uma por tile) como uma
        // fita grossa — dá uma ideia visual da curvatura sem mexer no
        // resto da geometria (posição/tamanho dos vizinhos continuam a
        // usar a largura "desenvolvida" normal, como se fosse reto).
        var spine = lzCurveSpinePoints(z.curve.n, z.curve.angleDeg, z.curve.convex);
        var spineMinX = Math.min.apply(null, spine.map(function (p) { return p.x; }));
        var spineMaxX = Math.max.apply(null, spine.map(function (p) { return p.x; }));
        var spineSpan = (spineMaxX - spineMinX) || 1;
        var scale = z.w / spineSpan;
        var cx = x + z.w / 2, cy = y + z.h / 2;
        var d = spine.map(function (p, i) {
          return (i === 0 ? "M" : "L") + (cx + p.x * scale).toFixed(3) + "," + (cy + p.y * scale).toFixed(3);
        }).join(" ");
        // Recorta a fita ao retângulo normal da zona (mesmo x/y/w/h que um
        // zona reta ocuparia) — sem isto a "barriga" da curva ultrapassava
        // para dentro das zonas vizinhas.
        var clipId = "lz-curve-clip-" + escapeXml(z.id || Math.random().toString(36).slice(2));
        parts.push('<clipPath id="' + clipId + '"><rect x="' + x + '" y="' + y + '" width="' + z.w + '" height="' + z.h + '"/></clipPath>');
        parts.push('<g clip-path="url(#' + clipId + ')">' +
          '<path data-zone-id="' + escapeXml(z.id || "") + '" d="' + d + '" fill="none" stroke="' + color + '" stroke-opacity="0.55" stroke-width="' + z.h + '" stroke-linejoin="round" stroke-linecap="butt" style="cursor:grab;"><title>' + zoneTitle + '</title></path>' +
          '<path d="' + d + '" fill="none" stroke="' + color + '" stroke-width="' + strokeW + '" stroke-linejoin="round" stroke-linecap="round" pointer-events="none"/>' +
          '</g>');
      } else {
        parts.push('<rect data-zone-id="' + escapeXml(z.id || "") + '" x="' + x + '" y="' + y + '" width="' + z.w + '" height="' + z.h + '" fill="' + color + '" fill-opacity="0.55" stroke="' + color + '" stroke-width="' + strokeW + '" rx="' + radius + '" style="cursor:grab;"><title>' + zoneTitle + '</title></rect>');
      }
      parts.push('<text x="' + x + '" y="' + (y - labelGap - l.level * rowH) + '" font-size="' + fontSize + '" fill="' + ink + '" text-anchor="start">' + escapeXml(l.text) + '</text>');
    });

    // Legenda de rodapé com o tamanho total do conjunto — dá para ver de
    // imediato sem ter de olhar para os cartões de resultado ao lado.
    var captionText = "Conjunto: " + fmt(totalW, 2) + "×" + fmt(totalH, 2) + "m" +
      (pm ? " — canvas: " + fmtInt(pm.canvasW) + "×" + fmtInt(pm.canvasH) + "px" + (pm.mixedPitch ? " (aprox.)" : "") : "");
    parts.push('<text x="' + padSide + '" y="' + (padTop + totalH + padBottom * 0.62) + '" font-size="' + (fontSize * 0.9) + '" fill="' + inkFaint + '" text-anchor="start">' + escapeXml(captionText) + '</text>');

    svg.innerHTML = parts.join("");

    var groupNames = [];
    Object.keys(colorMap).forEach(function (key) { if (valid.some(function (z) { return lzColorKey(z, zones) === key; })) groupNames.push(key); });
    legend.innerHTML = groupNames.map(function (key) {
      return '<span><span style="display:inline-block; width:10px; height:10px; border-radius:2px; background:' + colorMap[key] + '; opacity:0.75; margin-right:5px; vertical-align:-1px;"></span>' + escapeXml(key) + '</span>';
    }).join("") +
      '<span><span style="display:inline-block; width:10px; height:10px; border-radius:2px; background:' + rose + '; opacity:0.3; border:1px dashed ' + rose + '; margin-right:5px; vertical-align:-1px;"></span>gap (sem LED)</span>';

    // Coluna de detalhes ao lado do desenho — ordenada como a lista (mais à
    // esquerda primeiro), com a informação toda que antes ia na legenda do
    // desenho (tamanho e ponto de início/fim em metros).
    var details = document.getElementById("lz-diagram-details");
    details.innerHTML = valid.slice().sort(function (a, b) { return a.posX - b.posX || a.posY - b.posY; }).map(function (z) {
      var meta = fmt(z.w, 2) + "×" + fmt(z.h, 2) + "m — " + fmtInt(z.totalPx) + "×" + fmtInt(z.totalPy) + "px — X:" + fmt(z.posX, 2) + "→" + fmt(z.posX + z.w, 2) +
        (z.posY ? ", Y:" + fmt(z.posY, 2) + "→" + fmt(z.posY + z.h, 2) : "") + "m";
      return '<div class="lz-detail-row" data-zone-id="' + escapeXml(z.id || "") + '">' +
        '<span class="lz-detail-dot" style="background:' + lzZoneColor(z, colorMap, zones) + ';"></span>' +
        '<div><div class="lz-detail-name">' + escapeXml(z.name) + '</div><div class="lz-detail-meta">' + escapeXml(meta) + '</div></div>' +
        '</div>';
    }).join("");

    return { w: totalW, h: totalH };
  }

  // Converte as zonas (posição/tamanho em metros, cada uma com o seu
  // próprio pitch) para um único canvas em píxeis, para exportar para
  // media server. Pitches diferentes entre zonas não têm conversão exata
  // (um metro físico corresponde a nº de píxeis diferente consoante o
  // pitch) — usa-se a zona marcada como "Ref." como referência; sem
  // nenhuma marcada, cai para a zona mais alta em metros (desempate pela
  // maior área, se houver empate na altura).
  // Importante marcar manualmente num setup com pitches misturados: a
  // referência automática muda sozinha ao adicionar/remover zonas, o que
  // recalcula (e desalinha) os píxeis de todas as outras.
  function lzComputePixelMap(zones) {
    var valid = zones.filter(function (z) {
      return isFinite(z.posX) && isFinite(z.posY) && z.w > 0 && z.h > 0 && z.totalPx > 0 && z.totalPy > 0;
    });
    if (!valid.length) return null;
    valid.forEach(function (z) {
      z.pitchX = (z.w * 1000) / z.totalPx;
      z.pitchY = (z.h * 1000) / z.totalPy;
    });
    var pinnedRef = valid.filter(function (z) { return z.isRef; })[0];
    var ref = pinnedRef || valid.reduce(function (a, b) {
      if (b.h !== a.h) return b.h > a.h ? b : a;
      return (b.w * b.h) > (a.w * a.h) ? b : a;
    });
    var refPitch = (ref.pitchX + ref.pitchY) / 2;
    var mixedPitch = valid.some(function (z) { return Math.abs((z.pitchX + z.pitchY) / 2 - refPitch) > 0.05; });

    var minX = Math.min.apply(null, valid.map(function (z) { return z.posX; }));
    var minY = Math.min.apply(null, valid.map(function (z) { return z.posY; }));
    valid.forEach(function (z) {
      z.pxX = Math.round(((z.posX - minX) * 1000) / refPitch);
      z.pxY = Math.round(((z.posY - minY) * 1000) / refPitch);
      z.pxW = Math.max(1, Math.round((z.w * 1000) / refPitch));
      z.pxH = Math.max(1, Math.round((z.h * 1000) / refPitch));
    });
    var canvasW = Math.max.apply(null, valid.map(function (z) { return z.pxX + z.pxW; }));
    var canvasH = Math.max.apply(null, valid.map(function (z) { return z.pxY + z.pxH; }));
    return { zones: valid, canvasW: canvasW, canvasH: canvasH, refPitch: refPitch, refName: ref.name, mixedPitch: mixedPitch, refPinned: !!pinnedRef };
  }

  function lzCanvasScale(pm) {
    var MAX_DIM = 4000;
    var longest = Math.max(pm.canvasW, pm.canvasH);
    return longest > MAX_DIM ? MAX_DIM / longest : 1;
  }

  function lzExportPixelMapPNG() {
    var pm = lzLastTotals && lzLastTotals.zones ? lzComputePixelMap(lzLastTotals.zones) : null;
    if (!pm) { showToast("Preenche pelo menos uma zona com modelo/resolução válidos primeiro."); return; }
    var colorMap = (lzLastTotals && lzLastTotals.colorMap) || lzGroupColorMap(pm.zones);
    var scale = lzCanvasScale(pm);
    var baseW = Math.max(1, Math.round(pm.canvasW * scale)), baseH = Math.max(1, Math.round(pm.canvasH * scale));

    // Tamanho de letra com limites absolutos — canvas muito compridos e
    // baixos (ex: várias tiras largas e pouco altas) davam letra minúscula
    // se calculada só a partir da altura, e a legenda geral colava-se à
    // legenda da primeira zona. Usa a média geométrica de W×H como
    // referência de escala, com mínimo e máximo fixos.
    var sizeRef = Math.sqrt(baseW * baseH);
    var fontPx = Math.max(14, Math.min(26, Math.round(sizeRef * 0.018)));
    var labelFont = fontPx + "px sans-serif";
    var captionFontPx = Math.max(13, Math.round(fontPx * 0.85));
    var captionFont = captionFontPx + "px sans-serif";

    var measureCtx = document.createElement("canvas").getContext("2d");
    measureCtx.font = labelFont;
    var labels = pm.zones.map(function (z) {
      var text = z.name + " — " + z.pxW + "×" + z.pxH + "px @ (" + z.pxX + "," + z.pxY + ")";
      return { z: z, text: text, textW: measureCtx.measureText(text).width, level: 0 };
    });
    var maxRight = 0;
    labels.forEach(function (l) {
      maxRight = Math.max(maxRight, l.z.pxX * scale + l.textW);
    });
    var extraRight = Math.max(0, Math.ceil(maxRight - baseW) + 10);

    // Zonas vizinhas na mesma linha (ex: várias tiras lado a lado) têm
    // legendas mais largas do que elas próprias — sem isto, ficavam coladas
    // umas às outras. Empilha as que colidem em "andares" alternados por
    // cima da própria zona, dentro do mesmo grupo (zonas com o mesmo Y).
    var padX = 5, padY = 3, rowGap = 4;
    var rowH = fontPx + padY * 2 + rowGap;
    var groups = {};
    labels.forEach(function (l) { (groups[l.z.pxY] = groups[l.z.pxY] || []).push(l); });
    Object.keys(groups).forEach(function (key) {
      var group = groups[key].sort(function (a, b) { return a.z.pxX - b.z.pxX; });
      var levelRightEdge = [];
      group.forEach(function (l) {
        var x = l.z.pxX * scale;
        var lvl = 0;
        while (levelRightEdge[lvl] !== undefined && x < levelRightEdge[lvl] + 10) lvl++;
        l.level = lvl;
        levelRightEdge[lvl] = x + l.textW + padX * 2;
      });
    });
    var maxLevel = labels.reduce(function (m, l) { return Math.max(m, l.level); }, 0);

    var canvasResLabel = "Canvas: " + pm.canvasW + "×" + pm.canvasH + "px" +
      " — pitch de referência: " + fmt(pm.refPitch, 2) + "mm (\"" + pm.refName + "\"" + (pm.refPinned ? ", marcada" : ", automática — mais alta") + ")" +
      (pm.mixedPitch ? " — pitches diferentes, aproximado" : "") +
      (scale < 1 ? " — imagem reduzida " + fmt(scale * 100, 0) + "%, valores nas legendas são os reais" : "");

    // Faixas de cabeçalho/rodapé em fundo próprio, bem separadas da área do
    // canvas — a legenda geral deixa de disputar espaço com a legenda da
    // primeira zona. A resolução repete-se no rodapé para não ter de subir
    // a imagem toda para a conferir.
    var bandH = Math.round(captionFontPx * 2.4);
    var labelGap = Math.round(fontPx * 1.5);
    var offsetTop = bandH + labelGap + maxLevel * rowH;

    var cw = baseW + extraRight, ch = offsetTop + baseH + bandH;
    var canvas = document.createElement("canvas");
    canvas.width = cw; canvas.height = ch;
    var ctx = canvas.getContext("2d");
    ctx.fillStyle = "#0B1116";
    ctx.fillRect(0, 0, cw, ch);

    ctx.fillStyle = "#182028";
    ctx.fillRect(0, 0, cw, bandH);
    ctx.fillRect(0, ch - bandH, cw, bandH);
    ctx.fillStyle = "#D7E0E6";
    ctx.font = captionFont;
    ctx.textBaseline = "middle";
    ctx.fillText(canvasResLabel, 12, bandH / 2);
    ctx.fillText(canvasResLabel, 12, ch - bandH / 2);

    // Marca o canvas todo a rosa (= gap, sem LED) por baixo; as zonas
    // desenham-se por cima com a cor do seu grupo, "tapando" essa marca onde
    // há ecrã real — distingue de imediato pixel real de espaço vazio, e
    // agrupa visualmente zonas relacionadas.
    ctx.fillStyle = "rgba(209,77,120,0.14)";
    ctx.fillRect(0, offsetTop, baseW, baseH);
    ctx.strokeStyle = "rgba(209,77,120,0.6)";
    ctx.setLineDash([6, 6]);
    ctx.lineWidth = Math.max(1, Math.round(Math.min(baseW, baseH) * 0.0025));
    ctx.strokeRect(0, offsetTop, baseW, baseH);
    ctx.setLineDash([]);

    ctx.font = labelFont;
    ctx.textBaseline = "bottom";
    labels.forEach(function (l) {
      var z = l.z;
      var x = z.pxX * scale, y = z.pxY * scale + offsetTop, w = z.pxW * scale, h = z.pxH * scale;
      var color = lzZoneColor(z, colorMap, pm.zones) || "#159187";
      ctx.fillStyle = lzHexToRgba(color, 0.6);
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(1, Math.round(Math.min(baseW, baseH) * 0.0025));
      ctx.strokeRect(x, y, w, h);

      // Legenda com fundo próprio — fica legível mesmo em cima de outra
      // zona/gap. Zonas vizinhas com legendas coladas sobem para o andar
      // seguinte (l.level), calculado acima por grupo.
      var labelBaselineY = y - 6 - l.level * rowH;
      ctx.fillStyle = "rgba(8,12,16,0.82)";
      ctx.fillRect(x - padX, labelBaselineY - fontPx - padY, l.textW + padX * 2, fontPx + padY * 2);
      ctx.fillStyle = "#E7EDF2";
      ctx.fillText(l.text, x, labelBaselineY);
    });

    canvas.toBlob(function (blob) {
      if (blob) saveOrShareBlob("mapa-pixeis-" + Date.now() + ".png", blob);
    }, "image/png");
  }

  function lzExportMaskPNG() {
    var pm = lzLastTotals && lzLastTotals.zones ? lzComputePixelMap(lzLastTotals.zones) : null;
    if (!pm) { showToast("Preenche pelo menos uma zona com modelo/resolução válidos primeiro."); return; }
    var scale = lzCanvasScale(pm);
    var cw = Math.max(1, Math.round(pm.canvasW * scale)), ch = Math.max(1, Math.round(pm.canvasH * scale));
    var canvas = document.createElement("canvas");
    canvas.width = cw; canvas.height = ch;
    var ctx = canvas.getContext("2d");
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, cw, ch);
    ctx.fillStyle = "#FFFFFF";
    pm.zones.forEach(function (z) {
      ctx.fillRect(z.pxX * scale, z.pxY * scale, z.pxW * scale, z.pxH * scale);
    });
    canvas.toBlob(function (blob) {
      if (blob) saveOrShareBlob("mascara-" + Date.now() + ".png", blob);
    }, "image/png");
  }

  document.getElementById("lz-export-map").addEventListener("click", lzExportPixelMapPNG);
  document.getElementById("lz-export-mask").addEventListener("click", lzExportMaskPNG);

  // As zonas ficam gravadas no localStorage a cada alteração e restauradas
  // ao abrir a app — um refresh acidental (ou o telemóvel a recarregar a
  // PWA em segundo plano) já não apaga um setup complexo de várias zonas,
  // que demora a voltar a preencher à mão.
  var LZ_STORAGE_KEY = "calculadores-zonas-v1";
  function lzSerializeZones() {
    return Array.from(lzList.querySelectorAll(".card")).map(function (card) {
      var opts = lzOptsFromCard(card);
      opts.name = card.querySelector(".lz-name").value;
      opts.posX = card.querySelector(".lz-posx").value;
      opts.posY = card.querySelector(".lz-posy").value;
      opts.ref = card.querySelector(".lz-ref").checked;
      opts.colorOverride = card.dataset.colorOverride || null;
      return opts;
    });
  }
  function lzSaveToStorage() {
    try {
      var data = lzSerializeZones();
      if (data.length) localStorage.setItem(LZ_STORAGE_KEY, JSON.stringify(data));
      else localStorage.removeItem(LZ_STORAGE_KEY);
    } catch (e) {}
  }
  function lzRestoreFromStorage() {
    var raw;
    try { raw = localStorage.getItem(LZ_STORAGE_KEY); } catch (e) { return; }
    if (!raw) return;
    var data;
    try { data = JSON.parse(raw); } catch (e) { return; }
    if (!Array.isArray(data) || !data.length) return;
    data.forEach(function (opts) { lzAddZone(opts.name, opts, false); });
  }

  function calcLedZones() {
    var cards = lzList.querySelectorAll(".card");
    var totalsCard = document.getElementById("lz-totals-card");
    var diagramCard = document.getElementById("lz-diagram-card");
    var previewBar = document.getElementById("lz-preview-bar");
    var bulkCount = lzList.querySelectorAll(".lz-select:checked").length;
    document.getElementById("lz-bulk-count").textContent = bulkCount + (bulkCount === 1 ? " selecionada" : " selecionadas");
    if (!cards.length) {
      totalsCard.style.display = "none";
      diagramCard.style.display = "none";
      previewBar.classList.remove("lz-has-zones");
      lzLastTotals = null;
      lzSaveToStorage();
      return;
    }
    totalsCard.style.display = "block";
    diagramCard.style.display = "block";
    previewBar.classList.add("lz-has-zones");

    var zones = [];
    cards.forEach(function (card) {
      var name = card.querySelector(".lz-name").value.trim() || "Zona";
      var dialogTitle = card.querySelector(".lz-dialog-title");
      if (dialogTitle) dialogTitle.textContent = "Editar zona — " + name;
      var posX = parseFloat(card.querySelector(".lz-posx").value);
      var posY = parseFloat(card.querySelector(".lz-posy").value);
      if (isNaN(posX)) posX = 0;
      if (isNaN(posY)) posY = 0;
      var modelSel = card.querySelector(".lz-model");
      var modelLabel = modelSel.value === "custom" ? "Personalizado" : (LED_TILES_DATA[parseInt(modelSel.value, 10)] || {}).modelo || "Personalizado";
      var mw = parseFloat(card.querySelector(".lz-mw").value);
      var mh = parseFloat(card.querySelector(".lz-mh").value);
      var rx = parseFloat(card.querySelector(".lz-rx").value);
      var ry = parseFloat(card.querySelector(".lz-ry").value);
      var weight = parseFloat(card.querySelector(".lz-weight").value);
      var amp = parseFloat(card.querySelector(".lz-amp").value);
      var mxInput = card.querySelector(".lz-mx");
      var myInput = card.querySelector(".lz-my");
      var activeSeg = card.querySelector(".lz-sizemode-seg .seg-btn.active");
      var mx, my;
      if (activeSeg && activeSeg.dataset.sizemode === "meters") {
        var targetW = parseFloat(card.querySelector(".lz-target-w").value);
        var targetH = parseFloat(card.querySelector(".lz-target-h").value);
        mx = (isNaN(targetW) || !(mw > 0)) ? NaN : Math.max(1, Math.ceil((targetW * 1000) / mw));
        my = (isNaN(targetH) || !(mh > 0)) ? NaN : Math.max(1, Math.ceil((targetH * 1000) / mh));
        if (!isNaN(mx)) mxInput.value = mx;
        if (!isNaN(my)) myInput.value = my;
      } else {
        mx = parseFloat(mxInput.value);
        my = parseFloat(myInput.value);
      }

      var totalPx = mx * rx, totalPy = my * ry;
      var wM = (mx * mw) / 1000, hM = (my * mh) / 1000;
      var numTiles = mx * my;
      var zoneWeight = isNaN(weight) ? 0 : weight * numTiles;
      var zoneAmp = isNaN(amp) ? 0 : amp * numTiles;
      var zonePixels = totalPx * totalPy;
      var zoneArea = wM * hM;

      var readout = card.querySelector(".lz-readout");
      if ([mw,mh,rx,ry,mx,my].some(isNaN) || mx < 1 || my < 1) {
        readout.textContent = "Preenche os campos desta zona.";
      } else {
        readout.innerHTML = modelLabel + " — " + fmtInt(totalPx) + "×" + fmtInt(totalPy) + " px — " + fmt(wM,2) + " x " + fmt(hM,2) + " m (" + fmt(zoneArea,2) + " m²) — " + fmtInt(numTiles) + " tiles" + (isNaN(weight) ? "" : " — " + fmt(zoneWeight,1) + " kg") + (isNaN(amp) ? "" : " — " + fmt(zoneAmp,2) + " A");
      }

      var visible = card.querySelector(".lz-visible").checked;
      card.style.opacity = visible ? "" : "0.5";
      var isRef = card.querySelector(".lz-ref").checked;

      var curveReadout = card.querySelector(".lz-curve-readout");
      var curveText = null;
      var curveInfo = null;
      if (curveReadout) {
        if (!card.querySelector(".lz-curve-enabled").checked) {
          curveReadout.textContent = "Curvatura: desligada";
        } else {
          var curveModeBtnActive = card.querySelector(".lz-curve-mode-seg .seg-btn.active");
          var curveMode = curveModeBtnActive ? curveModeBtnActive.dataset.curvemode : "angle";
          var curveValue = parseFloat(card.querySelector(".lz-curve-value").value);
          var curveDirValue = card.querySelector(".lz-curve-dir").value;
          var curveDir = curveDirValue === "convex" ? "convexo" : "côncavo";
          var cZone = (isNaN(mw) || isNaN(curveValue)) ? null : resolveCurvature(curveMode, curveValue, mx, mw / 1000);
          if (!cZone) {
            curveReadout.textContent = "Curvatura: esse raio é fisicamente impossível para esta largura de tile.";
          } else {
            curveText = curveDir + ", " + fmt(cZone.angleDegPerTile,2) + "°/tile, raio " + (isFinite(cZone.radiusM) ? fmt(cZone.radiusM,2) + " m" : "∞") +
              ", arco total " + fmt(cZone.totalAngleDeg,1) + "°, corda " + fmt(cZone.chordWidthM,2) + " m, flecha " + fmt(cZone.sagittaM,2) + " m";
            curveReadout.textContent = "Curvatura: " + curveText;
            curveInfo = { n: mx, angleDeg: cZone.angleDegPerTile, convex: curveDirValue === "convex" };
          }
        }
      }

      zones.push({ id: card.dataset.zoneId, name: name, model: modelLabel, mx: mx, my: my, numTiles: isNaN(numTiles) ? 0 : numTiles, w: wM, h: hM, area: isNaN(zoneArea) ? 0 : zoneArea, totalPx: totalPx, totalPy: totalPy, pixels: isNaN(zonePixels) ? 0 : zonePixels, weight: zoneWeight, amp: zoneAmp, posX: posX, posY: posY, visible: visible, isRef: isRef, colorOverride: card.dataset.colorOverride || null, curveText: curveText, curve: curveInfo });
    });

    // Zonas desmarcadas em "Vis." ficam de fora do desenho, das contas do
    // conjunto e dos PNG exportados — mas continuam na lista e guardadas,
    // só "apagadas" temporariamente da visualização/exportação.
    var visibleZones = zones.filter(function (z) { return z.visible; });

    var totalTiles = visibleZones.reduce(function (s, z) { return s + z.numTiles; }, 0);
    var totalPixels = visibleZones.reduce(function (s, z) { return s + z.pixels; }, 0);
    var totalArea = visibleZones.reduce(function (s, z) { return s + z.area; }, 0);
    var totalWeight = visibleZones.reduce(function (s, z) { return s + z.weight; }, 0);
    var totalAmp = visibleZones.reduce(function (s, z) { return s + z.amp; }, 0);

    document.getElementById("lz-out-tiles").textContent = fmtInt(totalTiles);
    document.getElementById("lz-out-pixels").innerHTML = fmtInt(totalPixels) + "<small>px</small> (" + fmt(totalPixels/1e6,2) + "<small>MP</small>)";
    document.getElementById("lz-out-area").innerHTML = fmt(totalArea,2) + "<small>m²</small>";
    document.getElementById("lz-out-weight").innerHTML = fmt(totalWeight,1) + "<small>kg</small>";
    document.getElementById("lz-out-amp").innerHTML = fmt(totalAmp,2) + "<small>A</small> (" + fmt(totalAmp/3,2) + "<small>A/fase</small>)";

    var colorMap = lzGroupColorMap(visibleZones);
    cards.forEach(function (card, i) {
      var colorInput = card.querySelector(".lz-color-input");
      var resetBtn = card.querySelector(".lz-color-reset");
      if (colorInput && document.activeElement !== colorInput) colorInput.value = lzZoneColor(zones[i], colorMap, zones);
      if (resetBtn) resetBtn.style.visibility = zones[i].colorOverride ? "visible" : "hidden";
    });

    var pm = lzComputePixelMap(visibleZones);
    var bbox = lzRenderDiagram(visibleZones, colorMap, pm);
    document.getElementById("lz-out-bbox").innerHTML = bbox ? (fmt(bbox.w,2) + " x " + fmt(bbox.h,2) + "<small>m</small>") : "—";

    var canvasResText = pm ? (fmtInt(pm.canvasW) + " x " + fmtInt(pm.canvasH) + " px") : "—";
    document.getElementById("lz-out-canvasres").innerHTML = pm
      ? (fmtInt(pm.canvasW) + "×" + fmtInt(pm.canvasH) + "<small>px</small>" + (pm.mixedPitch ? " <small>(pitches diferentes — aproximado, ref. \"" + escapeXml(pm.refName) + "\"" + (pm.refPinned ? ", marcada" : ", automática") + ")</small>" : ""))
      : "—";
    var hiddenCount = zones.length - visibleZones.length;
    document.getElementById("lz-preview-bar-text").textContent = (pm ? canvasResText : "—") + " · " + fmtInt(totalTiles) + " tiles · " + visibleZones.length + " zona(s)" + (hiddenCount ? " (" + hiddenCount + " escondida(s))" : "");

    document.getElementById("lz-sum").textContent = visibleZones.map(function (z) {
      return z.name + " (X:" + fmt(z.posX,2) + "m Y:" + fmt(z.posY,2) + "m): " + z.model + " — " + z.mx + "x" + z.my + " tiles (" + fmtInt(z.numTiles) + "), " + fmtInt(z.totalPx) + "x" + fmtInt(z.totalPy) + " px, " + fmt(z.w,2) + " x " + fmt(z.h,2) + " m (" + fmt(z.area,2) + " m²), " + fmt(z.weight,1) + " kg, " + fmt(z.amp,2) + " A" + (z.curveText ? "\nCurvatura: " + z.curveText : "");
    }).join("\n") + (hiddenCount ? "\n\n(" + hiddenCount + " zona(s) escondida(s), fora destas contas)" : "") + "\n\nTOTAL: " + fmtInt(totalTiles) + " tiles, " + fmtInt(totalPixels) + " px (" + fmt(totalPixels/1e6,2) + " MP, soma dos píxeis nativos de cada zona), " + fmt(totalArea,2) + " m² (soma das zonas), " + fmt(totalWeight,1) + " kg, " + fmt(totalAmp,2) + " A máx. (" + fmt(totalAmp/3,2) + " A/fase)" +
      (bbox ? "\nDimensão do conjunto (com gaps): " + fmt(bbox.w,2) + " x " + fmt(bbox.h,2) + " m" : "") +
      (pm ? "\nResolução final do canvas (com gaps): " + canvasResText + (pm.mixedPitch ? " — pitches diferentes, aproximado com o pitch da zona \"" + pm.refName + "\" como referência (" + (pm.refPinned ? "marcada manualmente" : "automática, zona mais alta") + ")" : "") : "");

    lzLastTotals = { zones: visibleZones, totalTiles: totalTiles, totalPixels: totalPixels, totalArea: totalArea, totalWeight: totalWeight, totalAmp: totalAmp, bbox: bbox, pixelMap: pm, colorMap: colorMap };
    lzSortCardsByPosition();
    lzSaveToStorage();
    if (typeof calcProjeto === "function") calcProjeto();
  }
