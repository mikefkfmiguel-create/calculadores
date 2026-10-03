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
  var MIKE_TELEFONE = "+351910213260";

  var URL_WORKER_CHAVE = "calculadores-assistente-worker-url";
  var URL_WORKER_OMISSAO = "https://calculadores-assistente.avkvideoshare.workers.dev";
  var CODIGO_CHAVE = "bcm-codigo-v1";
  var NOME_CHAVE = "bcm-nome-v1";
  // Trocas que seguem para a IA como conversa. Tem de bater com o
  // HISTORICO_MAX do Worker (worker/src/pergunta.js), que corta o resto.
  var HISTORICO_MAX = 8;
  // A conversa fica guardada NESTE aparelho (só texto, sem fotos nem PDFs),
  // para quem fecha a app a meio de responder às perguntas a encontrar lá.
  var CONVERSA_CHAVE = "bcm-conversa-v1";
  var CONVERSA_VALIDADE_MS = 7 * 24 * 60 * 60 * 1000;
  var TROCAS_GUARDADAS = 10;
  // CADA CASO É ÚNICO. Uma conversa = um caso, com id próprio. Ao levar um
  // caso para os cálculos/3D pela primeira vez, as duas apps são limpas a
  // fundo antes (js/limpeza.js): nada do caso anterior -- um pano, um DSM,
  // um projetor, o nome do projeto -- vem colado atrás. Levar o MESMO caso
  // outra vez (ex.: primeiro Ecrã LED, depois Preview) não limpa.
  // Pedido do mike, depois de um 3D abrir com o "HR Excellence Awards 2024"
  // e um pano de outro dia: *"cada caso seja único e tenha reset do que
  // possa trazer de outro atrás"*.
  var CASO_LEVADO_CHAVE = "bcm-caso-levado-v1"; // prefixo bcm-: a limpeza não lhe toca
  // Isto não é do caso anterior, é da pessoa: fica.
  var MANTER_NO_CASO_NOVO = ["calculadores-historico-v1", "mikeapps-meus-modelos-v1", "calc-relatorio-modo"];
  var caso = null;
  var LADO_MAX_FOTO = 1600;

  var historico = []; // [{p, r}] desta sessão, para perguntas de seguimento
  // O que a PESSOA escreveu/anexou nesta conversa, por ordem. É só isto que
  // segue para os cálculos -- nunca a resposta da IA, que aconselha e pode
  // propor medidas que ninguém pediu (a regra da casa: a IA extrai o que o
  // pedido diz, a conta é feita na app).
  var entradas = []; // [{texto, ficheiro}]
  var ultima = null;  // a última resposta mostrada (para propor como nota)
  var trocas = [];    // [{pergunta, d}] o que está no ecrã, para repor
  var foto = null;    // {base64, tipo, url}
  var anexo = null;   // {nome, pdfBase64} ou {nome, texto}
  var PDF_MAX_BYTES = 10 * 1024 * 1024;
  var TEXTO_MAX = 30000;
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

  function nomeAtual() {
    return (el.nome && el.nome.value || "").replace(/\s+/g, " ").trim().slice(0, 60);
  }

  function identificacao() {
    var n = nomeAtual();
    return (n ? n + " · " : "") + codigoDaApp();
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
        foto = { base64: url.split(",")[1], tipo: "image/jpeg", url: url, ficheiro: ficheiro };
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
    if (el.galeria) el.galeria.value = "";
  }

  // --------------------------------------------- anexo (PDF ou texto)
  //
  // Um PDF vai inteiro (a IA lê-o como documento); um .txt/.md/.eml vai
  // como texto. O anexo só segue com a pergunta em que foi juntado -- nas de
  // seguimento já não, para não se pagar o mesmo documento várias vezes; a
  // resposta anterior vai no histórico.
  function lerAnexo(ficheiro) {
    if (!ficheiro) return;
    var ehPdf = ficheiro.type === "application/pdf" || /\.pdf$/i.test(ficheiro.name);
    var leitor = new FileReader();
    if (ehPdf) {
      if (ficheiro.size > PDF_MAX_BYTES) { estado("PDF demasiado grande (máx. 10 MB)."); return; }
      leitor.onload = function () {
        anexo = { nome: ficheiro.name, pdfBase64: String(leitor.result).split(",")[1], ficheiro: ficheiro };
        mostrarAnexo("📄 " + ficheiro.name);
      };
      leitor.readAsDataURL(ficheiro);
    } else {
      leitor.onload = function () {
        var t = String(leitor.result || "");
        // Um .eml traz cabeçalhos técnicos em cima; fica o que vem depois
        // da primeira linha em branco, que é onde começa a mensagem.
        if (/\.eml$/i.test(ficheiro.name)) {
          var assunto = (/^Subject:\s*(.*)$/im.exec(t) || [])[1];
          var corpo = t.split(/\r?\n\r?\n/).slice(1).join("\n\n");
          t = (assunto ? "Assunto: " + assunto + "\n\n" : "") + corpo;
        }
        t = t.trim();
        if (!t) { estado("Esse ficheiro está vazio."); return; }
        var cortado = t.length > TEXTO_MAX;
        anexo = { nome: ficheiro.name, texto: t.slice(0, TEXTO_MAX) };
        mostrarAnexo("📝 " + ficheiro.name + (cortado ? " (só o início)" : ""));
      };
      leitor.readAsText(ficheiro);
    }
  }

  function mostrarAnexo(rotulo) {
    el.anexo.innerHTML = '<span class="bcm-anexo-nome">' + esc(rotulo) + '</span><button type="button" class="bcm-anexo-tirar" aria-label="Tirar anexo">✕</button>';
    el.anexo.hidden = false;
    estado("");
  }

  function tirarAnexo() {
    anexo = null;
    el.anexo.innerHTML = "";
    el.anexo.hidden = true;
    el.ficheiro.value = "";
  }

  // ------------------------------------------------------------ perguntar
  function estado(txt) { el.estado.textContent = txt || ""; }

  // O corredor e as frases que vão mudando enquanto o Worker trabalha. As
  // frases descrevem o que pode estar a acontecer, por esta ordem; não são
  // um relatório do que o Worker fez (isso vem na origem da resposta).
  var FRASES = [
    "A ler as notas da equipa…",
    "A procurar na web…",
    "A confirmar nas fontes…",
    "A juntar a resposta…",
    "Quase… as pesquisas na web demoram um pouco."
  ];
  var relogioFrases = null;

  function aProcurar(sim) {
    clearInterval(relogioFrases);
    el.loader.hidden = !sim;
    if (!sim) return;
    var i = 0;
    el.loaderTexto.textContent = FRASES[0];
    relogioFrases = setInterval(function () {
      i = Math.min(i + 1, FRASES.length - 1);
      el.loaderTexto.textContent = FRASES[i];
      if (i === FRASES.length - 1) clearInterval(relogioFrases);
    }, 4000);
  }

  var ETIQUETAS = {
    notas: ["✅ Das notas da equipa", "bcm-o-notas"],
    stock: ["📦 Com o nosso inventário", "bcm-o-stock"],
    web: ["🌐 Da web, com fontes", "bcm-o-web"],
    geral: ["⚠️ Resposta geral, sem fonte — confirma no equipamento", "bcm-o-geral"]
  };

  // ------------------------------------------------ continuar a conversa
  //
  // Quando a IA pede mais informação, a resposta acaba com perguntas
  // numeradas ("1. As medidas são em metros?"). A caixa de responder fica
  // logo por baixo da ÚLTIMA resposta -- a caixa de cima ficava fora do
  // ecrã e parecia que a conversa acabava ali. Cada pergunta numerada ganha
  // o seu campo curto; o que se escreve segue como uma mensagem só.
  function perguntasDaResposta(md) {
    var out = [];
    String(md || "").split(/\n/).forEach(function (linha) {
      var m = /^\s*(\d{1,2})[.)]\s+(.+)$/.exec(linha);
      if (!m || m[2].indexOf("?") < 0) return;
      var t = m[2].replace(/\*\*|__|`/g, "").replace(/\s+/g, " ").trim();
      if (t.length > 160) t = t.slice(0, 157) + "…";
      out.push({ n: m[1], texto: t });
    });
    return out.slice(0, 6);
  }

  function caixaDeSeguir(resposta) {
    var qs = perguntasDaResposta(resposta);
    var campos = qs.map(function (q, i) {
      return '<label class="bcm-seguir-q"><span>' + esc(q.n + ". " + q.texto) + "</span>" +
        '<input type="text" maxlength="500" data-bcm-q="' + i + '" placeholder="A tua resposta"></label>';
    }).join("");
    var div = document.createElement("div");
    div.className = "bcm-seguir";
    div._perguntas = qs;
    div.innerHTML =
      '<p class="bcm-seguir-titulo">' + (qs.length ? "Responde ao que falta" : "Continuar a conversa") + "</p>" +
      campos +
      '<textarea rows="2" maxlength="20000" placeholder="' +
        (qs.length ? "Mais alguma coisa? (opcional)" : "Responde ou pergunta mais… (ex.: e se for exterior?)") + '"></textarea>' +
      '<div class="bcm-barra">' +
        '<button type="button" class="copy bcm-enviar" data-bcm-responder>Enviar resposta</button>' +
        '<button type="button" class="copy" data-bcm-nova>Nova conversa</button>' +
      "</div>" +
      '<p class="bcm-dica">Para juntar uma foto ou um PDF, usa a caixa lá em cima: segue com esta resposta.</p>';
    return div;
  }

  function textoDaCaixa(caixa) {
    var partes = [];
    (caixa._perguntas || []).forEach(function (q, i) {
      var c = caixa.querySelector('[data-bcm-q="' + i + '"]');
      var v = c ? c.value.trim() : "";
      if (v) partes.push(q.n + ". " + q.texto + " → " + v);
    });
    var livre = caixa.querySelector("textarea").value.trim();
    if (livre) partes.push(livre);
    return partes.join("\n");
  }

  function responderNaCaixa(caixa) {
    var t = textoDaCaixa(caixa);
    if (!t && !foto && !anexo) {
      colocarEstado(caixa);
      estado("Escreve pelo menos uma resposta.");
      var primeiro = caixa.querySelector("input, textarea");
      if (primeiro) primeiro.focus();
      return;
    }
    perguntar({ texto: t, caixa: caixa });
  }

  // O corredor e a linha de estado mudam-se para junto de quem perguntou:
  // a responder lá em baixo, não se vê o que acontece lá em cima.
  function colocarEstado(caixa) {
    if (caixa) {
      caixa.appendChild(el.loader);
      caixa.appendChild(el.estado);
    } else if (el.estadoCasa) {
      el.estadoCasa.insertBefore(el.estado, el.estadoDepois);
      el.estadoCasa.insertBefore(el.loader, el.estado);
    }
  }

  // Os modelos que a pessoa acrescentou à lista na app (js/meus-modelos.js):
  // fazem parte do que "a calculadora já conhece" neste aparelho.
  function meusModelos() {
    var out = [];
    try {
      var todos = JSON.parse(localStorage.getItem("mikeapps-meus-modelos-v1") || "{}");
      Object.keys(todos).forEach(function (tipo) {
        (Array.isArray(todos[tipo]) ? todos[tipo] : []).forEach(function (m) {
          if (!m || typeof m.modelo !== "string") return;
          var resumo = [m.diag ? m.diag + '"' : "", m.ratio || ""].filter(Boolean).join(" ");
          out.push({ tipo: tipo, modelo: m.modelo, resumo: resumo });
        });
      });
    } catch (_) {}
    return out.slice(0, 40);
  }

  // ------------------------------------------- guardar neste aparelho
  function guardarConversa() {
    var dados = {
      quando: Date.now(),
      caso: caso,
      historico: historico,
      entradas: entradas.map(function (e) { return { texto: e.texto }; }),
      trocas: trocas.slice(-TROCAS_GUARDADAS)
    };
    try { localStorage.setItem(CONVERSA_CHAVE, JSON.stringify(dados)); }
    catch (_) {
      // Cheio: fica só a última troca no ecrã; o histórico para a IA mantém-se.
      try { dados.trocas = trocas.slice(-1); localStorage.setItem(CONVERSA_CHAVE, JSON.stringify(dados)); } catch (__) {}
    }
  }

  function apagarConversaGuardada() {
    try { localStorage.removeItem(CONVERSA_CHAVE); } catch (_) {}
  }

  function reporConversa() {
    var g = null;
    try { g = JSON.parse(localStorage.getItem(CONVERSA_CHAVE) || "null"); } catch (_) {}
    if (!g || !Array.isArray(g.trocas) || !g.trocas.length) return;
    if (Date.now() - (g.quando || 0) > CONVERSA_VALIDADE_MS) { apagarConversaGuardada(); return; }
    caso = typeof g.caso === "string" ? g.caso : novoCaso();
    historico = Array.isArray(g.historico) ? g.historico.slice(-HISTORICO_MAX) : [];
    entradas = Array.isArray(g.entradas) ? g.entradas.map(function (e) { return { texto: String(e && e.texto || ""), ficheiro: null }; }) : [];
    g.trocas.forEach(function (t) {
      if (t && t.d && typeof t.d.resposta === "string") mostrarResposta(t.pergunta, t.d, true);
    });
    el.texto.placeholder = "Pergunta de seguimento… (ex.: e se o brilho for 30%?)";
  }

  function mostrarResposta(pergunta, d, aRepor) {
    var origem = (d.origem || []).map(function (o) {
      var e = ETIQUETAS[o];
      return e ? '<span class="bcm-origem ' + e[1] + '">' + e[0] + "</span>" : "";
    }).join("");
    var notas = (d.notasUsadas || []).length
      ? '<p class="bcm-meta">Notas usadas: ' + d.notasUsadas.map(function (n) { return esc(n.titulo); }).join(", ") +
        ' — abre-as na aba <a href="#" data-bcm-ir="conhecimento">Conhecimento</a>.</p>'
      : "";
    // O equipamento da lista da app que a resposta nomeia (verificado no
    // Worker): nosso ou só de mercado, como as etiquetas da calculadora.
    var equipamento = (d.equipamento || []).length
      ? '<p class="bcm-meta">Equipamento da lista: ' + d.equipamento.map(function (m) {
          return esc(m.nome) + (m.avk ? " <b>(nosso)</b>" : " <i>(mercado)</i>");
        }).join(", ") + "</p>"
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
      notas + equipamento + fontes +
      '<div class="bcm-seguir-sitio"></div>' +
      '<div class="bcm-acoes">' +
        '<button type="button" class="copy" data-bcm-propor>📘 Propor como nota</button>' +
        '<button type="button" class="copy" data-bcm-copiar>Copiar resposta</button>' +

      "</div>" +
      '<div class="bcm-levar">' +
        '<span class="bcm-levar-titulo">Levar este projeto para:</span>' +
        '<div class="bcm-levar-opcoes">' +
          '<button type="button" class="bcm-opcao" data-bcm-levar="calculos"><span class="bcm-opcao-ic">📐</span>Cálculos</button>' +
          '<button type="button" class="bcm-opcao" data-bcm-levar="led"><span class="bcm-opcao-ic">💡</span>Ecrã LED</button>' +
          '<button type="button" class="bcm-opcao" data-bcm-levar="projecao"><span class="bcm-opcao-ic">📽</span>Projeção</button>' +
          '<button type="button" class="bcm-opcao" data-bcm-levar="preview"><span class="bcm-opcao-ic">🧊</span>Preview 3D</button>' +
        '</div>' +
      '</div>' +
      '<div class="bcm-propor" hidden>' +
        '<label>Confirmaste isto no terreno? Onde, e com que equipamento? (opcional)</label>' +
        '<textarea rows="2" maxlength="2000" placeholder="Ex.: confirmado no evento X com A8s e MCTRL4K"></textarea>' +
        '<button type="button" class="copy" data-bcm-enviar>Enviar para revisão</button>' +
        '<span class="bcm-propor-estado"></span>' +
      "</div>";
    bloco._dados = { pergunta: pergunta, resposta: d.resposta, origem: d.origem, fontes: d.fontes };
    // Só a última resposta tem a caixa de responder.
    colocarEstado(null);
    Array.prototype.forEach.call(el.conversa.querySelectorAll(".bcm-seguir"), function (c) { c.remove(); });
    bloco.querySelector(".bcm-seguir-sitio").appendChild(caixaDeSeguir(d.resposta));
    el.conversa.appendChild(bloco);
    trocas.push({ pergunta: pergunta, d: { resposta: d.resposta, origem: d.origem, notasUsadas: d.notasUsadas, fontes: d.fontes, equipamento: d.equipamento } });
    if (trocas.length > TROCAS_GUARDADAS) trocas.shift();
    ultima = { pergunta: pergunta, resposta: d.resposta };
    if (!aRepor) bloco.scrollIntoView({ behavior: "smooth", block: "start" });
    el.novo.hidden = false;
    atualizarContacto();
  }

  // Sem argumento: a caixa de cima. Com {texto, caixa}: a resposta escrita
  // na caixa por baixo da última resposta.
  function perguntar(daCaixa) {
    var caixa = daCaixa && daCaixa.caixa || null;
    colocarEstado(caixa);
    var pergunta = caixa ? daCaixa.texto : el.texto.value.trim();
    // O nome é pedido uma vez e fica neste aparelho: serve para a resposta
    // tratar a pessoa pelo nome e para o Mike saber quem pergunta/liga.
    if (!nomeAtual()) { colocarEstado(null); estado("Escreve primeiro o teu nome."); el.nome.focus(); return; }
    if (!pergunta && !foto && !anexo) { estado("Escreve a pergunta ou junta uma foto, um PDF ou um texto."); el.texto.focus(); return; }
    if (!navigator.onLine) { estado("Sem rede. O Better call Mike precisa de ligação."); return; }
    if (!caso) caso = novoCaso();
    var corpo = { pergunta: pergunta, nome: nomeAtual(), historico: historico.slice(-HISTORICO_MAX), meusModelos: meusModelos() };
    if (foto) { corpo.imageBase64 = foto.base64; corpo.imageMediaType = foto.tipo; }
    if (anexo) {
      corpo.anexoNome = anexo.nome;
      if (anexo.pdfBase64) corpo.pdfBase64 = anexo.pdfBase64;
      if (anexo.texto) corpo.anexoTexto = anexo.texto;
    }
    var rotuloPergunta = pergunta || (anexo ? "Resumo de " + anexo.nome : "(foto)");
    var entrada = {
      texto: [pergunta, anexo && anexo.texto ? anexo.texto : ""].filter(Boolean).join("\n\n"),
      ficheiro: (anexo && anexo.ficheiro) || (foto && foto.ficheiro) || null
    };
    var botaoCaixa = caixa && caixa.querySelector("[data-bcm-responder]");
    el.enviar.disabled = true;
    if (botaoCaixa) botaoCaixa.disabled = true;
    estado("");
    aProcurar(true);
    fetch(enderecoDoWorker() + "/pergunta", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(corpo)
    }).then(function (r) { return r.json(); }).then(function (d) {
      if (!d || !d.ok) { estado((d && (d.motivo || d.error)) || "Não foi possível responder."); return; }
      estado("");
      entradas.push(entrada);
      historico.push({ p: rotuloPergunta, r: d.resposta });
      if (historico.length > HISTORICO_MAX) historico.shift();
      mostrarResposta(rotuloPergunta, d);
      guardarConversa();
      if (!caixa) el.texto.value = "";
      tirarAnexo();
      el.texto.placeholder = "Pergunta de seguimento… (ex.: e se o brilho for 30%?)";
      tirarFoto();
    }).catch(function () {
      estado("Não consegui falar com o servidor. Verifica a rede e tenta outra vez.");
    }).then(function () {
      el.enviar.disabled = false;
      if (botaoCaixa) botaoCaixa.disabled = false;
      aProcurar(false);
    });
  }

  function novoCaso() {
    var b = new Uint8Array(6);
    (window.crypto || window.msCrypto).getRandomValues(b);
    return "caso-" + Date.now().toString(36) + "-" + Array.prototype.map.call(b, function (x) { return x.toString(16); }).join("");
  }

  function casoJaLevado() {
    try { return !!caso && localStorage.getItem(CASO_LEVADO_CHAVE) === caso; } catch (_) { return false; }
  }

  // Limpa as duas apps (partilham localStorage) e marca este caso como o que
  // está nos cálculos. Devolve false se a pessoa desistiu.
  function limparParaCasoNovo() {
    if (!window.mikeappsLimpeza) return true;
    if (typeof window.mikeappsPorGuardar === "function" && window.mikeappsPorGuardar()) {
      if (!confirm("Caso novo.\n\nO projeto que está agora nas calculadoras e no 3D tem alterações por guardar e vai ser limpo, para nada passar para este caso.\n\nContinuar?")) return false;
    }
    if (typeof window.mikeappsEsquecerPorGuardar === "function") window.mikeappsEsquecerPorGuardar();
    window.mikeappsLimpeza.limpezaProfunda({ manterTambem: MANTER_NO_CASO_NOVO });
    try { localStorage.setItem(CASO_LEVADO_CHAVE, caso); } catch (_) {}
    return true;
  }

  function novaConversa() {
    colocarEstado(null);
    caso = null;
    historico = [];
    entradas = [];
    trocas = [];
    ultima = null;
    apagarConversaGuardada();
    el.conversa.innerHTML = "";
    el.novo.hidden = true;
    el.texto.placeholder = el.texto.dataset.placeholderOriginal || "";
    tirarFoto();
    tirarAnexo();
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
      body: JSON.stringify({ nome: nomeAtual(), pergunta: d.pergunta, resposta: d.resposta, origem: d.origem, fontes: d.fontes,
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

  // ------------------------------------------------- levar para os cálculos
  //
  // Passa o pedido para a aba de cálculos (o antigo Assistente de Projeto),
  // que extrai os requisitos, sugere as opções de tamanho e aplica às
  // calculadoras. Reaproveita-a tal como está: o texto e o ficheiro entram
  // nos campos dela e carrega-se em "Analisar".
  //
  // Os destinos:
  //   calculos  -- fica nos resultados (medidas lidas, opções, Aplicar);
  //   led/projecao -- aplica a sugestão de tamanho (ou as medidas lidas, se
  //               o pedido as der) na calculadora certa;
  //   preview   -- abre o Preview 3D com um ecrã desse tamanho.
  // Sem tamanho nenhum (nem sugerido nem lido) fica nos resultados, a dizer
  // o que falta -- nunca se inventa uma medida para poder seguir.
  function levarParaCalculos(destino) {
    var texto = entradas.map(function (e) { return e.texto; }).filter(Boolean).join("\n\n").slice(0, 20000);
    var ficheiro = null;
    for (var i = entradas.length - 1; i >= 0 && !ficheiro; i--) ficheiro = entradas[i].ficheiro;
    if (!texto && !ficheiro) { estado("Não há pedido para levar para os cálculos."); return; }
    if (!caso) caso = novoCaso();
    var casoNovo = !casoJaLevado();

    // NA APP SEPARADA (mike/) não há cálculos nesta página: o pedido fica
    // guardado neste aparelho e abre-se a app completa, que o vai buscar
    // (ver receberDaApp). Mesma origem, por isso o mesmo armazenamento.
    if (!$("asst-text")) {
      if (casoNovo && !limparParaCasoNovo()) return;
      estado(casoNovo ? "Caso novo: a limpar o anterior e a abrir os cálculos…" : "A abrir os cálculos…");
      guardarPassagem({ destino: destino, texto: texto, ficheiro: ficheiro, quando: Date.now(), daApp: "mike" }).then(function () {
        location.href = (document.body.dataset.calculadoras || "../") + "#levar=" + encodeURIComponent(destino);
      }, function () {
        estado("Não consegui passar o pedido para os cálculos neste browser.");
      });
      return;
    }

    // NA APP COMPLETA, CASO NOVO: o que está em memória nesta página (campos,
    // zonas, projetor) também é do caso anterior, e voltava a ser gravado ao
    // primeiro toque. Limpa-se, guarda-se o pedido como na app separada e
    // recarrega-se -- a mesma decisão do "Limpar tudo" -- e receberDaApp()
    // segue com ele numa página que nasce vazia.
    if (casoNovo) {
      if (!limparParaCasoNovo()) return;
      estado("Caso novo: a limpar o anterior…");
      guardarPassagem({ destino: destino, texto: texto, ficheiro: ficheiro, quando: Date.now(), daApp: "completa" }).then(function () {
        history.replaceState(null, "", location.pathname + location.search + "#levar=" + encodeURIComponent(destino));
        location.reload();
      }, function () {
        estado("Não consegui passar o pedido depois de limpar. Volta a tocar no destino.");
      });
      return;
    }

    // A janela do 3D abre-se JÁ, no toque: depois da análise o telemóvel já
    // não a deixaria abrir. Fica em branco até haver endereço.
    var janela3d = null;
    if (destino === "preview") {
      try { janela3d = window.open("", "mikeapps-preview"); } catch (_) {}
    }
    executarNosCalculos(destino, texto, ficheiro, janela3d, false);
  }

  function executarNosCalculos(destino, texto, ficheiro, janela3d, veioDaApp) {
    var campo = $("asst-text"), input = $("asst-pdf"), analisar = $("asst-analyze");
    var aba = document.querySelector('.tab[data-mode="assistente"]');
    if (!campo || !input || !analisar || !aba) return;

    campo.value = texto;
    campo.dispatchEvent(new Event("input", { bubbles: true }));
    input.value = "";
    if (ficheiro) {
      try {
        var dt = new DataTransfer();
        dt.items.add(ficheiro);
        input.files = dt.files;
      } catch (_) { /* browser sem DataTransfer: segue só o texto */ }
      input.dispatchEvent(new Event("change", { bubbles: true }));
    }
    if (typeof window.mostrarMenu === "function") window.mostrarMenu(false);
    aba.click();
    window.scrollTo(0, 0);
    setTimeout(function () {
      analisar.click();
      var cartao = $("asst-results-card"), estadoAsst = $("asst-status"), voltas = 0;
      var vigia = setInterval(function () {
        voltas++;
        if (cartao && cartao.style.display === "block") {
          clearInterval(vigia);
          seguirPara(destino, janela3d, veioDaApp);
        } else if (voltas > 240 || (estadoAsst && /^Erro/.test(estadoAsst.textContent))) {
          clearInterval(vigia);
          if (janela3d) { try { janela3d.close(); } catch (_) {} }
          if (estadoAsst) estadoAsst.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }, 250);
    }, 300);
  }

  // ------------------------------------- passagem entre a app e os cálculos
  //
  // IndexedDB e não localStorage: um PDF ou uma foto não cabem nos ~5 MB de
  // texto do localStorage, e aqui guardam-se como ficheiro. Fica uma só
  // passagem pendente, apagada assim que os cálculos a leem.
  var PASSAGEM_DB = "mikeapps-bcm", PASSAGEM_STORE = "passagem", PASSAGEM_VALIDADE_MS = 10 * 60 * 1000;

  function abrirDb() {
    return new Promise(function (ok, falha) {
      if (!window.indexedDB) { falha(new Error("sem IndexedDB")); return; }
      var r = indexedDB.open(PASSAGEM_DB, 1);
      r.onupgradeneeded = function () { r.result.createObjectStore(PASSAGEM_STORE); };
      r.onsuccess = function () { ok(r.result); };
      r.onerror = function () { falha(r.error); };
    });
  }

  function guardarPassagem(dados) {
    return abrirDb().then(function (db) {
      return new Promise(function (ok, falha) {
        var tx = db.transaction(PASSAGEM_STORE, "readwrite");
        tx.objectStore(PASSAGEM_STORE).put(dados, "pendente");
        tx.oncomplete = function () { db.close(); ok(); };
        tx.onerror = function () { db.close(); falha(tx.error); };
      });
    });
  }

  function tirarPassagem() {
    return abrirDb().then(function (db) {
      return new Promise(function (ok, falha) {
        var tx = db.transaction(PASSAGEM_STORE, "readwrite");
        var st = tx.objectStore(PASSAGEM_STORE);
        var g = st.get("pendente");
        var dados = null;
        g.onsuccess = function () { dados = g.result || null; st.delete("pendente"); };
        tx.oncomplete = function () { db.close(); ok(dados); };
        tx.onerror = function () { db.close(); falha(tx.error); };
      });
    });
  }

  // Nos cálculos: chegou "#levar=<destino>" da app separada.
  function receberDaApp() {
    var m = /^#levar=(calculos|led|projecao|preview)$/.exec(location.hash);
    if (!m || !$("asst-text")) return;
    var destino = m[1];
    history.replaceState(null, "", location.pathname + location.search);
    tirarPassagem().then(function (dados) {
      if (!dados || Date.now() - (dados.quando || 0) > PASSAGEM_VALIDADE_MS) return;
      // Só a app separada é que tem para onde "voltar"; um caso novo dentro
      // da app completa recarrega-se a si mesma e o Voltar fica cá.
      if (dados.daApp !== "completa") {
        try { sessionStorage.setItem("bcm-veio-da-app", "1"); } catch (_) {}
      }
      var f = dados.ficheiro || null;
      if (f && !(f instanceof File)) {
        try { f = new File([f], f.name || "anexo", { type: f.type || "" }); } catch (_) {}
      }
      executarNosCalculos(destino, dados.texto || "", f, null, true);
    }, function () {});
  }

  function num(id) {
    var e = $(id);
    var v = e ? parseFloat(String(e.value).replace(",", ".")) : NaN;
    return isFinite(v) && v > 0 ? v : null;
  }

  function avisoNosResultados(txt) {
    var st = $("asst-status");
    if (st) st.textContent = txt;
    var cartao = $("asst-results-card");
    if (cartao) cartao.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function seguirPara(destino, janela3d, veioDaApp) {
    var cartao = $("asst-results-card");
    var sugerido = typeof window.mikeappsTamanhoSugerido === "function" ? window.mikeappsTamanhoSugerido() : null;
    var lido = (num("asst-largura") && num("asst-altura")) ? { largura: num("asst-largura"), altura: num("asst-altura") } : null;

    if (destino === "calculos") {
      if (cartao) cartao.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }

    if (destino === "preview") {
      var t = lido || sugerido;
      if (!t || typeof window.mikeappsUrlPreviewDeEcra !== "function") {
        if (janela3d) { try { janela3d.close(); } catch (_) {} }
        avisoNosResultados("Para o 3D falta um tamanho de ecrã: o pedido não diz as medidas nem a distância do público. Completa os valores abaixo e usa \"Ver em 3D ↗\".");
        return;
      }
      var url = window.mikeappsUrlPreviewDeEcra(t.largura, t.altura);
      if (janela3d && !janela3d.closed) janela3d.location.href = url;
      // Vindo da app separada não houve toque nesta página: uma janela nova
      // seria bloqueada, por isso o Preview abre aqui mesmo.
      else if (veioDaApp) { location.href = url; return; }
      else window.open(url, "mikeapps-preview");
      if (cartao) cartao.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }

    // led / projecao
    var tipo = destino === "led" ? "led" : "projecao";
    if (!lido && sugerido) {
      var botao = $(tipo === "led" ? "asst-rec-use-led" : "asst-rec-use-proj");
      if (botao) { botao.click(); return; }
    }
    if (lido || num("asst-diagonal")) {
      var sel = $("asst-tipoecra");
      if (sel && sel.value !== tipo) { sel.value = tipo; sel.dispatchEvent(new Event("change", { bubbles: true })); }
      var aplicar = $("asst-apply");
      if (aplicar) { aplicar.click(); return; }
    }
    avisoNosResultados("Falta um tamanho de ecrã para aplicar: o pedido não diz as medidas nem a distância do público. Completa os valores abaixo e carrega em \"Aplicar à calculadora\".");
  }

  // ------------------------------------------------------- ligar ao Mike
  function numeroLimpo() { return MIKE_TELEFONE.replace(/[^\d+]/g, ""); }

  function atualizarContacto() {
    if (!el.contacto) return;
    var n = numeroLimpo();
    if (!n) { el.contacto.hidden = true; return; }
    el.contacto.hidden = false;
    var id = identificacao();
    el.codigo.textContent = id;
    el.ligar.href = "tel:" + n;
    var msg = "Better call Mike · " + id + "\n";
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
    el.loader = $("bcm-loader");
    el.loaderTexto = $("bcm-loader-texto");
    el.estadoCasa = el.estado.parentNode;
    el.estadoDepois = el.estado.nextSibling;
    el.conversa = $("bcm-conversa");
    el.novo = $("bcm-novo");
    el.fotoInput = $("bcm-foto");
    el.fotoPrev = $("bcm-foto-prev");
    el.ficheiro = $("bcm-ficheiro");
    el.anexo = $("bcm-anexo");
    el.ficheiro.addEventListener("change", function () { lerAnexo(el.ficheiro.files && el.ficheiro.files[0]); });
    el.anexo.addEventListener("click", function (e) { if (e.target.closest(".bcm-anexo-tirar")) tirarAnexo(); });
    el.contacto = $("bcm-contacto");
    el.ligar = $("bcm-ligar");
    el.whatsapp = $("bcm-whatsapp");
    el.codigo = $("bcm-codigo");
    el.nome = $("bcm-nome");
    try { el.nome.value = localStorage.getItem(NOME_CHAVE) || ""; } catch (_) {}
    el.nome.addEventListener("input", function () {
      try { localStorage.setItem(NOME_CHAVE, nomeAtual()); } catch (_) {}
      atualizarContacto();
    });
    el.texto.dataset.placeholderOriginal = el.texto.placeholder;

    el.enviar.addEventListener("click", perguntar);
    el.texto.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); perguntar(); }
    });
    el.novo.addEventListener("click", novaConversa);
    el.fotoInput.addEventListener("change", function () { lerFoto(el.fotoInput.files && el.fotoInput.files[0]); });
    el.galeria = $("bcm-galeria");
    el.galeria.addEventListener("change", function () { lerFoto(el.galeria.files && el.galeria.files[0]); });
    el.fotoPrev.addEventListener("click", function (e) { if (e.target.closest(".bcm-tirar")) tirarFoto(); });
    el.conversa.addEventListener("click", function (e) {
      var bloco = e.target.closest(".bcm-troca");
      if (!bloco) return;
      if (e.target.closest("[data-bcm-responder]")) {
        responderNaCaixa(e.target.closest(".bcm-seguir"));
      } else if (e.target.closest("[data-bcm-nova]")) {
        novaConversa();
      } else if (e.target.closest("[data-bcm-propor]")) {
        var caixa = bloco.querySelector(".bcm-propor");
        caixa.hidden = !caixa.hidden;
        if (!caixa.hidden) caixa.querySelector("textarea").focus();
      } else if (e.target.closest("[data-bcm-enviar]")) {
        propor(bloco);
      } else if (e.target.closest("[data-bcm-levar]")) {
        levarParaCalculos(e.target.closest("[data-bcm-levar]").dataset.bcmLevar);
      } else if (e.target.closest("[data-bcm-copiar]")) {
        copiar(bloco, e.target.closest("[data-bcm-copiar]"));
      } else if (e.target.closest("[data-bcm-ir]")) {
        e.preventDefault();
        var aba = document.querySelector('.tab[data-mode="' + e.target.closest("[data-bcm-ir]").dataset.bcmIr + '"]');
        if (aba) aba.click();
        else abrirNotas();
      }
    });
    el.conversa.addEventListener("keydown", function (e) {
      var caixa = e.target.closest && e.target.closest(".bcm-seguir");
      if (!caixa) return;
      // Enter num campo curto, ou Ctrl/⌘+Enter na caixa grande, envia.
      if (e.key === "Enter" && (e.target.tagName === "INPUT" || e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        responderNaCaixa(caixa);
      }
    });
    var voltar = $("bcm-voltar");
    if (voltar) voltar.addEventListener("click", function () {
      var veio = false;
      try { veio = sessionStorage.getItem("bcm-veio-da-app") === "1"; } catch (_) {}
      if (veio) { location.href = "mike/"; return; }
      var aba = document.querySelector('.tab[data-mode="perguntar"]');
      if (aba) aba.click();
    });
    var notas = $("bcm-notas");
    if (notas) notas.addEventListener("toggle", function () { if (notas.open && window.kbCarregar) window.kbCarregar(); });
    reporConversa();
    atualizarContacto();
    // Depois de a app completa repor a última aba e os rascunhos (que, antes,
    // escreviam por cima do que acabava de chegar -- ver trazerBriefingDoPreview).
    setTimeout(receberDaApp, 1000);
  }

  function abrirNotas() {
    var d = $("bcm-notas");
    if (!d) return;
    d.open = true;
    if (window.kbCarregar) window.kbCarregar();
    d.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", ligar);
  else ligar();
})();
