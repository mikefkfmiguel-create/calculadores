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
        },
        required: ["distanciaProjecaoM", "distanciaVisualizacaoM", "larguraPlateiaM", "alturaSalaM", "interior", "curvo"],
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
    },
    required: ["tipoEcra", "confianca", "dimensoes", "local", "led", "orcamento", "projeto", "resumo", "pontosPorConfirmar"],
    additionalProperties: false,
  },
};

function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
  };
}

function isAllowedOrigin(origin, allowedOrigins) {
  return !!origin && allowedOrigins.includes(origin);
}

export default {
  async fetch(request, env) {
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
        (text || "(sem texto adicional — ler o documento/imagem em anexo)") +
        "\n\nExtrai os requisitos deste projeto de AV usando a ferramenta fornecida. Se um valor não estiver explícito no texto/documento/imagem, usa null — nunca adivinhes uma especificação técnica. Em pontosPorConfirmar, não repitas como 'aviso' cada campo que ficou null — só usa esse campo para contradições ou ambiguidades reais no texto; na maioria dos casos deve ficar vazio. Atenção especial a tipoEcra: só preenches 'led', 'projecao', 'blend' ou 'misto' se o texto pedir essa tecnologia explicitamente OU se uma imagem em anexo mostrar claramente essa tecnologia (ex: foto óbvia de um ledwall ou de uma projeção) — um pedido de sugestão sem tecnologia indicada nem imagem que a mostre (ex: 'que ecrã devo usar?', 'quantos ecrãs preciso?') fica sempre 'desconhecido'; não escolhas a tecnologia 'mais provável' para o caso. Atenção especial a dimensoes: nunca uses medidas de sala/palco/espaço como se fossem do ecrã — se só houver medidas do local e um pedido de sugestão (ex: 'que ecrã devo usar?'), deixa dimensoes a null. Já em local.distanciaVisualizacaoM e local.larguraPlateiaM, quando não houver valor dado à parte mas o texto descrever as dimensões da sala/espaço, USA a profundidade e a largura da sala como estimativa dessa distância e dessa largura (respetivamente) — não deixes esses dois campos a null só por a sala não ter uma 'plateia' descrita à parte. Quando fizeres essa estimativa a partir das dimensões da sala (em vez de um valor dado diretamente para a plateia/distância), acrescenta um único item curto a pontosPorConfirmar a dizer isso (ex: 'Distância e largura da plateia estimadas a partir das dimensões da sala — confirma a disposição real do público'). REGRA CRÍTICA para imagens: uma fotografia ou render NUNCA tem escala fiável — não estimes nem inventes nenhuma medida (dimensoes, distâncias, pixel pitch, nits) a partir do que vês numa imagem, mesmo que pareça óbvio a olho; usa a imagem só para identificar o tipo de tecnologia/formato visível (e nota isso em resumo, ex: 'A imagem mostra um ecrã LED em formato ecrã largo, sem escala visível'). Todas as medidas continuam a vir exclusivamente do texto (ex: as dimensões da sala nova onde o utilizador quer replicar o que a imagem mostra).",
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

    return new Response(JSON.stringify({ requisitos: toolUse.input }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
    });
  },
};
