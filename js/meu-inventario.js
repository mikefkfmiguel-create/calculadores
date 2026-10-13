/**
 * O MEU INVENTÁRIO.
 *
 * O catálogo (data/*.json) é de referência: lista os modelos que a app conhece,
 * sem dizer de quem são. Cada utilizador diz quais TEM — e é isso que decide a
 * ordem (o que tenho primeiro) e a etiqueta «Mercado» (o que não tenho).
 *
 *   · sem inventário importado, nada aparece como «de mercado» e a ordem é a do
 *     catálogo;
 *   · com inventário, os modelos que não estão lá ficam marcados `mercado`
 *     (é a mesma marca que a app já usava), por isso nada mais muda;
 *   · o inventário vive no navegador deste utilizador (localStorage) e sai e
 *     entra por um ficheiro JSON — nunca vai para o servidor nem para o repo.
 *
 * Formato do ficheiro: { "versao": 1, "itens": ["projectors|Modelo X", ...] },
 * onde cada item é «<ficheiro do catálogo sem .json>|<nome do modelo>».
 */
(function () {
  "use strict";

  var CHAVE = "mikeapps-meu-inventario-v1";

  function emIngles() {
    var b = document.querySelector("#lang-toggle .seg-btn.active");
    return !!b && b.getAttribute("data-lang") === "en";
  }
  function T(pt, en) { return emIngles() ? en : pt; }

  function ler() {
    try {
      var o = JSON.parse(localStorage.getItem(CHAVE) || "null");
      return o && Array.isArray(o.itens) ? o : null;
    } catch (_) { return null; }
  }
  function guardar(itens) {
    try { localStorage.setItem(CHAVE, JSON.stringify({ versao: 1, itens: itens })); return true; }
    catch (_) { return false; }
  }
  function limpar() { try { localStorage.removeItem(CHAVE); } catch (_) {} }

  function nomeDe(o) {
    var n = o && (o.modelo || o.nome);
    return typeof n === "string" && n.trim() ? n : null;
  }
  function caminhar(x, fn) {
    if (Array.isArray(x)) { x.forEach(function (i) { caminhar(i, fn); }); return; }
    if (x && typeof x === "object") {
      fn(x);
      Object.keys(x).forEach(function (k) {
        var v = x[k];
        if (v && typeof v === "object") caminhar(v, fn);
      });
    }
  }

  /** dados: { "projectors": [...], "led-tiles": [...], ... } já carregados. */
  function aplicar(dados) {
    var inv = ler();
    var tenho = null;
    if (inv) { tenho = {}; inv.itens.forEach(function (k) { tenho[k] = true; }); }
    Object.keys(dados || {}).forEach(function (ficheiro) {
      caminhar(dados[ficheiro], function (o) {
        var n = nomeDe(o);
        if (!n) return;
        if (!tenho) { delete o.mercado; return; }
        if (tenho[ficheiro + "|" + n]) delete o.mercado; else o.mercado = true;
      });
    });
    return !!inv;
  }

  function descarregar(nome, texto) {
    var a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([texto], { type: "application/json" }));
    a.download = nome;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }

  function importarTexto(texto) {
    var o;
    try { o = JSON.parse(texto); }
    catch (_) { return { ok: false, erro: T("O ficheiro não é um JSON válido.", "The file is not valid JSON.") }; }
    var itens = o && Array.isArray(o.itens)
      ? o.itens.filter(function (x) { return typeof x === "string" && x.indexOf("|") > 0; })
      : null;
    if (!itens || !itens.length) {
      return { ok: false, erro: T("Não encontrei modelos neste ficheiro (esperava a lista «itens»).",
                                  "No models found in this file (expected an \"itens\" list).") };
    }
    if (!guardar(itens)) return { ok: false, erro: T("Não consegui guardar no navegador.", "Could not save to the browser.") };
    return { ok: true, n: itens.length };
  }

  function dialogo() {
    var d = document.getElementById("mi-dialogo");
    if (d) d.remove();
    d = document.createElement("dialog");
    d.id = "mi-dialogo";
    d.style.cssText = "max-width:min(520px,92vw);border:1px solid #444;border-radius:12px;padding:18px;background:#1c1f26;color:#eee;";
    var inv = ler();
    var estado = inv
      ? T("Inventário ativo: " + inv.itens.length + " modelos.", "Inventory active: " + inv.itens.length + " models.")
      : T("Sem inventário: todos os modelos aparecem iguais, sem etiqueta «Mercado».",
          "No inventory: all models look the same, no \"Market\" label.");
    d.innerHTML =
      '<h3 style="margin:0 0 8px">' + T("O meu inventário", "My inventory") + "</h3>" +
      '<p style="margin:0 0 10px;font-size:13px;opacity:.85">' + T(
        "Diz à app quais os modelos que tens: ficam à frente nas listas e os outros levam a etiqueta «Mercado». Fica só neste navegador; não vai para nenhum servidor.",
        "Tell the app which models you own: they come first in the lists and the others get a \"Market\" label. It stays in this browser only; nothing goes to a server.") + "</p>" +
      '<p id="mi-estado" style="margin:0 0 12px;font-weight:600">' + estado + "</p>" +
      '<p id="mi-erro" style="margin:0 0 10px;color:#ff8a80;display:none"></p>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
        '<button type="button" id="mi-importar" class="mark topbtn">' + T("Importar ficheiro…", "Import file…") + "</button>" +
        '<button type="button" id="mi-exportar" class="mark topbtn"' + (inv ? "" : " disabled") + ">" + T("Exportar (cópia)", "Export (backup)") + "</button>" +
        '<button type="button" id="mi-limpar" class="mark topbtn"' + (inv ? "" : " disabled") + ">" + T("Limpar", "Clear") + "</button>" +
        '<button type="button" id="mi-fechar" class="mark topbtn" style="margin-left:auto">' + T("Fechar", "Close") + "</button>" +
      "</div>" +
      '<input type="file" id="mi-ficheiro" accept="application/json,.json" style="display:none">';
    document.body.appendChild(d);
    var erro = d.querySelector("#mi-erro");
    d.querySelector("#mi-fechar").addEventListener("click", function () { d.close(); });
    d.querySelector("#mi-importar").addEventListener("click", function () { d.querySelector("#mi-ficheiro").click(); });
    d.querySelector("#mi-ficheiro").addEventListener("change", function (ev) {
      var f = ev.target.files && ev.target.files[0];
      if (!f) return;
      var r = new FileReader();
      r.onload = function () {
        var res = importarTexto(String(r.result || ""));
        if (!res.ok) { erro.textContent = res.erro; erro.style.display = "block"; return; }
        location.reload();
      };
      r.readAsText(f);
    });
    d.querySelector("#mi-exportar").addEventListener("click", function () {
      var x = ler();
      if (x) descarregar("meu-inventario.json", JSON.stringify({ versao: 1, itens: x.itens }, null, 1));
    });
    d.querySelector("#mi-limpar").addEventListener("click", function () {
      if (!confirm(T("Limpar o inventário deste navegador?", "Clear the inventory in this browser?"))) return;
      limpar();
      location.reload();
    });
    d.showModal();
  }

  document.addEventListener("DOMContentLoaded", function () {
    var b = document.getElementById("btInventario");
    if (b) b.addEventListener("click", dialogo);
  });

  window.MeuInventario = { aplicar: aplicar, importarTexto: importarTexto, ler: ler, limpar: limpar, abrir: dialogo };
})();
