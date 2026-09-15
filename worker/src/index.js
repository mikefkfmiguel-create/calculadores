// Cloudflare Worker — proxy seguro para a API da Anthropic.
//
// Porquê isto existe: a app (index.html) é só ficheiros estáticos no GitHub
// Pages — não há onde guardar uma chave de API em segurança no browser
// (qualquer visitante veria o código-fonte). Este Worker fica entre a app e
// a Anthropic: recebe a descrição/documento do projeto, chama a API com a
// chave guardada aqui como secret (nunca no código), e devolve só os dados
// extraídos.
//
// A app NUNCA aplica estes valores diretamente às calculadoras sem o
// utilizador confirmar/editar primeiro (ver assistente.js) — o modelo pode
// falhar a leitura de um documento, e os valores usados na ficha técnica
// têm de ser sempre os confirmados por uma pessoa.

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
// Haiku é suficiente e mais barato para extração estruturada; troca para
// "claude-sonnet-4-5" se a qualidade de leitura em documentos mais
// complexos/mal formatados não for suficiente.
const MODEL = "claude-haiku-4-5";

const EXTRACT_TOOL = {
  name: "extrair_requisitos_projeto",
  description:
    "Regista os requisitos de um projeto de AV (ecrã LED, projeção, ou blending multi-projetor) extraídos do texto/documento/imagem fornecidos. Usa null em qualquer campo que não esteja explícito ou claramente implícito no texto — nunca adivinhes ou inventes valores técnicos. Uma imagem (foto/render) nunca tem escala fiável — serve só para identificar visualmente o tipo de tecnologia, nunca para medir tamanhos, distâncias ou qualquer outro valor numérico.",
  input_schema: {
    type: "object",
    properties: {
      tipoEcra: {
        type: "string",
        enum: ["led", "projecao", "blend", "misto", "desconhecido"],
        description: "Tecnologia de ecrã pedida EXPLICITAMENTE no texto (ex: 'ecrã LED', 'projetor', 'blending multi-projetor'). NUNCA adivinhes qual seria a mais adequada para o caso descrito — usa sempre 'desconhecido' quando o texto não pedir uma tecnologia em concreto, mesmo que descreva a sala/plateia e peça sugestão de ecrã ou de quantos/que tamanho usar. Essa sugestão é calculada depois do lado da calculadora, com dados reais de equipamento — não aqui.",
      },
      confianca: {
        type: "string",
        enum: ["alta", "media", "baixa"],
        description: "Confiança geral desta extração — 'baixa' se o texto for vago ou ambíguo.",
      },
      dimensoes: {
        type: "object",
        description: "Medidas do PRÓPRIO ECRÃ pretendido — nunca da sala, palco, parede ou espaço disponível. Um texto pode dar as duas coisas (ex: 'sala com 30x4m, quero um ecrã') — usa aqui só a medida explicitamente atribuída ao ecrã. Se o texto só descrever o espaço/sala e pedir sugestão de ecrã, sem indicar o tamanho do ecrã em si, deixa todos os campos aqui a null (a pessoa decide o tamanho depois, na calculadora).",
        properties: {
          larguraM: { type: ["number", "null"], description: "Largura do ECRÃ (não da sala/espaço) em metros, se indicada." },
          alturaM: { type: ["number", "null"], description: "Altura do ECRÃ (não da sala/espaço) em metros, se indicada." },
          diagonalPolegadas: { type: ["number", "null"], description: "Diagonal do ecrã em polegadas, se for essa a medida dada (ex: projeção)." },
          formato: { type: ["string", "null"], description: "Relação de aspeto do ecrã, ex: '16:9', '21:9'." },
        },
        required: ["larguraM", "alturaM", "diagonalPolegadas", "formato"],
        additionalProperties: false,
      },
      local: {
        type: "object",
        properties: {
          distanciaProjecaoM: { type: ["number", "null"], description: "Distância disponível entre projetor/lente e ecrã, se indicada (só relevante para projeção)." },
          distanciaVisualizacaoM: { type: ["number", "null"], description: "Distância do público mais afastado ao ecrã. Se não estiver indicada diretamente mas o texto der as dimensões da sala/espaço (largura x profundidade), usa a profundidade da sala como estimativa razoável — assume-se o ecrã numa das paredes e o público a ocupar o espaço até à parede oposta. Só fica null se não houver distância nem dimensões de sala nenhumas no texto." },
          larguraPlateiaM: { type: ["number", "null"], description: "Largura da plateia/audiência (fila de lugares) em metros — usada só para verificar o ângulo lateral dos lugares mais afastados do centro do ecrã. NÃO é a largura do ecrã (isso vai em dimensoes.larguraM). Se o texto não indicar a largura da plateia à parte mas der a largura da sala/espaço, usa essa largura da sala como estimativa (assume-se que a plateia ocupa a largura disponível) — só fica null se não houver largura de plateia nem dimensões de sala nenhumas." },
          alturaSalaM: { type: ["number", "null"], description: "Altura do teto/pé-direito da sala ou espaço em metros, se indicada — usada só para verificar se um ecrã do tamanho recomendado cabe no espaço disponível. NÃO é a altura do ecrã (isso vai em dimensoes.alturaM)." },
          interior: { type: ["boolean", "null"], description: "true=interior, false=exterior, null=não indicado." },
          curvo: { type: ["boolean", "null"], description: "Se o ecrã deve ser curvo." },
          salaLarguraM: { type: ["number", "null"], description: "Largura do próprio ESPAÇO/SALA em metros, só quando o texto a der DIRETAMENTE (ex: 'sala de 24 por 18 metros', 'espaço com 24m de largura'). Distinta de larguraPlateiaM: a plateia pode ocupar só parte da sala, e este campo é sempre a sala inteira. null quando o texto só der a largura da plateia/audiência, sem falar da sala em si." },
          salaProfundidadeM: { type: ["number", "null"], description: "Profundidade do próprio ESPAÇO/SALA em metros, só quando o texto a der DIRETAMENTE. Distinta de distanciaVisualizacaoM (que é a distância até ao público mais afastado, não a profundidade total da sala — a sala costuma ter mais alguns metros para além da última fila)." },
          numeroParticipantes: { type: ["number", "null"], description: "Número de PESSOAS/participantes/lugares para o evento, se o texto o disser (ex: 'evento para 300 pessoas', '150 convidados'). É só uma contagem de gente — NUNCA uses isto para calcular ou adivinhar nenhuma medida física (sala, plateia, distância); quem faz essa conta, com uma norma real, é a calculadora do lado de lá. Fica null se o texto não der nenhum número de pessoas." },
          publicoEmPe: { type: ["boolean", "null"], description: "true SÓ quando o texto disser EXPLICITAMENTE que o público está de pé (ex: 'de pé', 'em pé', 'standing', 'cocktail', 'sem lugares sentados'). false SÓ quando disser explicitamente que está sentado/com cadeiras/lugares marcados. null quando o texto não disser nada sobre isto — NUNCA adivinhes a partir do tipo de evento (uma gala normalmente é sentada, mas não presumas, só uses o que o texto disser)." },
          plateiaComMesas: { type: ["boolean", "null"], description: "true SÓ quando o texto disser EXPLICITAMENTE que o público fica sentado ÀS MESAS (ex: 'mesas redondas de 10', 'mesas meia lua de 6 pessoas', 'jantar', 'banquete', 'gala com mesas'). Uma plateia às mesas ocupa mais do dobro do chão por pessoa do que cadeiras em filas, e é a calculadora do lado de lá que faz essa conta com a norma — aqui só se regista o que o texto diz. false quando o texto disser que são cadeiras em filas/plateia de auditório sem mesas. null quando não disser nada — NUNCA adivinhes a partir do tipo de evento (nem toda a gala tem mesas; não presumas)." },
        },
        required: ["distanciaProjecaoM", "distanciaVisualizacaoM", "larguraPlateiaM", "alturaSalaM", "interior", "curvo", "salaLarguraM", "salaProfundidadeM", "numeroParticipantes", "publicoEmPe", "plateiaComMesas"],
        additionalProperties: false,
      },
      led: {
        type: "object",
        properties: {
          pixelPitchMm: { type: ["number", "null"], description: "Pixel pitch pedido em mm, se indicado." },
          brilhoNits: { type: ["number", "null"], description: "Brilho mínimo pedido em nits, se indicado." },
        },
        required: ["pixelPitchMm", "brilhoNits"],
        additionalProperties: false,
      },
      orcamento: {
        type: "object",
        properties: {
          valor: { type: ["number", "null"] },
          moeda: { type: ["string", "null"], description: "Ex: 'EUR', 'USD'." },
        },
        required: ["valor", "moeda"],
        additionalProperties: false,
      },
      projeto: {
        type: "object",
        properties: {
          nome: { type: ["string", "null"], description: "Nome do evento/projeto/cliente, se identificável (ex: título do documento, nome do evento mencionado). null se não estiver claro — nunca inventes um nome." },
          dataInicio: { type: ["string", "null"], description: "Data de início do evento, em formato AAAA-MM-DD, se indicada." },
          dataFim: { type: ["string", "null"], description: "Data de fim do evento, em formato AAAA-MM-DD. Se só houver uma data (evento de um dia), repete aqui o mesmo valor de dataInicio." },
        },
        required: ["nome", "dataInicio", "dataFim"],
        additionalProperties: false,
      },
      resumo: {
        type: "string",
        description: "Resumo curto em português (2-4 frases) do que foi pedido, para o utilizador confirmar rapidamente que a leitura está correta. Se houver uma imagem em anexo, descreve aqui o que ela mostra (ex: tipo de ecrã/montagem visível) — deixando claro que é uma leitura visual, sem medidas.",
      },
      pontosPorConfirmar: {
        type: "array",
        items: { type: "string" },
        description: "Lista MUITO curta (0 a 2 itens, idealmente vazia) — só ambiguidades reais ou contradições no texto que impedem escolher o equipamento certo (ex: o texto dá duas medidas diferentes para o mesmo ecrã). NÃO listes aqui um dado simplesmente não mencionado (orçamento, brilho, pixel pitch, se é curvo, formato) — isso fica null nos campos próprios, sem aviso; a pessoa já vê o que ficou em branco nos campos.",
      },
      grupos: {
        type: "array",
        description: "Só quando o texto descrever MAIS DO QUE UM tamanho de ecrã dentro do mesmo projeto (ex: '2 ecrãs maiores para PowerPoint e 2 menores para imagem'). Cada item é um grupo de ecrãs do MESMO tamanho e finalidade. Deixa [] (vazio) quando o pedido só tem um tamanho, ou nenhum — nesse caso os campos 'dimensoes' normais já bastam. NUNCA inventes uma divisão em grupos que o texto não faça.",
        items: {
          type: "object",
          properties: {
            quantidade: { type: "integer", description: "Quantos ecrãs tem este grupo." },
            tamanhoRelativo: {
              type: "string",
              enum: ["maior", "igual", "menor"],
              description: "O tamanho deste grupo COMPARADO com os outros grupos do mesmo pedido — não um valor absoluto em metros. Usa 'igual' quando o texto não distinguir tamanhos entre os grupos, só finalidades diferentes.",
            },
            finalidade: { type: ["string", "null"], description: "Para que serve este grupo, tal como o texto descreve, em poucas palavras (ex: 'PowerPoint', 'imagem', 'vídeo secundário'). null se o texto não disser." },
          },
          required: ["quantidade", "tamanhoRelativo", "finalidade"],
          additionalProperties: false,
        },
      },
    },
    required: ["tipoEcra", "confianca", "dimensoes", "local", "led", "orcamento", "projeto", "resumo", "pontosPorConfirmar", "grupos"],
    additionalProperties: false,
  },
};

function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
  };
}

function isAllowedOrigin(origin, allowedOrigins) {
  return !!origin && allowedOrigins.includes(origin);
}

// ---------------------------------------------------------- link "só para ver"
//
// O Preview manda cá o projeto todo (sala, palco, público, ajustes — o mesmo
// que "Guardar projeto" grava num ficheiro) e recebe um id curto de volta.
// Quem tiver o link lê o projeto por esse id, sem falar com o aparelho de
// quem o criou nem com os Calculadores — só o Worker fica no meio, e só até o
// KV apagar sozinho passados os dias da validade. O id é o único segredo (60
// bits de aleatoriedade): como um link do Drive "quem tiver o link, vê".

// 1 dia, não 7 -- pedido direto depois de o Preview passar a mandar
// projetos com várias fotos (mesmo reduzidas, um projeto de 11 ecrãs com
// imagem em cada um ainda pode somar alguns MB): uma validade mais curta
// mantém o KV com menos partilhas antigas por apagar, sem o link deixar de
// servir o que é para servir -- mandar a alguém ver a sala num dia ou dois.
const PARTILHA_VALIDADE_SEGUNDOS = 1 * 24 * 60 * 60; // 1 dia
// As imagens que se põe nos ecrãs/DSM (Preview) viajam aqui dentro como data
// URL, dentro do próprio projeto -- um projeto sem nenhuma cabia perto de
// 300KB, mas várias fotos (mesmo reduzidas e convertidas para JPEG do lado
// do Preview) ainda podem somar alguns MB num projeto com muitos ecrãs.
// 16MB dá espaço a isso com folga, ainda bem abaixo do limite de valor do
// KV (25MB) e do limite de corpo de pedido do Worker.
const PARTILHA_TAMANHO_MAXIMO = 16 * 1024 * 1024;
// Sem 0/O/1/l/I — para ninguém confundir letra com número a ditar um link.
const ALFABETO_ID = "23456789abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ";

function novoIdPartilha() {
  const bytes = new Uint8Array(10);
  crypto.getRandomValues(bytes);
  let id = "";
  for (const b of bytes) id += ALFABETO_ID[b % ALFABETO_ID.length];
  return id;
}

async function criarPartilha(request, env, origin) {
  if (!env.PARTILHAS) {
    return new Response(JSON.stringify({ error: "Worker sem armazenamento configurado (KV PARTILHAS)." }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
    });
  }
  let body;
  try {
    body = await request.json();
  } catch (e) {
    return new Response(JSON.stringify({ error: "Pedido inválido (JSON em falta ou mal formado)." }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
    });
  }
  const estado = body && body.estado;
  if (!estado || typeof estado !== "object") {
    return new Response(JSON.stringify({ error: "Falta o projeto a partilhar." }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
    });
  }
  const texto = JSON.stringify(estado);
  if (texto.length > PARTILHA_TAMANHO_MAXIMO) {
    return new Response(JSON.stringify({ error: "Projeto demasiado grande para partilhar." }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
    });
  }
  const id = novoIdPartilha();
  await env.PARTILHAS.put(id, texto, { expirationTtl: PARTILHA_VALIDADE_SEGUNDOS });
  return new Response(JSON.stringify({ id }), {
    status: 200,
    headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
  });
}

async function lerPartilha(id, env, origin) {
  if (!env.PARTILHAS) {
    return new Response(JSON.stringify({ error: "Worker sem armazenamento configurado (KV PARTILHAS)." }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
    });
  }
  const texto = id ? await env.PARTILHAS.get(id) : null;
  if (!texto) {
    return new Response(JSON.stringify({ error: "Este link já não existe — ou passou a validade (1 dia), ou nunca existiu." }), {
      status: 404,
      headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
    });
  }
  let estado;
  try {
    estado = JSON.parse(texto);
  } catch (e) {
    return new Response(JSON.stringify({ error: "Este link ficou com dados corrompidos." }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
    });
  }
  return new Response(JSON.stringify({ estado }), {
    status: 200,
    headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
  });
}

// ------------------------------------------------------- registo de pedidos
//
// Cada pedido ao Assistente (texto + o que a IA extraiu) fica guardado aqui
// por um tempo -- não para nada automático, é para revisão manual: sítios
// onde o pedido real difere do que a IA percebeu ficam visíveis, e viram
// regras novas no EXTRACT_TOOL (como aconteceu com "de pé" e "300 pessoas").
// Pedido directo do mike: "tem de ir aprendendo... podemos montar uma skill
// para isso". A imagem em si NUNCA fica guardada aqui (só se foi ou não
// anexada) -- só o texto e o que saiu da IA.
const REGISTO_VALIDADE_SEGUNDOS = 30 * 24 * 60 * 60; // 30 dias

async function listarRegistos(request, env) {
  const auth = request.headers.get("Authorization") || "";
  if (!env.ADMIN_TOKEN || auth !== "Bearer " + env.ADMIN_TOKEN) {
    return new Response(JSON.stringify({ error: "Não autorizado." }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }
  if (!env.REGISTOS) {
    return new Response(JSON.stringify({ error: "Worker sem armazenamento configurado (KV REGISTOS)." }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
  const lista = await env.REGISTOS.list({ limit: 500 });
  const registos = await Promise.all(
    lista.keys.map(async (k) => {
      const bruto = await env.REGISTOS.get(k.name);
      try {
        return JSON.parse(bruto);
      } catch (e) {
        return null;
      }
    })
  );
  // Mais recentes primeiro -- as chaves começam pela data ISO, por isso a
  // ordem alfabética que o KV já devolve é também a ordem cronológica.
  const validos = registos.filter(Boolean).reverse();
  return new Response(JSON.stringify({ total: validos.length, registos: validos }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

// ------------------------------------------------- trava de gasto da IA
//
// PORQUÊ: o endereço deste Worker está escrito no index.html que o GitHub
// Pages serve a toda a gente -- quem abrir o código-fonte da página vê-o. E a
// defesa que cá estava, o ALLOWED_ORIGINS, NÃO chega para isto: o `Origin` é
// um cabeçalho do pedido, um browser preenche-o honestamente e não deixa
// mexer nele, mas um `curl` escreve lá o que lhe apetecer numa linha. O
// comentário do wrangler.toml dizia que aquilo bloqueava pedidos diretos, e
// era optimismo.
//
// Os limites que já existiam são de TAMANHO por pedido (20 000 caracteres,
// 10 MB de PDF). Limitam o que cada chamada custa, não QUANTAS chamadas se
// fazem -- mil pedidos pequenos passavam todos, e cada um gasta da conta da
// Anthropic.
//
// ISTO É SÓ PARA A ROTA DA IA. A rota /uso (contagem de visitas) não fala com
// a Anthropic nem custa nada por chamada: escreve uma linha na KV e acabou.
// Não leva trava nenhuma.
//
// DUAS TRAVAS, e a segunda é a que interessa:
//
//   1. POR ENDEREÇO (IP), por dia -- trava o abuso casual. O IP vem do
//      cabeçalho que a CLOUDFLARE escreve, a partir da ligação de rede: ao
//      contrário do Origin, quem chama não tem como mentir nele.
//   2. TOTAL DO DIA, de toda a gente somada -- é esta que protege a factura.
//      Aconteça o que acontecer (abuso, um erro que ponha a app a chamar em
//      ciclo), o pior dia possível tem um preço conhecido.
//
// O QUE ISTO NÃO RESOLVE, e é preciso estar escrito: quem tiver muitos
// endereços contorna a primeira -- é uma lomba, não um cadeado. E do lado de
// dentro há a tensão oposta: toda a gente no escritório da AVK sai com o
// MESMO endereço, e para o Worker são uma pessoa só. Por isso o limite por IP
// é largo; a trava a sério é a do total.
//
// Os contadores vivem na KV USO (prefixo "lim:"), e não numa KV nova, por uma
// razão prática: criar um namespace obriga alguém a ir ao wrangler ou ao
// painel. O resumoDeUso() lista por prefixo "d:", por isso nunca os vê.
//
// RIGOR DA CONTAGEM: o KV é eventualmente consistente, e ler-somar-escrever
// pode perder uma contagem quando dois pedidos chegam ao mesmo tempo. Para um
// tecto de gasto isso chega -- é um travão com folga, não um livro de contas.
const LIM_VALIDADE_SEGUNDOS = 2 * 24 * 60 * 60;

function limiteDe(env, nome, porOmissao) {
  const n = parseInt(env[nome], 10);
  return (isFinite(n) && n > 0) ? n : porOmissao;
}

async function contadorDe(env, chave) {
  try {
    const n = parseInt(await env.USO.get(chave), 10);
    return isFinite(n) ? n : 0;
  } catch (e) { return 0; }
}

/**
 * Corre ANTES de chamar a Anthropic. Devolve uma Response quando o pedido
 * tem de ser travado, ou null quando pode seguir.
 *
 * Sem KV configurada NÃO trava: um Worker mal configurado deixar de responder
 * ao Assistente seria pior do que o risco que isto cobre -- e o risco
 * continua reportado no /uso/resumo, que diz logo que não há armazenamento.
 */
async function travaDeGasto(request, env) {
  if (!env.USO) return null;

  const dia = new Date().toISOString().slice(0, 10);
  const ip = request.headers.get("CF-Connecting-IP") || "sem-ip";
  const chaveIp = "lim:ip:" + dia + ":" + ip;
  const chaveDia = "lim:dia:" + dia;

  const [doIp, doDia] = await Promise.all([contadorDe(env, chaveIp), contadorDe(env, chaveDia)]);
  const limiteIp = limiteDe(env, "LIMITE_IA_POR_IP", 30);
  const limiteDia = limiteDe(env, "LIMITE_IA_POR_DIA", 200);

  // A mensagem diz o que aconteceu e o que fazer, por palavras -- a app
  // mostra-a tal e qual ("Erro: ..."), e um 429 seco não ajudava ninguém.
  if (doDia >= limiteDia) {
    return new Response(JSON.stringify({
      error: "O Assistente atingiu o limite de pedidos de hoje (" + limiteDia +
             "). Volta amanhã, ou sobe o LIMITE_IA_POR_DIA no Worker."
    }), { status: 429, headers: { "Content-Type": "application/json" } });
  }
  if (doIp >= limiteIp) {
    return new Response(JSON.stringify({
      error: "Já foram feitos " + limiteIp + " pedidos ao Assistente hoje a partir desta ligação. " +
             "Volta amanhã, ou sobe o LIMITE_IA_POR_IP no Worker."
    }), { status: 429, headers: { "Content-Type": "application/json" } });
  }

  // Só se conta o que vai mesmo gastar dinheiro: a soma acontece aqui, à
  // beira da chamada à Anthropic, e não à entrada do Worker. Um pedido
  // malformado, que nunca chega à API, não consome a quota de ninguém.
  await Promise.all([
    env.USO.put(chaveIp, String(doIp + 1), { expirationTtl: LIM_VALIDADE_SEGUNDOS }),
    env.USO.put(chaveDia, String(doDia + 1), { expirationTtl: LIM_VALIDADE_SEGUNDOS }),
  ]);
  return null;
}

// ------------------------------------------------------ contagem de uso
//
// PORQUÊ: o GitHub Pages não dá registos nenhuns, por isso até aqui não havia
// maneira de saber se a app é usada por três pessoas ou por trinta -- e é a
// adivinhar que se decidia o que polir a seguir. A pergunta concreta que isto
// responde, além de "quantos": QUE ABAS é que são abertas. O Dome tem 121
// trechos por traduzir, o maior bloco que resta; se ninguém abre o Dome, isso
// não se traduz.
//
// A REGRA, e não é negociável: conta-se QUANTOS, nunca QUEM. O `id` é um
// número aleatório gerado pela própria app à primeira vez -- não é uma
// pessoa, é uma cópia instalada da app, e quem limpar os dados do browser
// passa a contar como nova. Não se guarda IP, nem país, nem browser, nem nada
// escrito nos campos: um projeto é do cliente de quem o está a fazer.
//
// A data vem do relógio DESTE Worker e não do aparelho -- um telemóvel com a
// data trocada não estraga a contagem de ninguém.
const USO_VALIDADE_SEGUNDOS = 90 * 24 * 60 * 60; // 90 dias
const USO_APPS = ["calculadores", "preview"];
// Lista FECHADA: o Worker nunca guarda um nome de aba que não conheça. Sem
// isto, um pedido forjado podia encher o KV com o que lhe apetecesse.
const USO_ABAS = [
  "menu", "assistente", "projecao", "blend", "dome", "visualizacao", "tv",
  "led", "zonas", "sinal", "mediaserver", "projeto", "lentes", "grafismo", "ajuda",
];
const USO_UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const USO_VERSAO_RE = /^v[0-9][0-9.]{0,10}$/;

function respostaUso(corpo, status, origin) {
  return new Response(JSON.stringify(corpo), {
    status: status,
    headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
  });
}

/**
 * POST /uso — a app diz "estou a ser usada", uma vez por dia no máximo.
 *
 * Um pedido malformado leva 400 com a razão, e NÃO um 204 calado, ao
 * contrário do que o PLANO-CONTAGEM.md dizia. Mudou-se de ideias a escrever
 * isto, e por uma razão que esta app já aprendeu à sua custa: se o formato do
 * pedido tiver um erro, a contagem fica a zero e nada diz porquê -- é o
 * defeito do "silêncio" outra vez, agora virado para dentro. O 400 não revela
 * nada a ninguém (o que está aqui já está no código da app, que é público) e
 * aparece na consola de quem estiver a mexer.
 */
async function contarUso(request, env, origin) {
  if (!env.USO) return respostaUso({ error: "Worker sem armazenamento de uso (KV USO)." }, 500, origin);

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return respostaUso({ error: "JSON em falta ou mal formado." }, 400, origin);
  }

  const app = USO_APPS.includes(body && body.app) ? body.app : "";
  if (!app) return respostaUso({ error: "Campo 'app' desconhecido." }, 400, origin);

  const id = typeof body.id === "string" && USO_UUID_RE.test(body.id) ? body.id.toLowerCase() : "";
  if (!id) return respostaUso({ error: "Campo 'id' tem de ser um UUID." }, 400, origin);

  const versao = typeof body.versao === "string" && USO_VERSAO_RE.test(body.versao) ? body.versao : "";

  // Abas: no máximo 20, só as conhecidas, sem repetições.
  const abas = [];
  if (Array.isArray(body.abas)) {
    for (const a of body.abas.slice(0, 20)) {
      if (USO_ABAS.includes(a) && !abas.includes(a)) abas.push(a);
    }
  }

  // A chave carrega o dia, a app e o id -- de propósito: contar aparelhos
  // distintos passa a ser só listar nomes de chaves, sem ler valor nenhum.
  const dia = new Date().toISOString().slice(0, 10);
  const chave = "d:" + dia + ":" + app + ":" + id;

  // Juntar às abas que já tinham chegado hoje deste mesmo aparelho, em vez de
  // as substituir: quem abre a app de manhã e à tarde não perde a manhã.
  let jaHoje = [];
  try {
    const bruto = await env.USO.get(chave);
    if (bruto) {
      const anterior = JSON.parse(bruto);
      if (Array.isArray(anterior.a)) jaHoje = anterior.a;
    }
  } catch (e) {
    jaHoje = [];
  }
  for (const a of jaHoje) if (!abas.includes(a) && USO_ABAS.includes(a)) abas.push(a);

  await env.USO.put(chave, JSON.stringify({ v: versao, a: abas }), {
    expirationTtl: USO_VALIDADE_SEGUNDOS,
  });

  return respostaUso({ ok: true }, 200, origin);
}

/**
 * A CONTA, num sítio só.
 *
 * Serve o /uso/resumo (JSON, para scripts e para o balanço semanal) E o
 * /uso/painel (a página que se abre no telemóvel). Estar aqui e não duplicada
 * é o que garante que os dois nunca discordam -- que é o defeito que esta casa
 * anda a corrigir desde o primeiro dia.
 *
 * Contar aparelhos lê só NOMES de chaves (a chave carrega o dia, a app e o
 * id); as abas custam uma leitura por chave, por isso só saem se forem
 * pedidas.
 */
async function contasDeUso(env, dias, comAbas) {
  const hoje = new Date();
  const porApp = {};
  const abasContadas = {};
  const porDia = {};

  for (let i = 0; i < dias; i++) {
    const d = new Date(hoje.getTime() - i * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    let cursor;
    do {
      // Uma listagem por dia, com prefixo — muito mais barato do que varrer
      // tudo e filtrar. O cursor existe porque o KV devolve 1000 de cada vez.
      const pagina = await env.USO.list({ prefix: "d:" + d + ":", limit: 1000, cursor: cursor });
      for (const k of pagina.keys) {
        const partes = k.name.split(":");
        const app = partes[2] || "?";
        const id = partes[3] || "";
        if (!porApp[app]) porApp[app] = new Set();
        porApp[app].add(id);
        if (!porDia[d]) porDia[d] = new Set();
        porDia[d].add(app + ":" + id);
        if (comAbas) {
          try {
            const bruto = await env.USO.get(k.name);
            const v = bruto ? JSON.parse(bruto) : null;
            if (v && Array.isArray(v.a)) {
              for (const a of v.a) abasContadas[a] = (abasContadas[a] || 0) + 1;
            }
          } catch (e) {
            // uma linha ilegível não pode derrubar o resumo todo
          }
        }
      }
      cursor = pagina.list_complete ? null : pagina.cursor;
    } while (cursor);
  }

  const aparelhos = {};
  for (const app of Object.keys(porApp)) aparelhos[app] = porApp[app].size;
  const diario = {};
  for (const d of Object.keys(porDia).sort()) diario[d] = porDia[d].size;
  return { dias: dias, aparelhos: aparelhos, porDia: diario, abas: comAbas ? abasContadas : undefined };
}

function diasPedidos(url) {
  let dias = parseInt(url.searchParams.get("dias") || "7", 10);
  if (!isFinite(dias) || dias < 1) dias = 7;
  if (dias > 90) dias = 90;
  return dias;
}

/**
 * GET /uso/resumo?dias=7[&abas=1] — JSON, protegido pelo mesmo ADMIN_TOKEN do
 * /registos, no cabeçalho. Para scripts e para o balanço semanal.
 */
async function resumoDeUso(request, env) {
  const auth = request.headers.get("Authorization") || "";
  if (!env.ADMIN_TOKEN || auth !== "Bearer " + env.ADMIN_TOKEN) {
    return new Response(JSON.stringify({ error: "Não autorizado." }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }
  if (!env.USO) {
    return new Response(JSON.stringify({ error: "Worker sem armazenamento de uso (KV USO)." }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
  const url = new URL(request.url);
  const contas = await contasDeUso(env, diasPedidos(url), url.searchParams.get("abas") === "1");
  return new Response(JSON.stringify(contas), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * GET /uso/painel?t=<TOKEN_USO>[&dias=30] — a mesma conta, numa página que se
 * abre no telemóvel.
 *
 * PORQUE É QUE O TOKEN VAI NO ENDEREÇO, E PORQUE É QUE NÃO É O ADMIN_TOKEN.
 *
 * Um browser não manda cabeçalhos quando se abre um link, por isso o
 * /uso/resumo (que pede `Authorization: Bearer`) não serve para isto. A
 * alternativa é o token no endereço -- e aí ele fica no histórico, nos
 * favoritos, e em qualquer sítio para onde o link seja reencaminhado.
 *
 * Por isso este NÃO aceita o ADMIN_TOKEN: esse abre também o /registos, que
 * guarda o TEXTO DOS PEDIDOS REAIS -- briefings de clientes. Um link no
 * telemóvel nunca pode carregar essa chave.
 *
 * O TOKEN_USO é um segredo à parte e só abre isto: contagens de aparelhos e
 * de abas. Se algum dia escapar, o que escapa é saber quantas pessoas abriram
 * uma calculadora -- não um projeto de ninguém.
 *
 * Sem TOKEN_USO definido, a página não se desenrasca com o ADMIN_TOKEN: diz o
 * comando que falta correr. Uma porta que se abre sozinha por conveniência é
 * pior do que uma porta fechada que explica como se abre.
 */
async function painelDeUso(request, env) {
  const url = new URL(request.url);
  const pagina = (corpo, status) => new Response(corpo, {
    status: status || 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      // Nunca indexado, nem guardado por um intermediário: o endereço leva um
      // segredo lá dentro.
      "X-Robots-Tag": "noindex, nofollow",
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer",
    },
  });

  if (!env.TOKEN_USO) {
    return pagina(molduraDoPainel("Falta o token de leitura", `
      <p>Este painel precisa de um segredo próprio, separado do que abre os
      registos do Assistente. No teu computador, uma vez:</p>
      <pre>npx.cmd wrangler secret put TOKEN_USO</pre>
      <p>Escreve uma palavra-passe longa quando ele pedir, e guarda-a. Depois o
      endereço deste painel passa a ser
      <code>/uso/painel?t=<em>essa-palavra</em></code>.</p>`), 503);
  }
  if (url.searchParams.get("t") !== env.TOKEN_USO) {
    return pagina(molduraDoPainel("Não autorizado", `
      <p>Falta o <code>?t=</code> no endereço, ou não bate certo.</p>`), 401);
  }
  if (!env.USO) {
    return pagina(molduraDoPainel("Sem armazenamento", `
      <p>O Worker está publicado sem a KV <code>USO</code>, por isso não há
      contagem nenhuma guardada. Ver o <code>worker/DEPLOY.md</code>.</p>`), 500);
  }

  const dias = diasPedidos(url);
  const c = await contasDeUso(env, dias, true);
  const t = encodeURIComponent(env.TOKEN_USO);

  const apps = Object.keys(c.aparelhos).sort();
  const totalAparelhos = apps.reduce((s, a) => s + c.aparelhos[a], 0);
  const cartoes = apps.length
    ? apps.map((a) => `<div class="cartao"><b>${c.aparelhos[a]}</b><span>${escapar(a)}</span></div>`).join("")
    : `<div class="cartao"><b>0</b><span>ainda nada</span></div>`;

  const diasComDados = Object.keys(c.porDia).sort();
  const maiorDia = diasComDados.reduce((m, d) => Math.max(m, c.porDia[d]), 0) || 1;
  const linhasDias = diasComDados.length
    ? diasComDados.reverse().map((d) => `
        <div class="linha">
          <span class="rot">${escapar(d)}</span>
          <span class="barra"><i style="width:${Math.round((c.porDia[d] / maiorDia) * 100)}%"></i></span>
          <span class="num">${c.porDia[d]}</span>
        </div>`).join("")
    : `<p class="vazio">Nenhum dia com utilização neste período.</p>`;

  const abas = Object.keys(c.abas || {}).sort((a, b) => c.abas[b] - c.abas[a]);
  const maiorAba = abas.length ? c.abas[abas[0]] : 1;
  const linhasAbas = abas.length
    ? abas.map((a) => `
        <div class="linha">
          <span class="rot">${escapar(a)}</span>
          <span class="barra"><i style="width:${Math.round((c.abas[a] / maiorAba) * 100)}%"></i></span>
          <span class="num">${c.abas[a]}</span>
        </div>`).join("")
    : `<p class="vazio">Nenhuma aba registada ainda.</p>`;

  const periodos = [7, 30, 90].map((n) =>
    `<a class="periodo${n === dias ? " activo" : ""}" href="?t=${t}&dias=${n}">${n} dias</a>`).join("");

  return pagina(molduraDoPainel("Movimento", `
    <p class="periodos">${periodos}</p>
    <h2>Aparelhos distintos <span class="leve">· ${dias} dias</span></h2>
    <div class="cartoes">${cartoes}</div>
    <p class="nota">${totalAparelhos === 0
      ? "Ainda não chegou nada. Uma app só conta a partir do momento em que apanha a versão com a contagem, e manda no máximo uma vez por dia."
      : "Cada número é uma <b>cópia instalada</b> da app, não uma pessoa: quem limpar os dados do browser passa a contar como nova, e quem usa telemóvel e PC conta duas vezes."}</p>
    <h2>Por dia</h2>
    <div class="grafico">${linhasDias}</div>
    <h2>Abas abertas</h2>
    <div class="grafico">${linhasAbas}</div>
    <p class="nota">Contam-se <b>aberturas por aparelho e por dia</b>, não visitas: abrir a mesma aba cinco vezes num dia conta uma.</p>
    <p class="rodape">Só de leitura. Sem nomes, sem IP, sem nada do que é escrito nos campos.</p>`));
}

function escapar(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

/** A moldura da página. Sem tipos de letra de fora nem scripts: abre depressa
 *  num telemóvel com má rede, que é onde isto vai ser visto. */
function molduraDoPainel(titulo, corpo) {
  return `<!doctype html><html lang="pt"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${escapar(titulo)} — Mike Apps</title>
<style>
  :root { color-scheme: dark; }
  body { margin:0; padding:22px 18px 40px; background:#0E1418; color:#E6ECF1;
         font:15px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif; }
  .folha { max-width:560px; margin:0 auto; }
  h1 { font-size:21px; margin:0 0 2px; letter-spacing:-.01em; }
  .sub { color:#93A0AB; font-size:13px; margin:0 0 20px; }
  h2 { font-size:13px; text-transform:uppercase; letter-spacing:.09em; color:#93A0AB;
       margin:26px 0 10px; font-weight:600; }
  .leve { text-transform:none; letter-spacing:0; color:#5C6B77; font-weight:400; }
  .periodos { display:flex; gap:8px; margin:0 0 4px; }
  .periodo { flex:1; text-align:center; padding:8px 0; border:1px solid #242E37; border-radius:8px;
             color:#93A0AB; text-decoration:none; font-size:13px; }
  .periodo.activo { border-color:#5AA0DE; color:#5AA0DE; }
  .cartoes { display:flex; gap:10px; flex-wrap:wrap; }
  .cartao { flex:1; min-width:120px; border:1px solid #242E37; border-radius:10px; padding:14px; }
  .cartao b { display:block; font-size:30px; line-height:1.1; font-variant-numeric:tabular-nums; }
  .cartao span { display:block; color:#93A0AB; font-size:12.5px; margin-top:2px; }
  .grafico { display:flex; flex-direction:column; gap:6px; }
  .linha { display:flex; align-items:center; gap:10px; }
  .rot { width:92px; flex:none; color:#93A0AB; font-size:12.5px;
         font-variant-numeric:tabular-nums; overflow:hidden; text-overflow:ellipsis; }
  .barra { flex:1; height:9px; background:#161D24; border-radius:5px; overflow:hidden; }
  .barra i { display:block; height:100%; background:#5AA0DE; }
  .num { width:34px; text-align:right; font-variant-numeric:tabular-nums; font-size:13px; }
  .nota { color:#93A0AB; font-size:12.5px; margin:12px 0 0; }
  .vazio { color:#5C6B77; font-size:13px; margin:0; }
  .rodape { color:#5C6B77; font-size:12px; margin-top:30px; padding-top:14px; border-top:1px solid #242E37; }
  pre { background:#161D24; padding:12px; border-radius:8px; overflow-x:auto; font-size:12.5px; }
  code { background:#161D24; padding:2px 5px; border-radius:4px; font-size:12.5px; }
  b { font-weight:600; }
</style></head><body><div class="folha">
<h1>${escapar(titulo)}</h1>
<p class="sub">Mike Apps · quantos usam, nunca quem</p>
${corpo}
</div></body></html>`;
}

// -------------------------------------------- exemplos parecidos (memória)
//
// Pedido direto: "deve ir guardando os projetos criados como referência para
// sugerir e fazer menos perguntas". Reaproveita o mesmo REGISTOS que já
// existia só para revisão manual (30 dias) -- em vez de servir só a pessoa a
// olhar depois, passa a servir também a própria extração seguinte: antes de
// perguntar à Anthropic, procuram-se aqui pedidos anteriores com texto
// parecido, e esses exemplos (texto + o que foi extraído deles) entram no
// pedido como referência de padrão -- nunca como fonte de valores para o
// projeto atual (isso continua proibido, ver EXTRACT_TOOL e o aviso que
// acompanha os exemplos mais abaixo).
//
// Sem pesquisa semântica nem índice à parte (nada de Vectorize/embeddings) --
// só sobreposição de palavras entre o texto novo e o texto de cada registo
// recente, que chega para apanhar "mesmo local", "mesmo tipo de evento", "case
// idêntico repetido" sem infraestrutura nova nem custo extra por pedido.
const EXEMPLOS_A_CONSIDERAR = 30; // registos recentes a ler (não os 500 todos — custaria 500 leituras KV por pedido)
const EXEMPLOS_A_USAR = 3; // no máximo, dos que tiverem alguma sobreposição real
const PALAVRAS_IGNORAR = new Set([
  "de", "da", "do", "das", "dos", "um", "uma", "uns", "umas", "o", "a", "os", "as",
  "e", "ou", "para", "com", "em", "no", "na", "nos", "nas", "que", "se", "por",
  "como", "mais", "menos", "este", "esta", "esse", "essa", "isso", "isto", "tem",
  "ter", "vai", "são", "ser", "estar", "está", "ao", "aos", "à", "às", "um", "the",
  "and", "for", "with",
]);

function palavrasSignificativas(texto) {
  const semAcentos = (texto || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const palavras = semAcentos.match(/[a-z0-9]+/g) || [];
  return new Set(palavras.filter((p) => p.length > 2 && !PALAVRAS_IGNORAR.has(p)));
}

async function buscarExemplosParecidos(env, textoAtual) {
  if (!env.REGISTOS || !textoAtual) return [];
  const palavrasAtual = palavrasSignificativas(textoAtual);
  if (!palavrasAtual.size) return [];

  let lista;
  try {
    lista = await env.REGISTOS.list({ limit: EXEMPLOS_A_CONSIDERAR });
  } catch (e) {
    return []; // nunca deve impedir a extração normal por causa disto
  }
  if (!lista.keys.length) return [];

  const registos = await Promise.all(
    lista.keys.map(async (k) => {
      try {
        const bruto = await env.REGISTOS.get(k.name);
        return bruto ? JSON.parse(bruto) : null;
      } catch (e) {
        return null;
      }
    })
  );

  const pontuados = registos
    .filter((r) => r && typeof r.texto === "string" && r.texto && r.requisitos)
    .map((r) => {
      const palavrasR = palavrasSignificativas(r.texto);
      let sobrepostas = 0;
      for (const p of palavrasAtual) if (palavrasR.has(p)) sobrepostas++;
      return { registo: r, pontuacao: sobrepostas };
    })
    // Pelo menos 2 palavras significativas em comum -- uma só é fácil de
    // calhar por acaso ("ecrã", "sala") e não indica um caso parecido a sério.
    .filter((p) => p.pontuacao >= 2)
    .sort((a, b) => b.pontuacao - a.pontuacao);

  return pontuados.slice(0, EXEMPLOS_A_USAR).map((p) => p.registo);
}

// ------------------------------------------------- feedback (AV Planner)
//
// Pedido direto: "cria um report bug/sugestions no av planer que junte 5
// mensagens e envie para o meu mail para os feedbacks da malta". Cada
// mensagem fica em KV até haver 5 por enviar; nessa altura junta-se tudo
// num só email (via Resend) e limpa-se — sem cron nem worker à parte, é o
// próprio pedido que faz a conta e dispara o envio quando calha ser o 5º.
const FEEDBACK_LOTE = 5;
const FEEDBACK_DE_EMAIL = "AV Planner <onboarding@resend.dev>";
const FEEDBACK_PARA_EMAIL_OMISSAO = "avkvideoshare@gmail.com";

async function criarFeedback(request, env, origin) {
  if (!env.FEEDBACK) {
    return new Response(JSON.stringify({ error: "Worker sem armazenamento configurado (KV FEEDBACK)." }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
    });
  }
  let body;
  try {
    body = await request.json();
  } catch (e) {
    return new Response(JSON.stringify({ error: "Pedido inválido (JSON em falta ou mal formado)." }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
    });
  }
  const mensagem = typeof body.mensagem === "string" ? body.mensagem.trim() : "";
  const nome = typeof body.nome === "string" ? body.nome.trim().slice(0, 100) : "";
  if (!mensagem) {
    return new Response(JSON.stringify({ error: "Falta a mensagem." }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
    });
  }
  if (mensagem.length > 4000) {
    return new Response(JSON.stringify({ error: "Mensagem demasiado longa (máx. 4000 caracteres)." }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
    });
  }

  const quando = new Date().toISOString();
  const chave = "pendente-" + quando + "-" + crypto.randomUUID();
  await env.FEEDBACK.put(chave, JSON.stringify({ quando, nome: nome || null, mensagem }));

  // Isto NUNCA deve impedir a resposta a quem mandou o feedback — se o
  // envio falhar (chave errada, Resend em baixo), a mensagem fica guardada
  // na mesma, por enviar, à espera da próxima vez que o lote fechar.
  try {
    if (env.RESEND_API_KEY) {
      const lista = await env.FEEDBACK.list({ prefix: "pendente-" });
      if (lista.keys.length >= FEEDBACK_LOTE) {
        const chaves = lista.keys.slice(0, FEEDBACK_LOTE).map((k) => k.name);
        const brutos = await Promise.all(chaves.map((k) => env.FEEDBACK.get(k)));
        const registos = brutos
          .map((t) => { try { return JSON.parse(t); } catch (e) { return null; } })
          .filter(Boolean);
        if (registos.length) {
          const corpo = registos
            .map((r, i) => (i + 1) + ". " + (r.nome || "(sem nome)") + " — " + r.quando + "\n" + r.mensagem)
            .join("\n\n---\n\n");
          const enviado = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: "Bearer " + env.RESEND_API_KEY,
            },
            body: JSON.stringify({
              from: FEEDBACK_DE_EMAIL,
              to: [env.FEEDBACK_PARA_EMAIL || FEEDBACK_PARA_EMAIL_OMISSAO],
              subject: "AV Planner — " + registos.length + " novos feedbacks",
              text: corpo,
            }),
          });
          if (enviado.ok) {
            await Promise.all(chaves.map((k) => env.FEEDBACK.delete(k)));
          }
        }
      }
    }
  } catch (e) {
    // Silencioso de propósito — ver comentário acima.
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
  });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Rota de administração — chamada de fora do browser (sem Origin, com
    // um token seu), por isso fica ANTES do bloqueio de CORS abaixo, que
    // é só para os pedidos que a app faz.
    if (url.pathname === "/registos") {
      if (request.method !== "GET") {
        return new Response(JSON.stringify({ error: "Método não suportado." }), {
          status: 405,
          headers: { "Content-Type": "application/json" },
        });
      }
      return listarRegistos(request, env);
    }

    // Idem para o resumo de utilização: é para ser lido de fora do browser,
    // com o mesmo token, por isso também fica antes do bloqueio de origem.
    if (url.pathname === "/uso/resumo") {
      if (request.method !== "GET") {
        return new Response(JSON.stringify({ error: "Método não suportado." }), {
          status: 405,
          headers: { "Content-Type": "application/json" },
        });
      }
      return resumoDeUso(request, env);
    }

    // E o painel, que é para ser ABERTO num browser — por isso também antes do
    // crivo de origem: quem escreve um endereço na barra não manda Origin
    // nenhum, e o crivo recusaria a própria pessoa a quem isto se destina.
    if (url.pathname === "/uso/painel") {
      if (request.method !== "GET") {
        return new Response("Método não suportado.", { status: 405 });
      }
      return painelDeUso(request, env);
    }

    const allowedOrigins = (env.ALLOWED_ORIGINS || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const origin = request.headers.get("Origin") || "";
    const allowed = isAllowedOrigin(origin, allowedOrigins);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: allowed ? corsHeaders(origin) : {} });
    }

    if (!allowed) {
      return new Response(JSON.stringify({ error: "Origem não autorizada." }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Rotas do link "só para ver" — à parte do assistente de IA que ocupa a
    // raiz "/" (ver mais abaixo). Vivem aqui em cima para não se misturarem
    // com os limites e validações do texto/PDF/imagem, que não lhes dizem
    // respeito nenhum.
    // A contagem vem do browser, por isso passa pelo mesmo crivo de origem
    // que o resto. Fica aqui em cima, antes das rotas que validam textos,
    // PDFs e imagens — não tem nada que ver com elas.
    if (url.pathname === "/uso") {
      if (request.method !== "POST") {
        return new Response(JSON.stringify({ error: "Método não suportado." }), {
          status: 405,
          headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
        });
      }
      return contarUso(request, env, origin);
    }

    if (url.pathname === "/partilha") {
      if (request.method !== "POST") {
        return new Response(JSON.stringify({ error: "Método não suportado." }), {
          status: 405,
          headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
        });
      }
      return criarPartilha(request, env, origin);
    }
    if (url.pathname.startsWith("/partilha/")) {
      if (request.method !== "GET") {
        return new Response(JSON.stringify({ error: "Método não suportado." }), {
          status: 405,
          headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
        });
      }
      return lerPartilha(url.pathname.slice("/partilha/".length), env, origin);
    }
    if (url.pathname === "/feedback") {
      if (request.method !== "POST") {
        return new Response(JSON.stringify({ error: "Método não suportado." }), {
          status: 405,
          headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
        });
      }
      return criarFeedback(request, env, origin);
    }

    if (request.method !== "POST") {
      return new Response(JSON.stringify({ error: "Método não suportado." }), {
        status: 405,
        headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
      });
    }

    let body;
    try {
      body = await request.json();
    } catch (e) {
      return new Response(JSON.stringify({ error: "Pedido inválido (JSON em falta ou mal formado)." }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
      });
    }

    const text = typeof body.text === "string" ? body.text.trim() : "";
    const pdfBase64 = typeof body.pdfBase64 === "string" ? body.pdfBase64 : "";
    const imageBase64 = typeof body.imageBase64 === "string" ? body.imageBase64 : "";
    const ALLOWED_IMAGE_TYPES = ["image/png", "image/jpeg"];
    const imageMediaType = ALLOWED_IMAGE_TYPES.includes(body.imageMediaType) ? body.imageMediaType : "";

    if (!text && !pdfBase64 && !(imageBase64 && imageMediaType)) {
      return new Response(JSON.stringify({ error: "Falta o texto do projeto, um documento PDF ou uma imagem (PNG/JPEG)." }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
      });
    }
    // Limites simples para conter custo por pedido — um projeto de AV não
    // precisa de mais do que isto para se descrever.
    if (text.length > 20000) {
      return new Response(JSON.stringify({ error: "Texto demasiado longo (máx. 20000 caracteres)." }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
      });
    }
    if (pdfBase64.length > 15 * 1024 * 1024) {
      return new Response(JSON.stringify({ error: "PDF demasiado grande (máx. ~10MB)." }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
      });
    }
    if (imageBase64.length > 7 * 1024 * 1024) {
      return new Response(JSON.stringify({ error: "Imagem demasiado grande (máx. ~5MB)." }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
      });
    }

    if (!env.ANTHROPIC_API_KEY) {
      return new Response(JSON.stringify({ error: "Worker sem chave de API configurada (ANTHROPIC_API_KEY)." }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
      });
    }

    // Pedidos anteriores parecidos, se houver -- ver buscarExemplosParecidos()
    // acima. Nunca deve impedir a extração normal se falhar por algum motivo.
    let exemplosParecidos = [];
    try {
      exemplosParecidos = await buscarExemplosParecidos(env, text);
    } catch (e) {
      exemplosParecidos = [];
    }
    let blocoExemplos = "";
    if (exemplosParecidos.length) {
      blocoExemplos =
        "Para referência, aqui estão pedidos anteriores com texto parecido, e o que foi extraído deles — usa-os só " +
        "para reconhecer o padrão de como este tipo de caso costuma ser preenchido (ex: que campos costumam ficar " +
        "null, que tipo de ambiguidade não costuma precisar de entrar em pontosPorConfirmar). NUNCA copies um valor " +
        "técnico destes exemplos para o projeto de agora — cada projeto é independente, e um valor só entra no " +
        "resultado se estiver também no texto/documento/imagem do pedido atual.\n\n" +
        exemplosParecidos
          .map((r, i) => "Exemplo " + (i + 1) + " — texto: \"" + r.texto.slice(0, 400) + "\"\nExtraído: " + JSON.stringify(r.requisitos))
          .join("\n\n") +
        "\n\n---\n\nPedido atual a extrair:\n\n";
    }

    const contentBlocks = [];
    if (pdfBase64) {
      contentBlocks.push({
        type: "document",
        source: { type: "base64", media_type: "application/pdf", data: pdfBase64 },
      });
    }
    if (imageBase64 && imageMediaType) {
      contentBlocks.push({
        type: "image",
        source: { type: "base64", media_type: imageMediaType, data: imageBase64 },
      });
    }
    contentBlocks.push({
      type: "text",
      text:
        blocoExemplos +
        (text || "(sem texto adicional — ler o documento/imagem em anexo)") +
        "\n\nExtrai os requisitos deste projeto de AV usando a ferramenta fornecida. Se um valor não estiver explícito no texto/documento/imagem, usa null — nunca adivinhes uma especificação técnica. Em pontosPorConfirmar, não repitas como 'aviso' cada campo que ficou null — só usa esse campo para contradições ou ambiguidades reais no texto; na maioria dos casos deve ficar vazio. Atenção especial a tipoEcra: só preenches 'led', 'projecao', 'blend' ou 'misto' se o texto pedir essa tecnologia explicitamente OU se uma imagem em anexo mostrar claramente essa tecnologia (ex: foto óbvia de um ledwall ou de uma projeção) — um pedido de sugestão sem tecnologia indicada nem imagem que a mostre (ex: 'que ecrã devo usar?', 'quantos ecrãs preciso?') fica sempre 'desconhecido'; não escolhas a tecnologia 'mais provável' para o caso. Atenção especial a dimensoes: nunca uses medidas de sala/palco/espaço como se fossem do ecrã — se só houver medidas do local e um pedido de sugestão (ex: 'que ecrã devo usar?'), deixa dimensoes a null. Já em local.distanciaVisualizacaoM e local.larguraPlateiaM, quando não houver valor dado à parte mas o texto descrever as dimensões da sala/espaço, USA a profundidade e a largura da sala como estimativa dessa distância e dessa largura (respetivamente) — não deixes esses dois campos a null só por a sala não ter uma 'plateia' descrita à parte. Quando fizeres essa estimativa a partir das dimensões da sala (em vez de um valor dado diretamente para a plateia/distância), acrescenta um único item curto a pontosPorConfirmar a dizer isso (ex: 'Distância e largura da plateia estimadas a partir das dimensões da sala — confirma a disposição real do público'). Já local.salaLarguraM e local.salaProfundidadeM são OUTRA coisa: só se preenchem quando o texto der a largura/profundidade do PRÓPRIO ESPAÇO diretamente (ex: 'sala de 24 por 18 metros') — nunca como estimativa a partir de outra coisa, e nunca copiados de larguraPlateiaM/distanciaVisualizacaoM (mesmo quando esses dois foram estimados a partir da sala, como no caso acima). Ficam null sempre que o texto não disser as medidas da sala em si. REGRA CRÍTICA para imagens: uma fotografia ou render NUNCA tem escala fiável — não estimes nem inventes nenhuma medida (dimensoes, distâncias, pixel pitch, nits) a partir do que vês numa imagem, mesmo que pareça óbvio a olho; usa a imagem só para identificar o tipo de tecnologia/formato visível (e nota isso em resumo, ex: 'A imagem mostra um ecrã LED em formato ecrã largo, sem escala visível'). Todas as medidas continuam a vir exclusivamente do texto (ex: as dimensões da sala nova onde o utilizador quer replicar o que a imagem mostra). Se houver exemplos de pedidos anteriores acima, e um deles mostrar um padrão claro de como preencher um caso parecido a este (ex: que campos costumam ficar null nesse tipo de pedido, ou que esse tipo de ambiguidade normalmente não precisa de entrar em pontosPorConfirmar), segue o mesmo padrão — sem nunca copiar um valor técnico em concreto desses exemplos.",
    });

    // A última coisa antes de gastar dinheiro. Ver travaDeGasto() lá em cima
    // para o porquê de estar aqui e não à entrada do Worker.
    const travado = await travaDeGasto(request, env);
    if (travado) {
      return new Response(travado.body, {
        status: travado.status,
        headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
      });
    }

    let anthropicRes;
    try {
      anthropicRes = await fetch(ANTHROPIC_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": env.ANTHROPIC_API_KEY,
          "anthropic-version": ANTHROPIC_VERSION,
        },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: 1500,
          tools: [EXTRACT_TOOL],
          tool_choice: { type: "tool", name: EXTRACT_TOOL.name },
          messages: [{ role: "user", content: contentBlocks }],
        }),
      });
    } catch (e) {
      return new Response(JSON.stringify({ error: "Falha a contactar a Anthropic: " + e.message }), {
        status: 502,
        headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
      });
    }

    if (!anthropicRes.ok) {
      const errText = await anthropicRes.text().catch(() => "");
      return new Response(JSON.stringify({ error: "Anthropic devolveu erro (" + anthropicRes.status + "): " + errText.slice(0, 500) }), {
        status: 502,
        headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
      });
    }

    const data = await anthropicRes.json();
    const toolUse = (data.content || []).find((b) => b.type === "tool_use" && b.name === EXTRACT_TOOL.name);
    if (!toolUse) {
      return new Response(JSON.stringify({ error: "A IA não devolveu os dados no formato esperado." }), {
        status: 502,
        headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
      });
    }

    // Fica registado depois de responder (waitUntil) -- nunca deve atrasar
    // nem falhar a resposta a quem pediu. A imagem em si não viaja para
    // aqui, só se uma foi ou não anexada.
    if (env.REGISTOS) {
      const registo = {
        quando: new Date().toISOString(),
        texto: text || null,
        temPdf: !!pdfBase64,
        temImagem: !!(imageBase64 && imageMediaType),
        requisitos: toolUse.input,
      };
      const chave = registo.quando + "-" + crypto.randomUUID();
      ctx.waitUntil(
        env.REGISTOS.put(chave, JSON.stringify(registo), { expirationTtl: REGISTO_VALIDADE_SEGUNDOS }).catch(() => {})
      );
    }

    return new Response(JSON.stringify({ requisitos: toolUse.input }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
    });
  },
};
