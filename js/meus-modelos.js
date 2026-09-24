/**
 * OS MODELOS QUE A LISTA NÃO TINHA.
 *
 * Pedido: *"a pesquisa auto não será para popups mas sim para adicionar a
 * lista se não existir"*. E, logo a seguir: *"devia procurar para adicionar e
 * não pedir para ser eu a introduzir o que pode ser errado (…) apenas
 * acrescenta automaticamente, tornando-se inteligente e autónomo"*.
 *
 * O QUE UMA TV PRECISA, e o que a app pode mesmo saber sozinha:
 *
 * A conta de uma TV sai de DUAS coisas — diagonal e formato. Mais nada. As 88
 * TVs do inventário são todas 16:9, e a largura de um ecrã de 55" é a mesma
 * quer a marca seja Samsung, LG ou Xiaomi: é geometria, não é ficha técnica.
 * Por isso, quando o que se escreve traz um número ("Xiaomi 55"), ou quando a
 * diagonal já está escrita na aba, a app tem tudo o que precisa e acrescenta
 * o modelo SOZINHA — sem formulário, sem separador, sem perguntar nada.
 *
 * O QUE ELA NÃO PODE SABER é a resolução daquele modelo. Um 55" tanto pode
 * ser 4K como Full HD, e a REGRA DA CASA é clara: *"nunca inventar dados
 * técnicos — só valores reais, com fonte"*. Assumir 4K porque "hoje em dia é
 * quase sempre" é exactamente o género de número que acaba numa folha de
 * produção sem ninguém o ter conferido. Fica "não confirmada", e quem souber
 * escreve-a (é a mesma caixa, agora só para o que falta).
 *
 * ONDE ISTO VIVE, e porque não é o `data/tvs.json`:
 *
 *   · o catálogo é o INVENTÁRIO DA AVK e está no repositório — uma app
 *     estática não lhe pode escrever, e não devia: o que está lá é o que a
 *     casa tem, conferido;
 *   · o que se acrescenta aqui fica no browser (aparece na lista sempre que
 *     se abre a app) e VIAJA DENTRO DO PROJETO, para o ficheiro abrir igual
 *     noutro computador;
 *   · e há um botão para o copiar já no formato do catálogo. Quem o mandar,
 *     mete-o eu no `data/tvs.json` com a fonte anotada, e a partir daí passa
 *     a ser de toda a gente.
 *
 * Por agora só TVs — foi onde a falta apareceu, e cada lista quer campos
 * seus (um painel LED quer tiles, pitch, peso e amperes; uma lente quer
 * mínimo e máximo). O molde está feito para as outras entrarem a seguir:
 * CAMPOS_POR_TIPO é a única coisa que uma lista nova precisa de acrescentar.
 */

(function () {
  "use strict";

  var CHAVE = "mikeapps-meus-modelos-v1";

  // O que cada tipo de lista precisa de saber. `obrigatorio` é o que não faz
  // sentido nenhum sem — uma TV sem diagonal não dá medida nenhuma.
  var CAMPOS_POR_TIPO = {
    tv: {
      titulo: "Acrescentar uma TV à lista",
      campos: [
        { chave: "modelo", rotulo: "Modelo", tipo: "texto", obrigatorio: true,
          dica: "Como vem na ficha do fabricante — é este nome que aparece na lista e na folha de montagem." },
        { chave: "diag", rotulo: "Diagonal", tipo: "numero", unidade: "polegadas", obrigatorio: true, min: 1, passo: "0.5" },
        { chave: "ratio", rotulo: "Formato", tipo: "escolha", opcoes: ["16:9", "16:10", "21:9", "4:3"] },
        // A dica vai na SEGUNDA das duas caixas: entre elas, partia a
        // resolução a meio e a caixa de baixo ficava órfã do rótulo.
        { chave: "rx", rotulo: "Resolução", tipo: "numero", unidade: "px na horizontal", min: 1, passo: "1" },
        { chave: "ry", rotulo: "", tipo: "numero", unidade: "px na vertical", min: 1, passo: "1",
          dica: "Se não a souberes de fonte segura, deixa os dois em branco — a app diz «não confirmada», que é melhor do que um número inventado." },
        { chave: "touchscreen", rotulo: "Touchscreen", tipo: "sim-nao" },
        { chave: "fonte", rotulo: "Fonte", tipo: "texto", placeholder: "https://…",
          dica: "O endereço da ficha do fabricante. Fica agarrado ao modelo e aparece ao lado dele — é o que separa uma medida de um palpite." }
      ]
    }
  };

  /**
   * A DIAGONAL QUE ESTÁ ESCRITA NO NOME, se lá estiver.
   *
   * "Xiaomi 55" → 55. 'Xiaomi TV A Pro 55"' → 55. Mas um número colado a
   * letras NÃO conta: o "TU55DU7105K" da Samsung tem 55 lá dentro e não é a
   * diagonal de nada — é a referência. Só se aceita um número SOLTO, e
   * dentro do que existe como ecrã (7" a 130").
   */
  function diagonalNoTexto(texto) {
    var achados = String(texto || "").match(/(?:^|[\s(\[])(\d{1,3}(?:[.,]\d)?)\s*(?:"|''|pol|polegadas|inch)?(?=$|[\s)\]"',])/gi);
    if (!achados) return null;
    for (var i = achados.length - 1; i >= 0; i--) {   // o último, que é onde o tamanho costuma vir
      var n = parseFloat(achados[i].replace(/[^\d.,]/g, "").replace(",", "."));
      if (n >= 7 && n <= 130) return n;
    }
    return null;
  }

  /**
   * ACRESCENTAR SOZINHO, quando há com que.
   *
   * Devolve o modelo acrescentado, ou `null` quando falta a diagonal — e aí
   * quem pergunta é o formulário, com UM campo, em vez de sete.
   *
   * A resolução fica sempre por confirmar: ver a nota no topo. `auto: true`
   * marca-o como deduzido e não escrito à mão, para a app o poder dizer e
   * para o "Copiar para o catálogo" não o mandar como se fosse ficha.
   */
  /**
   * UMA MARCA NÃO É UM MODELO.
   *
   * Reportado com uma foto da lista a mostrar «Xiaomi — 55" · meu»: *"e
   * remover isto"*. E tinha toda a razão — «Xiaomi» é um fabricante, não um
   * ecrã. Aconteceu porque a app, ao não achar número nenhum no que estava
   * escrito, ia buscar a diagonal que estava na aba e dava a coisa por
   * resolvida. Uma pausa a meio de escrever a marca chegava para criar uma
   * entrada que não serve para nada e fica lá para sempre.
   *
   * A regra que separa as duas coisas, e é simples: um modelo tem SEMPRE um
   * número. Ou o tamanho ("Xiaomi 55"), ou a referência do fabricante
   * ("Samsung TU55DU7105K", "LG 86UK6500PLA"). Uma palavra sem um único
   * algarismo é uma marca — e por uma marca não se acrescenta nada, nem se
   * gasta uma procura na web.
   */
  function temNumero(texto) {
    return /\d/.test(String(texto || ""));
  }

  function acrescentarAutomatico(tipo, texto, sugestoes) {
    if (tipo !== "tv") return null;
    var nome = String(texto || "").trim();
    if (!nome || !temNumero(nome)) return null;
    var s = sugestoes || {};
    var diag = diagonalNoTexto(nome);
    var deOnde = "nome";
    if (diag == null) {
      var daAba = parseFloat(s.diag);
      if (daAba > 0) { diag = daAba; deOnde = "aba"; }
    }
    if (diag == null) return null;
    return acrescentar(tipo, {
      modelo: nome,
      diag: diag,
      ratio: s.ratio || "16:9",
      resolucao: null,
      touchscreen: false,
      fonte: null,
      meu: true,
      auto: true,
      diagDe: deOnde,
      acrescentadoEm: new Date().toISOString().slice(0, 10)
    });
  }

  /**
   * PROCURAR NA WEB, e só aceitar o que vier com fonte.
   *
   * *"se escrever «xiripiti» no campo da marca e a lista devolver «não
   * encontrado», dispara procura na web/mercado para adicionar
   * automaticamente"*.
   *
   * Quem procura é o Worker (`/modelo`): uma página estática não pode
   * pesquisar na web, e a chave de API não pode viver num ficheiro que o
   * GitHub Pages serve. O crivo que garante que nada é inventado está lá —
   * a fonte tem de ser uma das páginas que a pesquisa devolveu.
   *
   * Aqui só se trata do que fazer quando não dá: sem rede, sem Worker, ou
   * modelo que ninguém publica, cai-se na geometria que a app já sabe fazer
   * sozinha (ver acrescentarAutomatico). Em obra sem rede isto nunca
   * responde, e é por isso que NUNCA é o único caminho.
   */
  var URL_WORKER_CHAVE = "calculadores-assistente-worker-url";
  var URL_WORKER_OMISSAO = "https://calculadores-assistente.avkvideoshare.workers.dev";

  function enderecoDoWorker() {
    var guardado = null;
    try { guardado = localStorage.getItem(URL_WORKER_CHAVE); } catch (_) {}
    return (guardado || URL_WORKER_OMISSAO).replace(/\/+$/, "");
  }

  // O QUE JÁ SE PERGUNTOU NÃO SE VOLTA A PERGUNTAR. Cada procura é uma
  // chamada que custa dinheiro e conta para a trava do Worker; escrever,
  // apagar e voltar a escrever o mesmo é coisa de todos os dias.
  var jaPerguntado = {};

  function procurarNaWeb(tipo, texto, aoFim) {
    if (tipo !== "tv" || !navigator.onLine) { aoFim(null, "sem rede"); return; }
    // Procurar a ficha técnica de «Xiaomi» não devolve nada e custa dinheiro.
    if (!temNumero(texto)) { aoFim(null, "falta o modelo"); return; }
    var chave = tipo + "|" + normalizeSearch(texto);
    if (Object.prototype.hasOwnProperty.call(jaPerguntado, chave)) {
      var antes = jaPerguntado[chave];
      setTimeout(function () { aoFim(antes.ficha, antes.motivo); }, 0);
      return;
    }
    var parou = false;
    // Oito segundos e desiste: isto corre enquanto alguém espera a olhar
    // para o campo, e uma app que fica pendurada é pior do que uma app que
    // diz "não consegui" e faz a conta à mesma.
    var relogio = setTimeout(function () {
      if (parou) return;
      parou = true;
      aoFim(null, "demorou de mais");
    }, 8000);
    fetch(enderecoDoWorker() + "/modelo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ q: texto, tipo: tipo })
    }).then(function (r) { return r.json(); }).then(function (d) {
      if (parou) return;
      parou = true;
      clearTimeout(relogio);
      var ficha = (d && d.ok && d.modelo) ? d.modelo : null;
      var motivo = ficha ? null : ((d && d.motivo) || "não encontrei");
      jaPerguntado[chave] = { ficha: ficha, motivo: motivo };
      aoFim(ficha, motivo);
    }).catch(function (e) {
      if (parou) return;
      parou = true;
      clearTimeout(relogio);
      aoFim(null, e && e.message ? e.message : "falhou");
    });
  }

  /** O que a web devolveu, guardado como modelo desta app. */
  function acrescentarDaWeb(tipo, ficha) {
    return acrescentar(tipo, {
      modelo: ficha.modelo,
      diag: ficha.diag,
      ratio: ficha.ratio || "16:9",
      resolucao: ficha.resolucao || null,
      touchscreen: !!ficha.touchscreen,
      fonte: ficha.fonte || null,
      meu: true,
      daWeb: true,
      acrescentadoEm: new Date().toISOString().slice(0, 10)
    });
  }

  function ler(tipo) {
    try {
      var todos = JSON.parse(localStorage.getItem(CHAVE) || "{}");
      return Array.isArray(todos[tipo]) ? todos[tipo] : [];
    } catch (_) { return []; }
  }

  function escrever(tipo, lista) {
    try {
      var todos = JSON.parse(localStorage.getItem(CHAVE) || "{}");
      todos[tipo] = lista;
      localStorage.setItem(CHAVE, JSON.stringify(todos));
    } catch (_) {}
  }

  /**
   * Acrescenta, ou substitui o que tiver o mesmo nome.
   *
   * Substituir e não duplicar: dois "Xiaomi L55M7" na lista, com números
   * diferentes, é pior do que não haver nenhum — ninguém saberia qual é o
   * que vale.
   */
  function acrescentar(tipo, modelo) {
    var lista = ler(tipo);
    var i = lista.findIndex(function (m) {
      return normalizeSearch(m.modelo) === normalizeSearch(modelo.modelo);
    });
    if (i >= 0) lista[i] = modelo; else lista.push(modelo);
    escrever(tipo, lista);
    return modelo;
  }

  function remover(tipo, nome) {
    escrever(tipo, ler(tipo).filter(function (m) {
      return normalizeSearch(m.modelo) !== normalizeSearch(nome);
    }));
  }

  /**
   * Os modelos que vêm dentro de um projeto.
   *
   * Um .cal aberto noutro computador traz modelos que esse browser não
   * conhece. Entram, para o projeto abrir igual — mas sem pisar o que já cá
   * estava: quem tem o equipamento à frente e o corrigiu à mão não quer ver
   * a correcção desfeita por um ficheiro de ontem.
   */
  function importar(tipo, lista) {
    if (!Array.isArray(lista) || !lista.length) return 0;
    var minha = ler(tipo);
    var tenho = {};
    minha.forEach(function (m) { tenho[normalizeSearch(m.modelo)] = true; });
    var novos = lista.filter(function (m) {
      return m && m.modelo && !tenho[normalizeSearch(m.modelo)];
    });
    if (!novos.length) return 0;
    escrever(tipo, minha.concat(novos));
    return novos.length;
  }

  // ------------------------------------------------------- o formulário

  function campoHtml(c) {
    var id = "mm-" + c.chave;
    var rot = c.rotulo ? '<label for="' + id + '">' + escapeXml(c.rotulo) +
      (c.obrigatorio ? ' <span class="mm-obrig">obrigatório</span>' : "") + "</label>" : "";
    var corpo;
    if (c.tipo === "escolha") {
      corpo = '<select id="' + id + '" class="plain">' + c.opcoes.map(function (o) {
        return '<option value="' + escapeXml(o) + '">' + escapeXml(o) + "</option>";
      }).join("") + "</select>";
    } else if (c.tipo === "sim-nao") {
      corpo = '<label class="mm-check"><input type="checkbox" id="' + id + '"> sim</label>';
    } else if (c.tipo === "numero") {
      corpo = '<div class="inputgroup"><input id="' + id + '" type="number" inputmode="decimal"' +
        (c.min !== undefined ? ' min="' + c.min + '"' : "") +
        (c.passo ? ' step="' + c.passo + '"' : "") + ' autocomplete="off">' +
        (c.unidade ? '<span class="unit">' + escapeXml(c.unidade) + "</span>" : "") + "</div>";
    } else {
      corpo = '<input id="' + id + '" type="text" autocomplete="off"' +
        (c.placeholder ? ' placeholder="' + escapeXml(c.placeholder) + '"' : "") + ">";
    }
    return '<div class="mm-campo">' + rot + corpo +
      (c.dica ? '<div class="hint">' + escapeXml(c.dica) + "</div>" : "") + "</div>";
  }

  function caixa() {
    var d = document.getElementById("mm-dialog");
    if (d) return d;
    d = document.createElement("dialog");
    d.id = "mm-dialog";
    d.className = "mm-dialog";
    document.body.appendChild(d);
    // Clicar fora fecha, como as outras caixas desta app.
    d.addEventListener("click", function (e) {
      if (e.target !== d) return;
      var r = d.getBoundingClientRect();
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) d.close();
    });
    return d;
  }

  /**
   * Abre o formulário, e devolve o modelo pelo `aoGuardar`.
   *
   * `sugestoes` é o que a app já sabe do que está no ecrã — a diagonal e o
   * formato que a pessoa escreveu na aba antes de ir procurar o modelo. Não
   * é adivinhar nada: é não fazer escrever duas vezes o mesmo número.
   */
  function pedirModeloNovo(tipo, nomeEscrito, aoGuardar, sugestoes) {
    var def = CAMPOS_POR_TIPO[tipo];
    if (!def) return;
    var d = caixa();
    d.innerHTML =
      '<form method="dialog" class="mm-form">' +
      "<h3>" + escapeXml(def.titulo) + "</h3>" +
      '<p class="hint mm-aviso">Os números são teus: a app não inventa fichas. ' +
      "O que escreveres aqui vai para a folha de montagem tal como está — " +
      "por isso vale a pena ter a ficha do fabricante aberta ao lado.</p>" +
      def.campos.map(campoHtml).join("") +
      '<p class="mm-erro" hidden></p>' +
      '<div class="mm-botoes">' +
      '<button type="button" class="copy" id="mm-cancelar">Cancelar</button>' +
      '<button type="button" class="copy mm-principal" id="mm-guardar">Acrescentar à lista</button>' +
      "</div></form>";

    var apanhar = {};
    def.campos.forEach(function (c) { apanhar[c.chave] = document.getElementById("mm-" + c.chave); });
    if (apanhar.modelo) apanhar.modelo.value = nomeEscrito || "";
    (sugestoes && Object.keys(sugestoes) || []).forEach(function (k) {
      var el = apanhar[k];
      if (!el || sugestoes[k] == null || sugestoes[k] === "") return;
      if (el.type === "checkbox") el.checked = !!sugestoes[k]; else el.value = sugestoes[k];
    });

    var erro = d.querySelector(".mm-erro");
    function falhar(texto, campo) {
      erro.textContent = texto;
      erro.hidden = false;
      if (campo) campo.focus();
    }

    d.querySelector("#mm-cancelar").addEventListener("click", function () { d.close(); });
    d.querySelector("#mm-guardar").addEventListener("click", function () {
      var nome = (apanhar.modelo.value || "").trim();
      if (!nome) return falhar("Falta o nome do modelo.", apanhar.modelo);
      var diag = parseFloat(apanhar.diag.value);
      if (!(diag > 0)) return falhar("Falta a diagonal — sem ela não há medida nenhuma a calcular.", apanhar.diag);
      // A resolução é opcional, mas OU SE ESCREVEM OS DOIS LADOS OU NENHUM:
      // metade de uma resolução não é uma resolução, é um engano à espera.
      var rx = parseFloat(apanhar.rx.value), ry = parseFloat(apanhar.ry.value);
      if ((rx > 0) !== (ry > 0)) {
        return falhar("A resolução precisa dos dois lados — ou escreve os dois, ou deixa os dois em branco.",
          rx > 0 ? apanhar.ry : apanhar.rx);
      }
      var modelo = {
        modelo: nome,
        diag: diag,
        ratio: apanhar.ratio.value || "16:9",
        resolucao: (rx > 0 && ry > 0) ? { rx: rx, ry: ry } : null,
        touchscreen: !!apanhar.touchscreen.checked,
        fonte: (apanhar.fonte.value || "").trim() || null,
        meu: true,
        acrescentadoEm: new Date().toISOString().slice(0, 10)
      };
      acrescentar(tipo, modelo);
      d.close();
      if (typeof aoGuardar === "function") aoGuardar(modelo);
    });

    d.showModal();
    if (apanhar.diag && !apanhar.diag.value) apanhar.diag.focus();
  }

  /** A linha do catálogo, pronta a entrar no data/tvs.json. */
  function linhaDeCatalogo(m) {
    return JSON.stringify({
      modelo: m.modelo, diag: m.diag, ratio: m.ratio,
      resolucao: m.resolucao || null,
      touchscreen: !!m.touchscreen,
      fonte: m.fonte || null
    });
  }

  /**
   * AS MARCAS SOLTAS QUE JÁ FICARAM NA LISTA.
   *
   * Uma regra nova não desfaz o que a antiga já escreveu. Isto apaga, à
   * entrada, só o que a app criou sozinha e não serve para nada: sem número
   * no nome, marcado como automático, sem resolução e sem fonte. Um modelo
   * que alguém completou à mão, ou que veio da web, tem sempre uma dessas
   * coisas — e não é tocado.
   */
  function limparMarcasSoltas(tipo) {
    var lista = ler(tipo);
    var fica = lista.filter(function (m) {
      if (!m || !m.auto) return true;            // escrito à mão ou vindo da web
      if (m.resolucao || m.fonte) return true;   // alguém completou a ficha
      return temNumero(m.modelo);
    });
    if (fica.length !== lista.length) escrever(tipo, fica);
    return lista.length - fica.length;
  }

  // À entrada, uma vez. Antes de qualquer lista ser desenhada.
  try { limparMarcasSoltas("tv"); } catch (_) {}

  window.meusModelos = {
    ler: ler, acrescentar: acrescentar, remover: remover,
    importar: importar, linhaDeCatalogo: linhaDeCatalogo,
    diagonalNoTexto: diagonalNoTexto, acrescentarAutomatico: acrescentarAutomatico,
    procurarNaWeb: procurarNaWeb, acrescentarDaWeb: acrescentarDaWeb,
    temNumero: temNumero, limparMarcasSoltas: limparMarcasSoltas
  };
  window.pedirModeloNovo = pedirModeloNovo;
})();
