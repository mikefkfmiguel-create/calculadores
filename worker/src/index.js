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
        },
        required: ["distanciaProjecaoM", "distanciaVisualizacaoM", "larguraPlateiaM", "alturaSalaM", "interior", "curvo", "salaLarguraM", "salaProfundidadeM", "numeroParticipantes", "publicoEmPe"],
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
