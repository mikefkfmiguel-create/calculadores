// Relatório SIMPLIFICADO — o mesmo resumo de cada calculadora, só com o essencial.
//
// Pedido: "um modo de relatório e resultado extra que seja o simplificado, para
// não baralhar com tanta informação". O resumo completo continua a existir e é
// o que está por omissão; este é um segundo modo, ao lado, escolhido com um
// botão Completo / Simplificado em cada resumo (todos andam juntos).
//
// Como funciona, e porque é assim:
//  - Cada calculadora continua a escrever o seu texto completo em PT no <pre
//    class="sumbox">, exatamente como antes. NENHUMA conta foi tocada, e o
//    texto completo continua a ser o que o relatório do Projeto e o 3D leem.
//  - Aqui apanha-se essa escrita (pelo textContent do próprio <pre>, que só o
//    código das calculadoras usa -- o tradutor mexe nos nós de texto), e escreve-se
//    ao lado um segundo <pre> com a versão curta. Um dos dois está à vista.
//  - O simplificador trabalha linha a linha: tira as linhas de detalhe, encurta
//    as que têm explicações penduradas e deixa passar tudo o que não conhece --
//    uma linha nova que apareça numa calculadora fica no relatório, não se
//    perde em silêncio. Avisos (⚠ / ATENÇÃO) nunca saem.
//  - Copiar / Partilhar usam o texto do modo que está à vista (textoDoResumo).
(function () {
  "use strict";

  var CHAVE = "calc-relatorio-modo";
  var modo = "completo";
  try { if (localStorage.getItem(CHAVE) === "simples") modo = "simples"; } catch (e) {}

  // Linhas que só o relatório completo leva (comparadas com a linha sem espaços à frente).
  var TIRAR = [
    /^Throw ratio \(dessa lente\)/,
    /^Shift dessa lente/,
    /^Distância de projeção \(com essa lente\)/,
    /^Overlap:/,
    /^Pixel size:/,
    /^Pixel clock/,
    /^Total de píxeis:/,
    /^Pixel usage total/,
    /^Standard:/,
    /^Folgas entre ecrãs/,
    /^Dimensão do conjunto/,
    /^Resolução final do canvas \(sem gaps\)/,
    /^Por ecrã:/,
    /^1 cm =/,
    /^1 in =/,
    /^1 px =/,
    /^Tamanho a definir no PowerPoint/
  ];

  function encurtarLinha(linha) {
    var m;

    // "Lentes compatíveis a essa distância (Marca): A, B — melhor: A" -> uma só lente.
    m = linha.match(/^Lentes compatíveis[^:]*: (.*)$/);
    if (m) {
      var resto = m[1];
      var melhor = resto.match(/ — melhor: (.+)$/);
      if (melhor) return "Lente sugerida: " + melhor[1];
      if (/^nenhuma/.test(resto)) return linha;
      return "Lente sugerida: " + resto.split(", ")[0];
    }

    // "Resolução combinada: … px  —  overlap 12% do total (…)" -> sem a parte do overlap.
    linha = linha.replace(/ +— +overlap .*$/, "");

    // "(centro X:1,00m Y:2,00m)" no nome de cada zona.
    linha = linha.replace(/ \(centro X:[^)]*\)/, "");

    // Luminosidade: só o que se sente no ecrã.
    if (/^Luminosidade:/.test(linha) && /lux no ecrã/.test(linha)) {
      var partes = linha.split(" — ");
      return "Luminosidade: " + partes[partes.length - 1].trim();
    }

    // Switchers: a capacidade diz tudo; entradas/saídas por extenso são detalhe.
    linha = linha.replace(/ — entrada: .*? — saída: .*? — capacidade:/, " — capacidade:");

    // Processo de LED: sem a conta de tiles por porta.
    linha = linha.replace(/,? máx\. [^ ]+ tiles\/porta \([^)]*\)/, "");

    // Curvatura: o sentido e o raio.
    m = linha.match(/^(Curvatura: [^,]+),.*?(raio [^,]+),/);
    if (m) return m[1] + ", " + m[2];

    // "— usada para o sinal/processo: …" no fim da resolução do canvas.
    linha = linha.replace(/ — usada para o sinal\/processo: .*$/, "");

    return linha;
  }

  function simplificar(texto) {
    var saida = [];
    String(texto || "").split("\n").forEach(function (linha) {
      var t = linha.trim();
      if (!t) { saida.push(""); return; }
      var aviso = /⚠|ATENÇÃO/.test(linha);
      if (!aviso) {
        if (/^\s{4,}\S/.test(linha)) return;               // nota pendurada num item
        for (var i = 0; i < TIRAR.length; i++) if (TIRAR[i].test(t)) return;
        linha = encurtarLinha(linha);
      }
      saida.push(linha);
    });
    // Sem linhas em branco duplicadas nem nas pontas.
    return saida.join("\n").replace(/\n{3,}/g, "\n\n").replace(/^\n+|\n+$/g, "");
  }

  var descTexto = Object.getOwnPropertyDescriptor(Node.prototype, "textContent");
  var pares = [];                    // [{ completo, simples }]

  function atualizarSimples(par) {
    descTexto.set.call(par.simples, simplificar(par.pt));
  }

  function aplicarModo() {
    document.body.classList.toggle("rel-simples", modo === "simples");
    document.querySelectorAll(".rel-modo-btn").forEach(function (b) {
      var ativo = b.dataset.modo === modo;
      b.classList.toggle("active", ativo);
      b.setAttribute("aria-pressed", ativo ? "true" : "false");
    });
  }

  function escolherModo(novo) {
    modo = novo;
    try { localStorage.setItem(CHAVE, modo); } catch (e) {}
    aplicarModo();
  }

  function ligar(pre) {
    var simples = document.createElement("pre");
    simples.className = "sumbox sumbox-simples";
    simples.setAttribute("aria-label", "Relatório simplificado");
    pre.parentNode.insertBefore(simples, pre.nextSibling);
    var par = { completo: pre, simples: simples, pt: descTexto.get.call(pre) };
    pares.push(par);
    atualizarSimples(par);
    // O texto que as calculadoras escrevem é PT, de origem; o tradutor só
    // mexe depois, nos nós de texto, e não passa por aqui.
    Object.defineProperty(pre, "textContent", {
      configurable: true,
      get: function () { return descTexto.get.call(this); },
      set: function (v) {
        descTexto.set.call(this, v);
        par.pt = String(v == null ? "" : v);
        atualizarSimples(par);
      }
    });
  }

  function botoes(cabeca) {
    var grupo = document.createElement("span");
    grupo.className = "rel-modo";
    grupo.setAttribute("role", "group");
    grupo.setAttribute("aria-label", "Detalhe do relatório");
    [["completo", "Completo"], ["simples", "Simplificado"]].forEach(function (x) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "rel-modo-btn";
      b.dataset.modo = x[0];
      b.textContent = x[1];
      b.addEventListener("click", function () { escolherModo(x[0]); });
      grupo.appendChild(b);
    });
    var onde = cabeca.querySelector(".summary-actions") || cabeca.lastElementChild;
    if (onde && onde !== cabeca.firstElementChild) onde.insertBefore(grupo, onde.firstChild);
    else cabeca.appendChild(grupo);
  }

  // O texto que sai da app (copiar, partilhar, PDF): o do modo que se está a ver.
  window.textoDoResumo = function (el) {
    if (!el) return "";
    if (modo === "simples") {
      for (var i = 0; i < pares.length; i++) {
        if (pares[i].completo === el) return pares[i].simples.innerText;
      }
    }
    return el.innerText;
  };

  function iniciar() {
    document.querySelectorAll("pre.sumbox[id]").forEach(ligar);
    document.querySelectorAll(".summary-head").forEach(function (c) {
      if (c.parentNode.querySelector("pre.sumbox[id]")) botoes(c);
    });
    aplicarModo();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar);
  else iniciar();
})();
