// Utilitários partilhados entre index.html e ecra-complexo.html — ver esse
// ficheiro para o construtor avançado de ecrãs complexos, que reutiliza
// estas mesmas funções em vez de as duplicar.

function fmt(n, dec) {
  if (!isFinite(n)) return "—";
  return n.toLocaleString("pt-PT", { minimumFractionDigits: dec, maximumFractionDigits: dec });
}
function fmtInt(n) {
  if (!isFinite(n)) return "—";
  return Math.round(n).toLocaleString("pt-PT");
}
// Muitos processadores de vídeo/media servers exigem uma resolução final
// par (nunca ímpar) — arredonda sempre para cima ao par seguinte (1→2,
// 5399→5400, 5400→5400).
function roundUpEven(n) {
  if (!isFinite(n)) return n;
  var r = Math.ceil(n);
  return r % 2 === 0 ? r : r + 1;
}

// Curvatura de um ledwall feito de tiles/cabinets rígidos ligados por
// hinges/locks que só dobram em incrementos fixos entre tiles — não é uma
// curva suave, é um polígono regular que aproxima um arco de círculo: cada
// tile é uma corda de comprimento igual à sua largura, subtendendo o mesmo
// ângulo no centro do arco (w = 2R·sin(θ/2), com θ = ângulo entre tiles
// consecutivos). Devolve null se os dados não derem uma curva válida.
function calcCurvature(n, tileWidthM, angleDegPerTile) {
  if (!(n > 0) || !(tileWidthM > 0) || !isFinite(angleDegPerTile)) return null;
  var developedWidthM = n * tileWidthM;
  var angleAbs = Math.abs(angleDegPerTile);
  if (angleAbs < 1e-6) {
    return { angleDegPerTile: 0, radiusM: Infinity, totalAngleDeg: 0, chordWidthM: developedWidthM, sagittaM: 0, developedWidthM: developedWidthM };
  }
  var thetaRad = angleAbs * Math.PI / 180;
  var radiusM = tileWidthM / (2 * Math.sin(thetaRad / 2));
  var totalAngleDeg = angleAbs * n;
  var halfTotalRad = (thetaRad * n) / 2;
  // Corda (distância reta entre as pontas) e flecha só fazem sentido
  // enquanto o arco não passar de uma volta completa (360°) — a partir daí
  // o ecrã sobrepõe-se a si próprio e "a distância reta entre as pontas"
  // deixa de ser um conceito físico coerente (a fórmula ainda dá um
  // número, mas pode sair negativo, o que é sinal de que já não significa
  // nada). Fica "—" nesse caso, em vez de mostrar um valor inventado.
  var chordSagittaValid = totalAngleDeg <= 360;
  var chordWidthM = chordSagittaValid ? 2 * radiusM * Math.sin(halfTotalRad) : NaN;
  var sagittaM = chordSagittaValid ? radiusM * (1 - Math.cos(halfTotalRad)) : NaN;
  return {
    angleDegPerTile: angleAbs,
    radiusM: radiusM,
    totalAngleDeg: totalAngleDeg,
    chordWidthM: chordWidthM,
    sagittaM: sagittaM,
    developedWidthM: developedWidthM
  };
}
// Converte um raio desejado no ângulo que cada tile teria de dobrar para lá
// chegar (o inverso de calcCurvature). Devolve null se o raio for
// fisicamente impossível para essa largura de tile (corda maior que o
// diâmetro do círculo).
function curvatureAngleFromRadius(radiusM, tileWidthM) {
  if (!(radiusM > 0) || !(tileWidthM > 0)) return null;
  var ratio = tileWidthM / (2 * radiusM);
  if (ratio > 1) return null;
  return (2 * Math.asin(ratio)) * 180 / Math.PI;
}
// Converte uma corda desejada (a distância reta entre as duas pontas do
// ecrã — normalmente o espaço físico disponível no local, ex: a boca de
// palco) no ângulo por tile que lá chega, para um dado nº de tiles e
// largura de tile. Ao contrário do raio, não há fórmula fechada (a corda
// depende do ângulo de forma não-linear através do raio e do seno) — vai
// por bisseção: chordWidthM(ângulo) é sempre decrescente enquanto o arco
// total não passar de meia-volta (180°), gama que cobre qualquer curva
// realista de ledwall. Devolve null se a corda pedida não for alcançável
// nessa gama (precisaria de dobrar mais do que meia-volta).
function curvatureAngleFromChord(chordM, n, tileWidthM) {
  if (!(chordM > 0) || !(n > 0) || !(tileWidthM > 0)) return null;
  var developedWidthM = n * tileWidthM;
  if (chordM >= developedWidthM) return 0;
  var chordAt = function (angleDeg) {
    var c = calcCurvature(n, tileWidthM, angleDeg);
    return c ? c.chordWidthM : NaN;
  };
  var lo = 1e-4, hi = Math.min(179.9 / n, 179.9);
  if (!(chordAt(hi) <= chordM)) return null;
  for (var i = 0; i < 60; i++) {
    var mid = (lo + hi) / 2;
    if (chordAt(mid) > chordM) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}
// A partir do modo escolhido na UI ("angle" = ângulo por tile, "radius" =
// raio desejado, "chord" = corda desejada) e do valor introduzido, devolve
// o resultado de calcCurvature já resolvido — ou null se o valor for
// impossível para essa largura/nº de tiles. Partilhado entre a aba LED
// (index.html) e o Ecrã Complexo (zonas.js).
function resolveCurvature(mode, value, n, tileWidthM) {
  var angleDeg = mode === "radius" ? curvatureAngleFromRadius(value, tileWidthM)
    : mode === "chord" ? curvatureAngleFromChord(value, n, tileWidthM)
    : value;
  return (angleDeg == null) ? null : calcCurvature(n, tileWidthM, angleDeg);
}

// Ecrã de projeção curvo (sem tiles discretos, ao contrário do ledwall) —
// arco de círculo contínuo. Dado o raio e a corda (distância reta entre as
// duas pontas, ex: o espaço disponível no local), devolve o comprimento do
// arco (a largura real da superfície de projeção, "desenrolada"). Devolve
// null se a corda for maior que o diâmetro (círculo impossível para esse
// raio).
function arcLengthFromChordRadius(chordM, radiusM) {
  if (!(chordM > 0) || !(radiusM > 0)) return null;
  var ratio = chordM / (2 * radiusM);
  if (ratio > 1) return null;
  var thetaRad = 2 * Math.asin(ratio);
  return radiusM * thetaRad;
}

function escapeXml(s) {
  return String(s).replace(/[&<>"']/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[c];
  });
}

function normalizeSearch(s) {
  return (s || "").toString().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}
// Campo de pesquisa por cima de um select de modelo — filtra as opções ao
// escrever (sem trazer nada de fora para a app). Sem nenhuma opção a
// corresponder, mostra um link para pesquisar o termo no Google numa nova
// aba — um atalho para o mercado, não uma pesquisa dentro da app.
function lzAttachModelSearch(select) {
  if (!select || select.dataset.searchAttached) return;
  select.dataset.searchAttached = "1";

  var wrap = document.createElement("div");
  wrap.className = "model-search-wrap";
  var input = document.createElement("input");
  input.type = "text";
  input.className = "model-search";
  input.placeholder = "Pesquisar modelo…";
  input.setAttribute("autocomplete", "off");
  wrap.appendChild(input);
  select.parentNode.insertBefore(wrap, select);

  var noResult = document.createElement("div");
  noResult.className = "model-search-noresult";
  noResult.style.display = "none";
  select.parentNode.insertBefore(noResult, select.nextSibling);

  var noResultUrl = null;
  function applyFilter() {
    var raw = input.value.trim();
    var q = normalizeSearch(raw);
    var anyVisible = false;
    Array.prototype.forEach.call(select.options, function (opt) {
      var match = !q || normalizeSearch(opt.textContent).indexOf(q) !== -1;
      opt.hidden = !match;
      if (match) anyVisible = true;
    });
    if (!anyVisible && q) {
      var query = encodeURIComponent(raw + " ficha técnica");
      noResultUrl = "https://www.google.com/search?q=" + query;
      noResult.innerHTML = 'Não encontrei nada na lista — <a class="srclink" href="' + noResultUrl + '" target="_blank" rel="noopener">procurar "' + escapeXml(raw) + '" no mercado ↗</a> <span class="hint">(ou Enter)</span>';
      noResult.style.display = "block";
    } else {
      noResultUrl = null;
      noResult.style.display = "none";
    }
  }
  select._modelSearchRefresh = applyFilter;

  input.addEventListener("input", applyFilter);
  // Enter dispara logo a pesquisa externa quando não há nada na lista —
  // não é preciso ir com o rato até ao link.
  input.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && noResultUrl) {
      e.preventDefault();
      window.open(noResultUrl, "_blank", "noopener");
    }
  });
  select.addEventListener("change", function () {
    if (input.value) { input.value = ""; applyFilter(); }
  });
}

// Notificação leve para avisos simples (substitui alert() nativo). Requer
// um elemento #app-toast na página.
var appToastTimer = null;
function showToast(message) {
  var el = document.getElementById("app-toast");
  if (!el) { alert(message); return; }
  el.textContent = message;
  el.classList.add("show");
  clearTimeout(appToastTimer);
  appToastTimer = setTimeout(function () { el.classList.remove("show"); }, 4200);
}
document.getElementById("app-toast").addEventListener("click", function () {
  this.classList.remove("show");
  clearTimeout(appToastTimer);
});

// Confirmação com o visual da app em vez da caixa nativa do browser
// (confirm() — cada browser desenha-a à sua maneira, sem se poder
// estilizar). Devolve uma Promise<boolean>; cai para confirm() nativo se
// a página não tiver o <dialog> #app-confirm-dialog (ex: ecra-complexo.html,
// que por agora não precisa disto).
function appConfirm(message) {
  var dialog = document.getElementById("app-confirm-dialog");
  if (!dialog) return Promise.resolve(confirm(message));
  dialog.querySelector(".app-confirm-msg").textContent = message;
  dialog.returnValue = "";
  return new Promise(function (resolve) {
    function onClose() {
      dialog.removeEventListener("close", onClose);
      resolve(dialog.returnValue === "yes");
    }
    dialog.addEventListener("close", onClose);
    dialog.showModal();
  });
}
(function () {
  var dialog = document.getElementById("app-confirm-dialog");
  if (!dialog) return;
  // Clicar fora do conteúdo (no próprio <dialog>, que ocupa só a caixa do
  // popup) conta como cancelar — igual ao popup de edição de zona.
  dialog.addEventListener("click", function (e) {
    if (e.target === dialog) dialog.close("no");
  });
})();

var STOCK_COLOR = "#5028C8";
// isStock vem de quem chama (normalmente "!item.mercado" dos dados em
// data/*.json) — nada aqui faz sniffing de texto no nome do modelo.
function addOption(select, value, text, isDefault, dataIdx, isStock, skipMarketTag) {
  var opt = document.createElement("option");
  opt.value = value;
  opt.textContent = (!isStock && !skipMarketTag) ? text + " (mercado)" : text;
  if (isDefault) opt.selected = true;
  if (dataIdx !== undefined) opt.dataset.idx = dataIdx;
  opt.dataset.stock = isStock ? "1" : "0";
  if (isStock) {
    opt.style.color = STOCK_COLOR;
    opt.style.fontWeight = "600";
  } else {
    opt.style.color = "var(--ink)";
    opt.style.fontWeight = "normal";
  }
  select.insertBefore(opt, select.lastElementChild);
}

function stockFirstIndices(arr) {
  var order = arr.map(function (item, i) { return i; });
  order.sort(function (a, b) {
    var as = arr[a].mercado ? 1 : 0;
    var bs = arr[b].mercado ? 1 : 0;
    return as !== bs ? as - bs : a - b;
  });
  return order;
}

function updateSelectStockColor(select) {
  var opt = select.options[select.selectedIndex];
  var isStock = opt && opt.dataset.stock === "1";
  select.style.color = isStock ? STOCK_COLOR : "";
  select.style.fontWeight = isStock ? "600" : "";
}
function wireStockColor(select) {
  select.addEventListener("change", function () { updateSelectStockColor(select); });
}

function downloadBlob(blob, filename) {
  var url = URL.createObjectURL(blob);
  var a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function saveOrShareBlob(filename, blob) {
  var file = null;
  try { file = new File([blob], filename, { type: blob.type }); } catch (e) {}
  // Em PWA instalada no telemóvel, o download por <a download> pode falhar
  // silenciosamente — a partilha nativa é mais fiável quando disponível.
  if (file && navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
    navigator.share({ files: [file] }).catch(function (err) {
      if (err && err.name === "AbortError") return;
      downloadBlob(blob, filename);
    });
    return;
  }
  downloadBlob(blob, filename);
}

function saveOrShareFile(filename, content, mimeType) {
  saveOrShareBlob(filename, new Blob([content], { type: mimeType }));
}

// Partilha de texto (não ficheiro) — usa a partilha nativa (WhatsApp, Email,
// Mensagens...) quando disponível. Suporte de texto no Web Share API é muito
// mais alargado do que o de ficheiros, por isso esta opção funciona em mais
// telemóveis do que as de .txt/.csv. Sem partilha nativa (ex: desktop), cai
// para a área de transferência em silêncio — "Copiar resumo" ao lado já dá
// feedback visual para esse caso.
function shareSummaryText(title, text) {
  if (navigator.share) {
    navigator.share({ title: title, text: text }).catch(function (err) {
      if (err && err.name === "AbortError") return;
      if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).catch(function () {});
    });
  } else if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(text).catch(function () {});
  }
}

function csvEscapeField(field) {
  var s = String(field == null ? "" : field);
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

// Converte um resumo em texto ("Campo: valor" por linha, tal como já é
// gerado para "Copiar resumo") numa tabela de 2 colunas — sem reescrever
// cada calculadora para gerar dados estruturados à parte. Linhas sem
// ":" no início (notas, texto indentado) ficam só na coluna de valor.
// BOM no início do ficheiro para o Excel abrir acentos (ç, ã, é) bem.
function textSummaryToCsv(text) {
  var rows = [["Campo", "Valor"]];
  text.split("\n").forEach(function (line) {
    if (!line.trim()) return;
    var m = line.match(/^([^\s:][^:]*):\s?(.*)$/);
    if (m) rows.push([m[1].trim(), m[2].trim()]);
    else rows.push(["", line.trim()]);
  });
  return "﻿" + rows.map(function (r) { return r.map(csvEscapeField).join(","); }).join("\r\n");
}

// Imprime um resumo isolado (título + texto pré-formatado) — usa-se a
// impressão nativa do browser para "Guardar como PDF" sem precisar de
// nenhuma biblioteca de geração de PDF. #print-area é escondido em ecrã
// e só ele fica visível no modo de impressão (ver css/app.css).
function printSummaryText(title, text) {
  var area = document.getElementById("print-area");
  if (!area) return;
  area.innerHTML = "<h1>" + escapeXml(title) + "</h1><pre>" + escapeXml(text) + "</pre>";
  window.print();
}
