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
  var chordWidthM = 2 * radiusM * Math.sin(halfTotalRad);
  var sagittaM = radiusM * (1 - Math.cos(halfTotalRad));
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
// A partir do modo escolhido na UI ("angle" = ângulo por tile, "radius" =
// raio desejado) e do valor introduzido, devolve o resultado de
// calcCurvature já resolvido — ou null se o raio for impossível para essa
// largura de tile. Partilhado entre a aba LED (index.html) e o Ecrã
// Complexo (zonas.js).
function resolveCurvature(mode, value, n, tileWidthM) {
  var angleDeg = mode === "radius" ? curvatureAngleFromRadius(value, tileWidthM) : value;
  return (angleDeg == null) ? null : calcCurvature(n, tileWidthM, angleDeg);
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

var STOCK_COLOR = "#5028C8";
function addOption(select, value, text, isDefault, dataIdx, skipMarketTag) {
  var opt = document.createElement("option");
  var isStock = text.indexOf("(stock)") !== -1;
  opt.value = value;
  opt.textContent = (!isStock && !skipMarketTag) ? text + " (mercado)" : text;
  if (isDefault) opt.selected = true;
  if (dataIdx !== undefined) opt.dataset.idx = dataIdx;
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
    var as = arr[a].modelo.indexOf("(stock)") !== -1 ? 0 : 1;
    var bs = arr[b].modelo.indexOf("(stock)") !== -1 ? 0 : 1;
    return as !== bs ? as - bs : a - b;
  });
  return order;
}

function updateSelectStockColor(select) {
  var opt = select.options[select.selectedIndex];
  var isStock = opt && opt.textContent.indexOf("(stock)") !== -1;
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
