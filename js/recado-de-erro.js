/**
 * QUANDO ALGUMA COISA REBENTA, A APP DIZ.
 *
 * Reportado assim: *"a calculadora ao abrir um projeto crasha sem dizer
 * nada"*. E era mesmo verdade em toda a linha: esta app não tinha UM único
 * apanhador de erros. Um `TypeError` a meio de um recálculo parava o
 * JavaScript onde estava, deixava o ecrã com o que lá tinha, e mais nada
 * acontecia. Num computador abre-se a consola e vê-se; num telemóvel, em cima
 * de um cliente, não há consola nenhuma — há uma app que "crashou".
 *
 * O silêncio é o defeito. Não é que a app falhe — é que falha e não conta, e
 * por isso ninguém consegue dizer o que aconteceu nem eu consigo ir lá
 * procurar. Isto não impede o erro: dá-lhe voz, e dá um botão que copia o
 * detalhe para uma mensagem.
 *
 * Carrega ANTES de tudo o resto, de propósito: os erros que mais custam a
 * apanhar são os do arranque, e um apanhador que chega depois não os vê.
 *
 * Apanha as três maneiras de falhar que existem aqui:
 *   1. um erro de JavaScript a correr ("error" com message);
 *   2. um FICHEIRO que não carregou ("error" num <script>/<link>/<img>) --
 *      que é como uma app instalada falha quando o cache fica a meio;
 *   3. uma promessa recusada sem ninguém a apanhar ("unhandledrejection"),
 *      que é por onde escapam os fetch e o FileReader.
 */
(function () {
  "use strict";

  var MAX_NA_LISTA = 20;
  var ocorrencias = [];
  var caixa = null, texto = null;

  function versaoDaApp() {
    var v = document.getElementById("app-versao");
    return v ? v.textContent.trim() : "(versão desconhecida)";
  }

  /** O que se copia e se manda numa mensagem — é isto que permite arranjar. */
  function detalheCompleto() {
    return [
      "Mike Apps Calculadores " + versaoDaApp(),
      new Date().toISOString(),
      navigator.userAgent,
      location.href,
      "",
      ocorrencias.map(function (o, i) { return (i + 1) + ") " + o; }).join("\n\n")
    ].join("\n");
  }

  function construirCaixa() {
    if (caixa) return;
    caixa = document.createElement("div");
    caixa.id = "recado-de-erro";
    caixa.setAttribute("role", "alert");
    // O estilo vai aqui e não no CSS de propósito: se o que falhou foi
    // precisamente a folha de estilo, um aviso sem estilo nenhum é invisível
    // -- e era esse o caso que mais precisava de se ver.
    caixa.style.cssText = [
      "position:fixed", "left:8px", "right:8px", "bottom:8px", "z-index:99999",
      "background:#3A1613", "color:#FFD9D2", "border:1px solid #8A3A2E",
      "border-radius:10px", "padding:10px 12px", "font:13px/1.45 system-ui,sans-serif",
      "box-shadow:0 6px 24px rgba(0,0,0,.45)", "max-height:45vh", "overflow:auto"
    ].join(";");

    texto = document.createElement("div");
    texto.style.cssText = "white-space:pre-wrap;word-break:break-word;margin-bottom:8px";

    var botoes = document.createElement("div");
    botoes.style.cssText = "display:flex;gap:8px;flex-wrap:wrap";

    var copiar = document.createElement("button");
    copiar.type = "button";
    copiar.textContent = "Copiar detalhe";
    copiar.style.cssText = "flex:1 1 auto;min-height:38px;border-radius:8px;border:1px solid #8A3A2E;" +
      "background:#5A241C;color:#FFD9D2;font:600 13px system-ui,sans-serif";
    copiar.addEventListener("click", function () {
      var d = detalheCompleto();
      var feito = function () { copiar.textContent = "Copiado ✓"; setTimeout(function () { copiar.textContent = "Copiar detalhe"; }, 1800); };
      // Sem clipboard (http, browser antigo, permissão negada) não se perde o
      // texto: selecciona-se para se poder copiar à mão, que é o que resta.
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(d).then(feito, function () { mostrarParaCopiarAMao(d); });
      } else { mostrarParaCopiarAMao(d); }
    });

    var fechar = document.createElement("button");
    fechar.type = "button";
    fechar.textContent = "Fechar";
    fechar.style.cssText = "min-height:38px;padding:0 14px;border-radius:8px;border:1px solid #8A3A2E;" +
      "background:transparent;color:#FFD9D2;font:13px system-ui,sans-serif";
    fechar.addEventListener("click", function () { caixa.style.display = "none"; });

    botoes.appendChild(copiar);
    botoes.appendChild(fechar);
    caixa.appendChild(texto);
    caixa.appendChild(botoes);
    (document.body || document.documentElement).appendChild(caixa);
  }

  function mostrarParaCopiarAMao(d) {
    var area = document.createElement("textarea");
    area.value = d;
    area.readOnly = true;
    area.style.cssText = "width:100%;min-height:120px;margin-top:8px;font:11px monospace;" +
      "background:#1A0C0A;color:#FFD9D2;border:1px solid #8A3A2E;border-radius:6px";
    caixa.appendChild(area);
    area.focus(); area.select();
  }

  function registar(linha) {
    // O mesmo erro a repetir-se num loop de desenho enchia isto em segundos.
    if (ocorrencias.indexOf(linha) !== -1) return;
    ocorrencias.push(linha);
    if (ocorrencias.length > MAX_NA_LISTA) ocorrencias.shift();
    try {
      construirCaixa();
      caixa.style.display = "";
      texto.textContent = "Alguma coisa correu mal na app" +
        (ocorrencias.length > 1 ? " (" + ocorrencias.length + " avisos)" : "") + ".\n\n" +
        ocorrencias[ocorrencias.length - 1] + "\n\n" +
        "O que estava no ecrã pode estar incompleto. Copia o detalhe e manda — " +
        "é com isso que isto se arranja.";
    } catch (e) {
      // Um apanhador de erros que rebenta a apanhar um erro é pior do que não
      // existir: pelo menos fica na consola de quem tiver uma.
      try { console.error("recado-de-erro falhou:", e); } catch (_) {}
    }
  }

  window.addEventListener("error", function (e) {
    // Um ficheiro que não carregou vem como um "error" no elemento, sem
    // message. É assim que uma app instalada falha quando o cache fica a meio
    // -- e a app continua a parecer inteira, só sem metade do que faz.
    var alvo = e && e.target;
    if (alvo && alvo !== window && (alvo.src || alvo.href)) {
      registar("Não carregou: " + (alvo.src || alvo.href) +
        "\n(a app pode estar a meio de uma atualização — fecha e volta a abrir)");
      return;
    }
    var msg = (e && e.message) || "erro sem mensagem";
    var onde = e && e.filename ? e.filename.replace(location.origin, "") + ":" + e.lineno + ":" + e.colno : "";
    var pilha = e && e.error && e.error.stack ? "\n" + String(e.error.stack).split("\n").slice(0, 4).join("\n") : "";
    registar(msg + (onde ? "\n" + onde : "") + pilha);
  }, true);   // na captura, para apanhar também os erros de carregamento

  window.addEventListener("unhandledrejection", function (e) {
    var r = e && e.reason;
    var msg = (r && r.message) || String(r);
    var pilha = r && r.stack ? "\n" + String(r.stack).split("\n").slice(0, 4).join("\n") : "";
    registar("Promessa recusada sem ninguém a apanhar: " + msg + pilha);
  });

  // Porta de serviço, para os testes poderem perguntar sem ler o ecrã -- e
  // para a app poder contar aqui uma falha que ELA apanhou.
  //
  // Um erro apanhado num try/catch nunca chega ao window.onerror: fica no
  // catch e morre lá. É esse o caso em que a app sabe o que correu mal e
  // continua a poder mostrá-lo a quem está a usá-la -- e a pô-lo no detalhe
  // que se copia numa mensagem, que é com o que isto se arranja.
  window.recadoDeErro = {
    ocorrencias: function () { return ocorrencias.slice(); },
    detalhe: detalheCompleto,
    contar: function (linha) { registar(String(linha)); }
  };
})();
