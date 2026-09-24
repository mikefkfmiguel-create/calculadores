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

// UM PITCH QUE NÃO EXISTE NO PAINEL NÃO SE ESCREVE.
//
// A app mostrava sempre a MÉDIA dos dois eixos. Num painel normal isso não
// se nota (os dois são iguais, a média é o mesmo número). Mas o Traulux
// transparente é 3,91 mm na horizontal e 7,81 mm na vertical -- de propósito,
// é isso que o deixa transparente -- e a app escrevia "Pixel pitch: 5,86 mm".
// Um valor que não está na ficha do fabricante nem se mede em lado nenhum
// daquele painel, com ar de especificação, pronto a ser copiado para um email
// ou uma ficha técnica.
//
// O aviso de divergência já existia ao lado a dizer a verdade -- mas quem
// copia o resumo leva o número, não o aviso.
//
// A tolerância é a MESMA que o aviso usa, e está aqui para não poderem
// discordar: o dia em que o aviso disser "assimétrico" e o número continuar a
// ser um só é o dia em que isto volta.
var PITCH_IGUAIS_ATE_MM = 0.01;

function pitchIguais(pitchX, pitchY) {
  return Math.abs(pitchX - pitchY) <= PITCH_IGUAIS_ATE_MM;
}

// E A REGRA NÃO É A MESMA NAS DUAS ABAS -- de propósito.
//
// Na aba LED comparam-se dois números da FICHA de um painel: ou o fabricante
// diz o mesmo nos dois eixos ou não diz, e meio centésimo de milímetro é
// arredondamento. Na aba Blending o "pixel size" é outra coisa: sai de uma
// divisão entre os metros e os píxeis de uma imagem projetada, onde uns
// décimos de diferença são o normal de qualquer conta com casas decimais. A
// pergunta ali não é "são iguais?", é "a imagem está esticada?" -- e a
// resposta é a mesma que o aviso já dava: mais de 5% de diferença.
//
// Usar a régua do LED aqui punha o número a mostrar dois valores em casos
// onde o aviso não aparece, que é o desencontro que isto veio corrigir. Por
// isso cada aba traz a sua régua e o pitchTexto só trata de escrever.
var PITCH_IMAGEM_DIVERGE_ACIMA_DE = 0.05;

function pitchImagemIguais(pitchH, pitchV) {
  var media = (pitchH + pitchV) / 2;
  if (!isFinite(media) || media === 0) return true;
  return Math.abs(pitchH - pitchV) / media <= PITCH_IMAGEM_DIVERGE_ACIMA_DE;
}

/**
 * O pitch como se escreve: "3,91" quando os dois eixos são o mesmo,
 * "3,91 × 7,81" quando não são. Sem unidade -- quem chama põe o "mm" como
 * lhe der jeito (com <small> no ecrã, à letra no texto que se copia).
 *
 * O `saoIguais` deixa quem chama trazer a sua régua (ver acima). Em falta,
 * vale a do painel, que é o caso mais comum.
 */
function pitchTexto(pitchX, pitchY, saoIguais) {
  if (!isFinite(pitchX) || !isFinite(pitchY)) return "—";
  var iguais = (saoIguais === undefined) ? pitchIguais(pitchX, pitchY) : !!saoIguais;
  if (iguais) return fmt(pitchX, 2);
  return fmt(pitchX, 2) + " × " + fmt(pitchY, 2);
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

/**
 * PESQUISA POR PALAVRAS, n\u00e3o por peda\u00e7o de texto.
 *
 * Reportado com uma fotografia do campo dos modelos: *"n\u00e3o encontra"*. Nesse
 * caso era verdade \u2014 a AVK n\u00e3o tem Xiaomi nenhum, e o link para o mercado \u00e9
 * exactamente a sa\u00edda certa. Mas ao medir a lista a s\u00e9rio apareceu um defeito
 * maior, que escondia equipamento que a casa TEM:
 *
 *     "samsung 55"     \u2192  1 resultado com o antigo,  13 com este
 *     "55 samsung"     \u2192  0                          13
 *     "samsung uhd"    \u2192  0                           8
 *     "lg 86 4k"       \u2192  0                           4
 *     "traulux 75"     \u2192  0                           1
 *
 * A etiqueta de cada op\u00e7\u00e3o \u00e9 `Led TV 55" 4K Samsung TU55DU7105K \u2014 55"`: quem
 * escreve a marca antes do tamanho, ou a marca antes da tecnologia, escrevia
 * palavras que EST\u00c3O todas l\u00e1 e n\u00e3o recebia nada. Procurar o texto escrito
 * inteiro dentro da etiqueta obriga a adivinhar a ordem por que o invent\u00e1rio
 * foi escrito \u2014 e ningu\u00e9m a sabe de cor.
 *
 * Agora cada palavra \u00e9 procurada por si: aparecem as op\u00e7\u00f5es onde TODAS est\u00e3o,
 * seja qual for a ordem. Continua a ser filtragem do que j\u00e1 est\u00e1 na lista \u2014
 * nada vem de fora, e a lista continua a ser o invent\u00e1rio.
 */
function matchesSearch(texto, termos) {
  var alvo = normalizeSearch(texto);
  for (var i = 0; i < termos.length; i++) {
    if (alvo.indexOf(termos[i]) === -1) return false;
  }
  return true;
}

function searchTerms(raw) {
  return normalizeSearch(raw).split(/\s+/).filter(function (t) { return t !== ""; });
}

/* ==================================================== A REGRA DO MERCADO
 *
 * *"monta uma regra para quando devolve não encontrado disparar uma procura
 * no mercado"*.
 *
 * A procura no mercado já existia como link. A regra é sobre QUANDO ela sai
 * sozinha — e o cuidado todo está em não a disparar a meio de uma palavra:
 * quem escreve "Samsung" passa por "S", "Sa", "Sam", e todos eles dão zero
 * resultados. Uma app que abre um separador a cada letra é inutilizável.
 *
 * Por isso a procura só ARMA quando as quatro condições se juntam:
 *
 *   1. nenhuma opção da lista corresponde (depois da pesquisa por palavras);
 *   2. o que está escrito tem pelo menos 3 caracteres;
 *   3. e tem pelo menos uma LETRA — "55" é uma medida, não um modelo, e
 *      quem escreve só números está a filtrar, não a procurar no mercado;
 *   4. passaram 1,2 s sem escrever nada. Não é um atraso: é a diferença
 *      entre "acabei" e "estou a meio".
 *
 * Armada, dispara sozinha uma vez — e só uma vez por texto escrito. Mudar o
 * texto desarma; voltar ao mesmo texto não volta a disparar.
 *
 * E DISPARA SÓ COM O CAMPO EM FOCO. Se a pessoa já foi para outro sítio da
 * página, um separador a abrir por cima do que ela está a fazer é um susto,
 * não uma ajuda.
 *
 * O BROWSER PODE RECUSAR, e isso não é um defeito desta app: abrir separadores
 * fora de um toque é o que os bloqueadores de popups existem para travar, e no
 * telemóvel é mais apertado do que no computador. Por isso a abertura é
 * medida (ver abrirNoMercado) e, quando é recusada, o recado di-lo e o botão
 * fica lá — um toque abre à mesma.
 *
 * Desliga-se na própria caixa, onde a coisa acontece. A escolha fica guardada
 * e é partilhada pelas quatro listas que usam isto.
 */
var MERCADO_MIN_LETRAS = 3;
var MERCADO_ESPERA_MS = 1200;
var MERCADO_AUTO_KEY = "mikeapps-mercado-auto-v1";

function mercadoAutoLigado() {
  try {
    var v = localStorage.getItem(MERCADO_AUTO_KEY);
    return v === null ? true : v === "1";
  } catch (_) { return true; }
}

function mercadoAutoGuardar(ligado) {
  try { localStorage.setItem(MERCADO_AUTO_KEY, ligado ? "1" : "0"); } catch (_) {}
}

/** Uma consulta merece ir ao mercado? (condições 2 e 3 da regra) */
function vaiAoMercado(raw) {
  var q = normalizeSearch(raw).trim();
  return q.length >= MERCADO_MIN_LETRAS && /[a-z]/.test(q);
}

/**
 * Abre a procura e DIZ SE CONSEGUIU.
 *
 * Sem o "noopener" de propósito: com ele, o window.open devolve sempre null
 * por especificação, e não haveria como distinguir "o browser bloqueou" de
 * "abriu". A ligação ao separador novo corta-se logo a seguir (`opener =
 * null`), que dá a mesma protecção.
 */
function abrirNoMercado(url) {
  var w = null;
  try { w = window.open(url, "_blank"); } catch (_) { w = null; }
  if (!w) return false;
  try { w.opener = null; } catch (_) {}
  return true;
}

/** A pergunta que se leva ao mercado, a partir do que a lista é. */
function consultaDeMercado(raw, oQueE) {
  return String(raw) + (oQueE ? " " + oQueE : "") + " ficha técnica";
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
  // O que a regra do mercado precisa de saber entre teclas: o relógio a
  // contar o silêncio, e qual foi o último texto que já foi ao mercado
  // (para não ir duas vezes ao mesmo).
  var relogioMercado = null;
  var jaDisparado = null;
  var bloqueado = false;
  // O QUE A CAIXA ESTÁ A FAZER, para se poder dizer: "" (nada), "a-vir" (o
  // relógio a contar o silêncio antes de disparar) ou "aberto" (já foi).
  //
  // Pedido: *"adiciona um aviso de que está a procurar"*. Uma coisa que
  // acontece sozinha e em silêncio é indistinguível de uma avaria -- e um
  // separador que aparece do nada, sem nada na app a dizer que foi ela, é
  // exactamente isso. O aviso também serve de travão: quem o vê a contar
  // sabe que pode escrever mais uma letra, ou desligar, antes de abrir.
  var estadoMercado = "";

  function porEstado(novo) {
    if (estadoMercado === novo) return;
    estadoMercado = novo;
    applyFilter();
  }

  function desarmarMercado() {
    if (relogioMercado) { clearTimeout(relogioMercado); relogioMercado = null; }
    if (estadoMercado === "a-vir") porEstado("");
  }

  // O disparo em si. `porGesto` é verdade quando foi um toque ou o Enter —
  // aí não há regra nenhuma a cumprir, a pessoa pediu.
  function irAoMercado(porGesto) {
    if (!noResultUrl) return false;
    jaDisparado = input.value.trim();
    var abriu = abrirNoMercado(noResultUrl);
    if (abriu) {
      // Dizer que foi aberta, e onde: um separador novo não se vê quando se
      // está a olhar para o teclado do telemóvel.
      bloqueado = false;
      porEstado("aberto");
    } else if (!porGesto) {
      // O browser recusou. Dizer-se, e deixar o botão: um toque abre.
      bloqueado = true;
      porEstado("");
      applyFilter();
    }
    return abriu;
  }

  function armarMercado() {
    desarmarMercado();
    var raw = input.value.trim();
    // `noResultUrl` a null quer dizer que a lista TEM o que se procura: aí
    // não há aviso nenhum a dar, nem procura a armar.
    if (!mercadoAutoLigado() || !noResultUrl) return;
    if (!vaiAoMercado(raw) || raw === jaDisparado) return;
    porEstado("a-vir");
    relogioMercado = setTimeout(function () {
      relogioMercado = null;
      // Voltar a confirmar tudo no momento de disparar: em 1,2 s a pessoa
      // pode ter apagado, escolhido um modelo, ou saído do campo. Em
      // qualquer desses casos o aviso tem de SAIR -- um "vou procurar" que
      // fica pendurado sem nunca procurar é pior do que aviso nenhum.
      var agora = input.value.trim();
      if (!noResultUrl || document.activeElement !== input ||
          agora !== raw || !vaiAoMercado(agora) || agora === jaDisparado) {
        porEstado("");
        return;
      }
      irAoMercado(false);
    }, MERCADO_ESPERA_MS);
  }

  function applyFilter() {
    var raw = input.value.trim();
    var termos = searchTerms(raw);
    var anyVisible = false;
    Array.prototype.forEach.call(select.options, function (opt) {
      var match = !termos.length || matchesSearch(opt.textContent, termos);
      opt.hidden = !match;
      if (match) anyVisible = true;
    });
    if (!anyVisible && termos.length) {
      var query = encodeURIComponent(consultaDeMercado(raw, select.dataset.mercado || ""));
      noResultUrl = "https://www.google.com/search?q=" + query;
      // QUAL É A PALAVRA QUE NÃO EXISTE. "Não encontrei nada" deixa a pessoa
      // sem saber se a app está avariada, se escreveu mal, ou se a casa
      // simplesmente não tem aquilo. Dizer «nada com "xiaomi"» responde à
      // pergunta toda: a lista não tem essa marca, e o link é a saída.
      var semNada = termos.filter(function (t) {
        return !Array.prototype.some.call(select.options, function (o) {
          return matchesSearch(o.textContent, [t]);
        });
      });
      var aspas = function (t) { return "«" + escapeXml(t) + "»"; };
      var porque = semNada.length
        ? "Nada na lista com " + semNada.map(aspas).join(" nem ")
        : (termos.length > 1
            ? "Cada palavra existe, mas nenhum modelo as junta todas"
            : "Não encontrei nada na lista");
      // A REGRA À VISTA, e desligável onde acontece. Um interruptor escondido
      // numas definições, para uma coisa que só aparece aqui, era a pessoa a
      // ter de adivinhar onde se muda o que a incomodou.
      // Com o aviso do estado à vista, o parêntesis que explica a regra
      // cala-se: o que está a acontecer manda sobre o que costuma acontecer.
      var aviso = bloqueado
        ? ' <span class="hint">(o browser não deixou abrir sozinho — toca)</span>'
        : (estadoMercado
            ? ""
            : (mercadoAutoLigado()
                ? ' <span class="hint">(abre sozinho, ou Enter)</span>'
                : ' <span class="hint">(ou Enter)</span>'));
      // O AVISO DO QUE ESTÁ A ACONTECER. Uma linha própria, e não mais um
      // parêntesis no meio do texto: é a única parte desta caixa que MUDA
      // sozinha, e o que muda sozinho tem de se ver a mudar.
      var estado = "";
      if (estadoMercado === "a-vir") {
        estado = '<p class="mercado-estado a-procurar">A procurar ' +
          aspas(escapeXml(raw)) + ' no mercado<span class="pontos">…</span>' +
          '<span class="hint">(escreve mais para parar)</span></p>';
      } else if (estadoMercado === "aberto") {
        estado = '<p class="mercado-estado aberta">Procura aberta num separador novo ↗</p>';
      }
      noResult.innerHTML = porque +
        ' — <a class="srclink" href="' + noResultUrl + '" target="_blank" rel="noopener">procurar "' +
        escapeXml(raw) + '" no mercado ↗</a>' + aviso + estado +
        '<label class="mercado-auto"><input type="checkbox" class="mercado-auto-caixa"' +
        (mercadoAutoLigado() ? " checked" : "") + '> abrir sozinha a procura</label>';
      var caixa = noResult.querySelector(".mercado-auto-caixa");
      caixa.addEventListener("change", function () {
        mercadoAutoGuardar(caixa.checked);
        bloqueado = false;
        if (caixa.checked) armarMercado(); else desarmarMercado();
        applyFilter();
      });
      // O clique no link é um gesto — nunca é bloqueado, e não precisa da
      // regra. Só se marca como já disparado, para o automático não repetir.
      var link = noResult.querySelector("a.srclink");
      link.addEventListener("click", function () { jaDisparado = input.value.trim(); });
      noResult.style.display = "block";
    } else {
      noResultUrl = null;
      bloqueado = false;
      estadoMercado = "";
      desarmarMercado();
      noResult.style.display = "none";
    }
  }
  select._modelSearchRefresh = applyFilter;

  input.addEventListener("input", function () {
    bloqueado = false;
    // Escrever apaga o aviso da procura anterior: ele fala do que está
    // escrito, e o que está escrito acabou de mudar.
    estadoMercado = "";
    applyFilter();
    // Cada tecla volta a pôr o relógio a zero: a regra conta o SILÊNCIO,
    // não o tempo desde que se começou a escrever.
    armarMercado();
  });
  // Enter dispara logo a pesquisa externa quando não há nada na lista —
  // não é preciso ir com o rato até ao link. É um gesto, por isso não passa
  // pela regra nem espera pelo relógio.
  input.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && noResultUrl) {
      e.preventDefault();
      desarmarMercado();
      irAoMercado(true);
    }
  });
  // Sair do campo desarma. Um separador a abrir depois de a pessoa já estar
  // noutro sítio da página é um susto, não uma ajuda.
  input.addEventListener("blur", desarmarMercado);
  // No telemóvel, a tecla do teclado passa a ser a lupa em vez do "↵".
  input.setAttribute("enterkeyhint", "search");
  select.addEventListener("change", function () {
    if (input.value) { input.value = ""; applyFilter(); }
  });
}

// Sincronização automática com o Preview 3D — preferência partilhada pelas
// duas apps (mesma origem, mesmo localStorage). Desligada, nada passa
// sozinho: nem o que chega do Preview pelo evento "storage", nem o que
// estas calculadoras escrevem sem ninguém pedir. Os botões manuais
// ("Trazer do Preview", "Sincronizar", "Ver em 3D") continuam sempre a
// funcionar — o interruptor é só sobre o que acontece por si.
var SYNC_PREF_KEY = "mikeapps-sincronizacao-v1";
// Já se disse a esta pessoa que a sincronização passou a nascer desligada?
// Uma vez chega, e é partilhado pelas duas apps: quem abrir primeiro avisa.
var SYNC_AVISO_KEY = "mikeapps-sincronizacao-aviso-v1";

/**
 * DESLIGADA POR OMISSÃO, desde a v3.80.
 *
 * Pedido: *"abre sempre dos dois lados com o sync desligado e em projeto limpo
 * até eu abrir um"*. Antes, a ausência da chave lia-se como LIGADA -- e uma
 * app que começa a mandar coisas para o 3D sem ninguém pedir é o contrário do
 * que ele quer de manhã, no terreno.
 *
 * O interruptor no cabeçalho continua a valer, e é um clique.
 */
function syncAutoLigada() {
  var raw;
  try { raw = localStorage.getItem(SYNC_PREF_KEY); } catch (e) { return false; }
  if (raw == null) return false;
  // O valor tanto pode vir como JSON ("\"desligada\"") como em texto simples
  // — as duas apps escrevem-no e não vale a pena obrigar a um formato só.
  var valor = raw;
  try { var parsed = JSON.parse(raw); if (typeof parsed === "string") valor = parsed; } catch (e) {}
  return String(valor).trim().toLowerCase() !== "desligada";
}

/**
 * A MIGRAÇÃO, QUE NÃO PODE SER MUDA.
 *
 * Quem nunca tocou no interruptor tinha-o ligado sem saber -- era esse o valor
 * por omissão. Virá-lo em silêncio desligava-lhe a sincronização e ele ia
 * descobri-lo quando o 3D não recebesse nada, que é exactamente o defeito que
 * esta app passa a vida a corrigir.
 *
 * Por isso, à primeira vez: escreve-se o valor por extenso (deixa de haver
 * ausência para interpretar) e diz-se uma vez. Devolve true quando há algo a
 * dizer, para quem chama mostrar o aviso.
 */
function syncAutoMigrar() {
  try {
    if (localStorage.getItem(SYNC_PREF_KEY) != null) return false;
    if (localStorage.getItem(SYNC_AVISO_KEY) === "1") return false;
    localStorage.setItem(SYNC_PREF_KEY, JSON.stringify("desligada"));
    localStorage.setItem(SYNC_AVISO_KEY, "1");
    return true;
  } catch (e) { return false; }
}

function syncAutoDefinir(ligada) {
  try { localStorage.setItem(SYNC_PREF_KEY, JSON.stringify(ligada ? "ligada" : "desligada")); } catch (e) {}
  syncAutoNotificar();
}

// Quem desenha um interruptor regista-se aqui para se manter certo quando a
// preferência muda — inclusive quando quem a mudou foi a outra app.
var syncAutoOuvintes = [];
function syncAutoAoMudar(fn) { syncAutoOuvintes.push(fn); fn(syncAutoLigada()); }
function syncAutoNotificar() {
  var ligada = syncAutoLigada();
  syncAutoOuvintes.forEach(function (f) { try { f(ligada); } catch (e) {} });
}
window.addEventListener("storage", function (e) {
  if (e.key === SYNC_PREF_KEY) syncAutoNotificar();
});

// O interruptor em si — as duas páginas (index.html e ecra-complexo.html)
// só precisam de ter um <button id="btSincronizacaoAuto"> no cabeçalho.
(function () {
  var btn = document.getElementById("btSincronizacaoAuto");
  if (!btn) return;
  syncAutoAoMudar(function (ligada) {
    btn.textContent = ligada ? "🔗 Auto: ligada" : "⛔ Auto: desligada";
    btn.classList.toggle("is-on", ligada);
    btn.classList.toggle("is-off", !ligada);
    btn.setAttribute("aria-pressed", ligada ? "true" : "false");
  });
  if (syncAutoMigrar()) {
    syncAutoNotificar();
    showToast("A app passou a abrir com a sincronização automática DESLIGADA, " +
      "para nada ir para o 3D sem tu pedires. O interruptor \"Auto\" aqui em cima liga-a.");
  }
  btn.addEventListener("click", function () {
    var novo = !syncAutoLigada();
    syncAutoDefinir(novo);
    showToast(novo
      ? "Sincronização automática ligada — o que mudar no Preview passa a chegar sozinho."
      : "Sincronização automática desligada — nada passa sozinho. Usa \"Trazer do Preview\" ou \"Sincronizar\".");
  });
})();

// O BOTÃO DE INSTALAR, nas páginas que o tenham.
//
// Fica aqui, ao pé do interruptor da sincronização, pela mesma razão: as duas
// páginas desta app (index e ecrã complexo) partilham este ficheiro, e assim
// basta terem o botão no cabeçalho. Quem faz o trabalho é js/instalar.js --
// aqui só se liga o botão ao recado.
(function () {
  if (!window.mikeappsInstalar) return;
  window.mikeappsInstalar.ligarBotao("btInstalar", function (recado) {
    if (recado) showToast(recado);
  });
})();

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
  // O alvo ser o próprio <dialog> não implica que o clique caiu fora da
  // caixa do popup — pode ter caído num gap/padding lá dentro. Só conta
  // como "clicar fora" (cancelar) se o ponto clicado estiver mesmo fora
  // da caixa — igual ao popup de edição de zona.
  dialog.addEventListener("click", function (e) {
    if (e.target !== dialog) return;
    var r = dialog.getBoundingClientRect();
    var foraDaCaixa = e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
    if (foraDaCaixa) dialog.close("no");
  });
})();

// Popup de alarme para valores fisicamente impossíveis ou limites reais
// ultrapassados (ex: tamanho mínimo não cabe no pé-direito indicado) — não
// é para simples dúvidas de leitura, essas ficam nas caixas de aviso já
// existentes em cada calculadora. opts: { title, message, editText,
// actionLabel, onAction(newEditText) }. Sem editText, o campo de edição
// fica escondido; sem actionLabel/onAction, só mostra "Fechar".
function showAlarm(opts) {
  opts = opts || {};
  var dialog = document.getElementById("app-alert-dialog");
  if (!dialog) { alert((opts.title ? opts.title + "\n\n" : "") + (opts.message || "")); return; }
  document.getElementById("app-alert-title").textContent = opts.title || "⚠ Aviso";
  document.getElementById("app-alert-msg").textContent = opts.message || "";
  var editWrap = document.getElementById("app-alert-edit");
  var editTextarea = document.getElementById("app-alert-edit-text");
  if (opts.editText != null) {
    editWrap.style.display = "block";
    editTextarea.value = opts.editText;
  } else {
    editWrap.style.display = "none";
    editTextarea.value = "";
  }
  var actionBtn = document.getElementById("app-alert-action-btn");
  if (opts.actionLabel && opts.onAction) {
    actionBtn.textContent = opts.actionLabel;
    actionBtn.style.display = "inline-block";
    actionBtn.onclick = function () {
      dialog.close();
      opts.onAction(editTextarea.value);
    };
  } else {
    actionBtn.style.display = "none";
    actionBtn.onclick = null;
  }
  dialog.showModal();
}
(function () {
  var dialog = document.getElementById("app-alert-dialog");
  if (!dialog) return;
  // Mesma ressalva do popup de edição de zona: o alvo ser o próprio
  // <dialog> não implica clique fora da caixa (pode ser um gap/padding
  // lá dentro) — só fecha se o ponto clicado estiver mesmo fora dela.
  dialog.addEventListener("click", function (e) {
    if (e.target !== dialog) return;
    var r = dialog.getBoundingClientRect();
    var foraDaCaixa = e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
    if (foraDaCaixa) dialog.close();
  });
  var closeBtn = document.getElementById("app-alert-close");
  if (closeBtn) closeBtn.addEventListener("click", function () { dialog.close(); });
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
