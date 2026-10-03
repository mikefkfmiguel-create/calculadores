// Aba "Better call Mike": perguntas técnicas do terreno, com texto e/ou
// foto, respondidas pelo Worker (/pergunta) com as notas da equipa
// (conhecimento/) e pesquisa na web.
//
// A resposta mostra SEMPRE de onde vem (notas / web / geral), e essa origem
// é verificada no Worker -- ver worker/src/pergunta.js. "Geral" é resposta
// sem fonte: aparece com aviso para confirmar no equipamento.
//
// "Propor como nota" não escreve no repositório (uma página estática não
// pode): manda a resposta para o Worker, que a guarda para revisão. Só vira
// nota em conhecimento/ com o ok do mike.
//
// LIGAR AO MIKE: um telefonema não leva dados nenhuns, por isso a "id da
// app" é um código curto desta instalação (BCM-XXXX), mostrado no ecrã e
// incluído na mensagem de WhatsApp com a pergunta. NÃO é o id da contagem
// de uso: esse foi prometido como "quantos, nunca quem", e não se mistura.
(function () {
  "use strict";

  // Número para "Ligar ao Mike", em formato internacional (ex.: "+351912345678").
  // Vazio = os botões de contacto não aparecem.
  var MIKE_TELEFONE = "";

  var URL_WORKER_CHAVE = "calculadores-assistente-worker-url";
  var URL_WORKER_OMISSAO = "https://calculadores-assistente.avkvideoshare.workers.dev";
  var CODIGO_CHAVE = "bcm-codigo-v1";
  var HISTORICO_MAX = 3;
  var LADO_MAX_FOTO = 1600;

  var historico = []; // [{p, r}] desta sessão, para perguntas de seguimento
  var ultima = null;  // a última resposta mostrada (para propor como nota)
  var foto = null;    // {base64, tipo, url}
  var el = {};

  function $(id) { return document.getElementById(id); }

  function enderecoDoWorker() {
    var g = null;
    try { g = localStorage.getItem(URL_WORKER_CHAVE); } catch (_) {}
    return (g || URL_WORKER_OMISSAO).replace(/\/+$/, "");
  }

  function codigoDaApp() {
    var c = null;
    try { c = localStorage.getItem(CODIGO_CHAVE); } catch (_) {}
    if (c && /^BCM-[A-Z2-9]{4}$/.test(c)) return c;
    var alfabeto = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
    var b = new Uint8Array(4);
    (window.crypto || window.msCrypto).getRandomValues(b);
    c = "BCM-" + Array.prototype.map.call(b, function (x) { return alfabeto[x % alfabeto.length]; }).join("");
    try { localStorage.setItem(CODIGO_CHAVE, c); } catch (_) {}
    return c;
  }

  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function render(md) {
    return typeof window.kbMarkdown === "function" ? window.kbMarkdown(md) : "<p>" + esc(md).replace(/\n/g, "<br>") + "</p>";
  }

  // ---------------------------------------------------------------- foto
  function lerFoto(ficheiro) {
    if (!ficheiro) return;
    if (!/^image\//.test(ficheiro.type)) { estado("Isso não é uma imagem."); return; }
    var leitor = new FileReader();
    leitor.onload = function () {
      var img = new Image();
      img.onload = function () {
        // Reduz no telemóvel: uma foto de 12 MP não ajuda a ler um ecrã e
        // pesa no envio e na conta.
        var esc_ = Math.min(1, LADO_MAX_FOTO / Math.max(img.width, img.height));
        var c = document.createElement("canvas");
        c.width = Math.round(img.width * esc_);
        c.height = Math.round(img.height * esc_);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        var url = c.toDataURL("image/jpeg", 0.85);
        foto = { base64: url.split(",")[1], tipo: "image/jpeg", url: url };
        el.fotoPrev.innerHTML = '<img src="' + url + '" alt="Foto anexada"><button type="button" class="bcm-tirar" aria-label="Tirar foto">✕</button>';
        el.fotoPrev.hidden = false;
      };
      img.onerror = function () { estado("Não consegui abrir essa imagem."); };
      img.src = leitor.result;
    };
    leitor.readAsDataURL(ficheiro);
  }

  function tirarFoto() {
    foto = null;
    el.fotoPrev.innerHTML = "";
    el.fotoPrev.hidden = true;
    el.fotoInput.value = "";
  }

  // ------------------------------------------------------------ perguntar
  function estado(txt) { el.estado.textContent = txt || ""; }

  var ETIQUETAS = {
    notas: ["✅ Das notas da equipa", "bcm-o-notas"],
    web: ["🌐 Da web, com fontes", "bcm-o-web"],
    geral: ["⚠️ Resposta geral, sem fonte — confirma no equipamento", "bcm-o-geral"]
  };

  function mostrarResposta(pergunta, d) {
    var origem = (d.origem || []).map(function (o) {
      var e = ETIQUETAS[o];
      return e ? '<span class="bcm-origem ' + e[1] + '">' + e[0] + "</span>" : "";
    }).join("");
    var notas = (d.notasUsadas || []).length
      ? '<p class="bcm-meta">Notas usadas: ' + d.notasUsadas.map(function (n) { return esc(n.titulo); }).join(", ") +
        ' — abre-as na aba <a href="#" data-bcm-ir="conhecimento">Conhecimento</a>.</p>'
      : "";
    var fontes = (d.fontes || []).length
      ? '<div class="bcm-fontes"><strong>Fontes da web</strong><ol>' + d.fontes.map(function (f) {
          var href = /^https?:\/\//i.test(f.url) ? f.url : "#";
          return '<li><a href="' + esc(href) + '" target="_blank" rel="noopener">' + esc(f.titulo || f.url) + "</a></li>";
        }).join("") + "</ol></div>"
      : "";
    var bloco = document.createElement("div");
    bloco.className = "card bcm-troca";
    bloco.innerHTML =
      '<p class="bcm-pergunta">' + esc(pergunta || "(foto)") + "</p>" +
      '<div class="bcm-origens">' + origem + "</div>" +
      '<div class="bcm-resposta" translate="no">' + render(d.resposta) + "</div>" +
      notas + fontes +
      '<div class="bcm-acoes">' +
        '<button type="button" class="copy" data-bcm-propor>📘 Propor como nota</button>' +
        '<button type="button" class="copy" data-bcm-copiar>Copiar resposta</button>' +
      "</div>" +
      '<div class="bcm-propor" hidden>' +
        '<label>Confirmaste isto no terreno? Onde, e com que equipamento? (opcional)</label>' +
        '<textarea rows="2" maxlength="2000" placeholder="Ex.: confirmado no evento X com A8s e MCTRL4K"></textarea>' +
        '<button type="button" class="copy" data-bcm-enviar>Enviar para revisão</button>' +
        '<span class="bcm-propor-estado"></span>' +
      "</div>";
    bloco._dados = { pergunta: pergunta, resposta: d.resposta, origem: d.origem, fontes: d.fontes };
    el.conversa.appendChild(bloco);
    bloco.scrollIntoView({ behavior: "smooth", block: "start" });
    el.novo.hidden = false;
    atualizarContacto();
  }

  function perguntar() {
    var pergunta = el.texto.value.trim();
    if (!pergunta && !foto) { estado("Escreve a pergunta ou junta uma foto."); el.texto.focus(); return; }
    if (!navigator.onLine) { estado("Sem rede. O Better call Mike precisa de ligação."); return; }
    var corpo = { pergunta: pergunta, historico: historico.slice(-HISTORICO_MAX) };
    if (foto) { corpo.imageBase64 = foto.base64; corpo.imageMediaType = foto.tipo; }
    el.enviar.disabled = true;
    estado("A pensar… (com pesquisa na web pode demorar até um minuto)");
    fetch(enderecoDoWorker() + "/pergunta", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(corpo)
    }).then(function (r) { return r.json(); }).then(function (d) {
      if (!d || !d.ok) { estado((d && (d.motivo || d.error)) || "Não foi possível responder."); return; }
      estado("");
      ultima = { pergunta: pergunta, resposta: d.resposta };
      historico.push({ p: pergunta || "(foto)", r: d.resposta });
      if (historico.length > HISTORICO_MAX) historico.shift();
      mostrarResposta(pergunta, d);
      el.texto.value = "";
      el.texto.placeholder = "Pergunta de seguimento… (ex.: e se o brilho for 30%?)";
      tirarFoto();
    }).catch(function () {
      estado("Não consegui falar com o servidor. Verifica a rede e tenta outra vez.");
    }).then(function () { el.enviar.disabled = false; });
  }

  function novaConversa() {
    historico = [];
    ultima = null;
    el.conversa.innerHTML = "";
    el.novo.hidden = true;
    el.texto.placeholder = el.texto.dataset.placeholderOriginal || "";
    tirarFoto();
    estado("");
    atualizarContacto();
    el.texto.focus();
  }

  function propor(bloco) {
    var caixa = bloco.querySelector(".bcm-propor");
    var st = bloco.querySelector(".bcm-propor-estado");
    var botao = bloco.querySelector("[data-bcm-enviar]");
    var d = bloco._dados;
    botao.disabled = true;
    st.textContent = "A enviar…";
    fetch(enderecoDoWorker() + "/pergunta/propor", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pergunta: d.pergunta, resposta: d.resposta, origem: d.origem, fontes: d.fontes,
        comentario: caixa.querySelector("textarea").value.trim() })
    }).then(function (r) { return r.json(); }).then(function (r) {
      if (r && r.ok) {
        caixa.innerHTML = '<p class="bcm-ok">Enviado para revisão. Fica nota oficial depois de confirmada.</p>';
        bloco.querySelector("[data-bcm-propor]").disabled = true;
      } else {
        st.textContent = (r && r.motivo) || "Não foi possível enviar.";
        botao.disabled = false;
      }
    }).catch(function () { st.textContent = "Sem ligação. Tenta outra vez."; botao.disabled = false; });
  }

  function copiar(bloco, botao) {
    var t = bloco._dados.resposta;
    var ok = function () { botao.textContent = "Copiado ✓"; setTimeout(function () { botao.textContent = "Copiar resposta"; }, 1500); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(ok, function () {});
  }

  // ------------------------------------------------------- ligar ao Mike
  function numeroLimpo() { return MIKE_TELEFONE.replace(/[^\d+]/g, ""); }

  function atualizarContacto() {
    if (!el.contacto) return;
    var n = numeroLimpo();
    if (!n) { el.contacto.hidden = true; return; }
    el.contacto.hidden = false;
    var codigo = codigoDaApp();
    el.codigo.textContent = codigo;
    el.ligar.href = "tel:" + n;
    var msg = "Better call Mike · " + codigo + "\n";
    if (ultima) {
      msg += "\nPergunta: " + (ultima.pergunta || "(foto)") + "\n\nResposta da app (resumo):\n" + ultima.resposta.slice(0, 600);
      if (ultima.resposta.length > 600) msg += "…";
    } else {
      msg += "\nPreciso de ajuda com: ";
    }
    el.whatsapp.href = "https://wa.me/" + n.replace(/^\+/, "") + "?text=" + encodeURIComponent(msg);
  }

  // ------------------------------------------------------------- arranque
  function ligar() {
    el.texto = $("bcm-texto");
    if (!el.texto) return;
    el.enviar = $("bcm-enviar");
    el.estado = $("bcm-estado");
    el.conversa = $("bcm-conversa");
    el.novo = $("bcm-novo");
    el.fotoInput = $("bcm-foto");
    el.fotoPrev = $("bcm-foto-prev");
    el.contacto = $("bcm-contacto");
    el.ligar = $("bcm-ligar");
    el.whatsapp = $("bcm-whatsapp");
    el.codigo = $("bcm-codigo");
    el.texto.dataset.placeholderOriginal = el.texto.placeholder;

    el.enviar.addEventListener("click", perguntar);
    el.texto.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); perguntar(); }
    });
    el.novo.addEventListener("click", novaConversa);
    el.fotoInput.addEventListener("change", function () { lerFoto(el.fotoInput.files && el.fotoInput.files[0]); });
    el.fotoPrev.addEventListener("click", function (e) { if (e.target.closest(".bcm-tirar")) tirarFoto(); });
    el.conversa.addEventListener("click", function (e) {
      var bloco = e.target.closest(".bcm-troca");
      if (!bloco) return;
      if (e.target.closest("[data-bcm-propor]")) {
        var caixa = bloco.querySelector(".bcm-propor");
        caixa.hidden = !caixa.hidden;
        if (!caixa.hidden) caixa.querySelector("textarea").focus();
      } else if (e.target.closest("[data-bcm-enviar]")) {
        propor(bloco);
      } else if (e.target.closest("[data-bcm-copiar]")) {
        copiar(bloco, e.target.closest("[data-bcm-copiar]"));
      } else if (e.target.closest("[data-bcm-ir]")) {
        e.preventDefault();
        var aba = document.querySelector('.tab[data-mode="' + e.target.closest("[data-bcm-ir]").dataset.bcmIr + '"]');
        if (aba) aba.click();
      }
    });
    atualizarContacto();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", ligar);
  else ligar();
})();
