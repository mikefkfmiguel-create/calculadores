// Aba "Conhecimento": notas técnicas de afinação guardadas no repositório,
// em conhecimento/*.md, para consultar no telemóvel durante um trabalho.
//
// SÓ LEITURA, e de propósito. A app é estática (GitHub Pages) e não pode
// escrever no repositório; as notas novas entram por lá (pedido ao Claude,
// que acrescenta o ficheiro e a linha em conhecimento/indice.json). Aqui
// apenas se lê o índice e se mostra a nota escolhida.
//
// O texto das notas fica em português mesmo com a app em EN
// (translate="no" no visor): o motor de i18n troca palavras soltas, e numa
// nota técnica isso dava meia-tradução com os valores trocados de sítio.
(function () {
  "use strict";

  // Relativa à página. A app Better call Mike (mike/) diz a dela no
  // data-pasta da lista ("../conhecimento/").
  var PASTA = "conhecimento/";
  var carregado = false;
  var lista, visor;

  function esc(s) {
    return String(s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function linkSeguro(url) {
    if (/^https?:\/\//i.test(url)) return url;
    if (/^[\w.\-\/]+$/.test(url) && url.indexOf("..") < 0) return PASTA + url;
    return "#";
  }

  // Negrito, itálico, código e ligações, depois de escapar o HTML.
  function inline(texto) {
    var codigos = [];
    var s = esc(texto).replace(/`([^`]+)`/g, function (_, c) {
      codigos.push("<code>" + c + "</code>");
      return "\u0000" + (codigos.length - 1) + "\u0000";
    });
    s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, function (_, t, u) {
      var href = linkSeguro(u.replace(/&amp;/g, "&"));
      return '<a href="' + esc(href) + '" target="_blank" rel="noopener">' + t + "</a>";
    });
    s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    s = s.replace(/(^|[\s(])_([^_]+)_(?=[\s.,;:)]|$)/g, "$1<em>$2</em>");
    s = s.replace(/\u0000(\d+)\u0000/g, function (_, i) { return codigos[+i]; });
    return s;
  }

  function celulas(linha) {
    return linha.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map(function (c) { return c.trim(); });
  }

  // Markdown suficiente para as notas: títulos, parágrafos, listas
  // (com tarefas), citações e tabelas.
  function markdown(md) {
    var linhas = md.replace(/\r\n?/g, "\n").split("\n");
    var out = [];
    var i = 0;
    while (i < linhas.length) {
      var l = linhas[i];
      var m;
      if (!l.trim()) { i++; continue; }

      if ((m = /^(#{1,4})\s+(.*)$/.exec(l))) {
        var n = Math.min(m[1].length + 1, 5);
        out.push("<h" + n + ">" + inline(m[2]) + "</h" + n + ">");
        i++; continue;
      }

      if (/^\s*\|/.test(l) && i + 1 < linhas.length && /^\s*\|?\s*:?-{3,}/.test(linhas[i + 1])) {
        var cab = celulas(l);
        i += 2;
        var html = '<div class="kb-tabela"><table><thead><tr>' +
          cab.map(function (c) { return "<th>" + inline(c) + "</th>"; }).join("") + "</tr></thead><tbody>";
        while (i < linhas.length && /^\s*\|/.test(linhas[i])) {
          html += "<tr>" + celulas(linhas[i]).map(function (c) { return "<td>" + inline(c) + "</td>"; }).join("") + "</tr>";
          i++;
        }
        out.push(html + "</tbody></table></div>");
        continue;
      }

      if (/^>\s?/.test(l)) {
        var cit = [];
        while (i < linhas.length && /^>\s?/.test(linhas[i])) { cit.push(linhas[i].replace(/^>\s?/, "")); i++; }
        out.push("<blockquote>" + inline(cit.join(" ")) + "</blockquote>");
        continue;
      }

      if (/^\s*([-*]|\d+\.)\s+/.test(l)) {
        var ordenada = /^\s*\d+\./.test(l);
        var itens = [];
        while (i < linhas.length && /^\s*([-*]|\d+\.)\s+/.test(linhas[i])) {
          var t = linhas[i].replace(/^\s*([-*]|\d+\.)\s+/, "");
          var tarefa = /^\[( |x|X)\]\s+/.exec(t);
          if (tarefa) {
            itens.push('<li class="kb-tarefa"><span class="kb-caixa">' + (tarefa[1] === " " ? "☐" : "☑") + "</span> " +
              inline(t.slice(tarefa[0].length)) + "</li>");
          } else {
            itens.push("<li>" + inline(t) + "</li>");
          }
          i++;
        }
        var tag = ordenada ? "ol" : "ul";
        out.push("<" + tag + ">" + itens.join("") + "</" + tag + ">");
        continue;
      }

      var par = [];
      while (i < linhas.length && linhas[i].trim() &&
             !/^(#{1,4}\s|>|\s*\||\s*([-*]|\d+\.)\s+)/.test(linhas[i])) {
        par.push(linhas[i].trim()); i++;
      }
      out.push("<p>" + inline(par.join(" ")) + "</p>");
    }
    return out.join("\n");
  }

  function aviso(texto) {
    visor.innerHTML = '<p class="kb-aviso">' + esc(texto) + "</p>";
  }

  function abrirNota(nota, botao) {
    Array.prototype.forEach.call(lista.querySelectorAll(".kb-item"), function (b) {
      b.setAttribute("aria-pressed", b === botao ? "true" : "false");
    });
    aviso("A carregar…");
    fetch(PASTA + nota.ficheiro, { cache: "no-cache" })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.text(); })
      .then(function (md) {
        var pdf = nota.pdf
          ? '<p class="kb-pdf"><a class="copy kb-pdf-link" href="' + esc(PASTA + nota.pdf) + '" target="_blank" rel="noopener">Abrir PDF</a></p>'
          : "";
        visor.innerHTML = pdf + markdown(md);
        visor.scrollIntoView({ behavior: "smooth", block: "start" });
      })
      .catch(function () { aviso("Não foi possível abrir esta nota. Sem rede e sem cópia guardada neste aparelho."); });
  }

  function carregar() {
    if (carregado) return;
    carregado = true;
    lista = document.getElementById("kb-lista");
    visor = document.getElementById("kb-visor");
    if (!lista || !visor) return;
    if (lista.dataset.pasta) PASTA = lista.dataset.pasta;
    fetch(PASTA + "indice.json", { cache: "no-cache" })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (indice) {
        var notas = (indice && indice.notas) || [];
        if (!notas.length) { lista.innerHTML = '<p class="kb-aviso">Ainda não há notas.</p>'; return; }
        lista.innerHTML = "";
        notas.forEach(function (nota) {
          var b = document.createElement("button");
          b.type = "button";
          b.className = "kb-item";
          b.setAttribute("aria-pressed", "false");
          b.innerHTML = '<span class="kb-titulo" translate="no">' + esc(nota.titulo) + "</span>" +
            (nota.resumo ? '<span class="kb-resumo" translate="no">' + esc(nota.resumo) + "</span>" : "") +
            (nota.atualizado ? '<span class="kb-data">Atualizado em ' + esc(nota.atualizado) + "</span>" : "");
          b.addEventListener("click", function () { abrirNota(nota, b); });
          lista.appendChild(b);
        });
        if (notas.length === 1) abrirNota(notas[0], lista.firstChild);
      })
      .catch(function () {
        carregado = false;
        lista.innerHTML = '<p class="kb-aviso">Não foi possível carregar a lista de notas. Tenta outra vez com rede.</p>';
      });
  }

  document.addEventListener("click", function (e) {
    var tab = e.target.closest && e.target.closest('.tab[data-mode="conhecimento"]');
    if (tab) carregar();
  });
  document.addEventListener("DOMContentLoaded", function () {
    var ativa = document.querySelector('.tab[data-mode="conhecimento"][aria-selected="true"]');
    if (ativa) carregar();
  });

  window.kbMarkdown = markdown;
  window.kbCarregar = carregar;
})();
