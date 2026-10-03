// ------------------------------------------------ "Better call Mike"
//
// Perguntas e dúvidas técnicas do terreno (ex.: "como configuro a A8s para
// 10-bit a 50% de brilho?"), com texto e/ou uma foto do ecrã do software.
//
// ISTO É DIFERENTE DO ASSISTENTE DE PROJETO, e de propósito. O Assistente só
// EXTRAI factos de um briefing; a conta é feita na app, contra dados reais.
// Aqui a IA responde em prosa, que é aconselhar -- por isso a resposta diz
// SEMPRE de onde vem, e a origem é verificada aqui, não confiada ao modelo:
//
//   · "notas" -- das notas confirmadas no terreno (conhecimento/*.md, lidas
//     do GitHub Pages a cada pergunta). Só conta se o modelo nomear uma nota
//     que existe MESMO no índice; uma nota escrita de cabeça não passa.
//   · "web"   -- de páginas que a pesquisa devolveu, com o endereço. As
//     fontes são as citações que a própria Anthropic anexa ao texto, não
//     endereços escritos pelo modelo.
//   · "geral" -- conhecimento geral do modelo, sem fonte: a app mostra-o
//     com aviso de "confirmar no equipamento".
//
// Quando uma resposta se confirma no terreno, a pessoa carrega em "Propor
// como nota" (/pergunta/propor). A app não pode escrever no repositório;
// a proposta fica na KV REGISTOS e entra na revisão (ver CLAUDE.md, base de
// conhecimento) -- só vira nota com o ok do mike.

// Sonnet e não Haiku: aqui a resposta É o produto (explicar parâmetros, ler
// uma foto do NovaLCT), e não uma extracção para validar a seguir.
export const MODELO_PERGUNTA = "claude-sonnet-4-5";
const PESQUISA = { type: "web_search_20250305", name: "web_search", max_uses: 4 };

const CONHECIMENTO_OMISSAO = "https://mikefkfmiguel-create.github.io/calculadores/conhecimento/";
const NOTAS_MAX_CARACTERES = 60000;
// Largo de propósito: colar um email inteiro na caixa tem de caber.
const PERGUNTA_MAX = 20000;
const ANEXO_TEXTO_MAX = 30000;
const PDF_MAX_BASE64 = 14 * 1024 * 1024; // ~10 MB de PDF
const HISTORICO_MAX = 3;
const HISTORICO_TEXTO_MAX = 3000;
const IMAGEM_MAX_BASE64 = 7 * 1024 * 1024; // ~5 MB de imagem
const TIPOS_IMAGEM = ["image/png", "image/jpeg"];
const REGISTO_VALIDADE = 30 * 24 * 60 * 60;
const PROPOSTA_VALIDADE = 120 * 24 * 60 * 60;
const PROPOSTAS_POR_IP_DIA = 20;
const ORIGENS = ["notas", "web", "geral"];

function json(corpo, status, cors) {
  return new Response(JSON.stringify(corpo), { status, headers: { "Content-Type": "application/json", ...cors } });
}

function palavras(texto) {
  const s = (texto || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  return new Set((s.match(/[a-z0-9]+/g) || []).filter((p) => p.length > 2));
}

/** O índice e as notas, do GitHub Pages. Sem notas, responde-se na mesma. */
async function lerNotas(env, pergunta) {
  const base = (env.CONHECIMENTO_URL || CONHECIMENTO_OMISSAO).replace(/\/?$/, "/");
  let indice;
  try {
    const r = await fetch(base + "indice.json", { cf: { cacheTtl: 300 } });
    if (!r.ok) return [];
    indice = await r.json();
  } catch (_) { return []; }
  const lista = (indice && Array.isArray(indice.notas)) ? indice.notas : [];
  const notas = await Promise.all(lista.map(async (n) => {
    if (!n || typeof n.ficheiro !== "string" || !/^[\w.\-]+\.md$/.test(n.ficheiro)) return null;
    try {
      const r = await fetch(base + n.ficheiro, { cf: { cacheTtl: 300 } });
      if (!r.ok) return null;
      return { ficheiro: n.ficheiro, titulo: String(n.titulo || n.ficheiro), texto: await r.text() };
    } catch (_) { return null; }
  }));
  // Com muitas notas, entram primeiro as que partilham mais palavras com a
  // pergunta, até ao tecto de caracteres (custo por pedido conhecido).
  const p = palavras(pergunta);
  const ordenadas = notas.filter(Boolean).map((n) => {
    let comuns = 0;
    palavras(n.titulo + " " + n.texto).forEach((w) => { if (p.has(w)) comuns++; });
    return { n, comuns };
  }).sort((a, b) => b.comuns - a.comuns).map((x) => x.n);
  const out = [];
  let total = 0;
  for (const n of ordenadas) {
    if (total + n.texto.length > NOTAS_MAX_CARACTERES) continue;
    out.push(n);
    total += n.texto.length;
  }
  return out;
}

function limpaNome(n) {
  return typeof n === "string" ? n.replace(/[\u0000-\u001f<>"]/g, "").replace(/\s+/g, " ").trim().slice(0, 60) : "";
}

function instrucoes(notas, nome) {
  const blocoNotas = notas.length
    ? notas.map((n) => "<nota ficheiro=\"" + n.ficheiro + "\" titulo=\"" + n.titulo.replace(/"/g, "'") + "\">\n" + n.texto + "\n</nota>").join("\n\n")
    : "(não há notas sobre este tema)";
  return [
    "És o \"Better call Mike\", o apoio técnico de uma equipa de produção audiovisual (AVK Portugal): LED, processadores (NovaStar, Brompton, etc.), projeção, media servers, sinal de vídeo, redes AV.",
    "Respondes a técnicos no terreno, em português de Portugal, de forma direta e prática: primeiro a resposta, depois os passos ou valores. Curto: o técnico está a ler no telemóvel.",
    nome ? "Quem pergunta chama-se " + nome + ". Começa a resposta pelo nome (ex.: \"" + nome + ", ...\"), sem cerimónias." : "",
    "",
    "FONTES, por esta ordem:",
    "1. As NOTAS da equipa (abaixo) -- foram confirmadas no terreno. Se respondem à pergunta, usa-as e não as contradigas.",
    "2. A PESQUISA na web, quando as notas não chegam ou para confirmar dados de fabricante (manuais, fichas). Prefere sites do fabricante.",
    "3. Conhecimento geral, só quando 1 e 2 não chegam -- e di-lo.",
    "",
    "REGRAS:",
    "- Nunca inventes valores técnicos (specs, limites, nomes de menus). Se não tens a certeza, diz que é preciso confirmar no equipamento.",
    "- Se houver foto, lê o que lá está escrito (valores, menus) e usa-o; não estimes medidas a partir de fotos.",
    "- Se houver um PDF ou texto anexado (ex.: um email, um briefing, um manual), lê-o todo e responde com base nele; se pedirem um resumo, resume em pontos curtos o que é pedido, datas, equipamento e pendentes.",
    "- Se a pergunta for perigosa para equipamento ou pessoas (eletricidade, rigging), avisa e manda confirmar com o responsável.",
    "",
    "FORMATO, obrigatório:",
    "Linha 1: ORIGEM: <uma ou mais de: notas, web, geral, separadas por vírgula>",
    "Linha 2: NOTAS: <ficheiros das notas que usaste, separados por vírgula, ou nenhuma>",
    "Depois uma linha em branco e a resposta em markdown simples (parágrafos, listas, tabelas, **negrito**). Sem títulos grandes.",
    "",
    "NOTAS DA EQUIPA:",
    blocoNotas,
  ].join("\n");
}

/** Texto e citações verificadas de uma resposta com web_search. */
function lerResposta(content) {
  let texto = "";
  const fontes = [];
  const vistos = new Set();
  const procurou = [];
  (content || []).forEach((b) => {
    if (b.type === "text") {
      texto += b.text;
      (b.citations || []).forEach((c) => {
        if (c && c.url && !vistos.has(c.url)) {
          vistos.add(c.url);
          fontes.push({ titulo: String(c.title || c.url).slice(0, 200), url: String(c.url).slice(0, 500) });
        }
      });
    } else if (b.type === "web_search_tool_result" && Array.isArray(b.content)) {
      b.content.forEach((r) => { if (r && r.url) procurou.push({ titulo: String(r.title || r.url).slice(0, 200), url: String(r.url).slice(0, 500) }); });
    }
  });
  return { texto, fontes, procurou };
}

/** Separa as duas linhas de cabeçalho da resposta e verifica-as. */
export function interpretar(texto, notas) {
  let resto = (texto || "").replace(/^\s+/, "");
  let origem = [];
  let notasUsadas = [];
  const mOrigem = /^ORIGEM:\s*([^\n]*)\n?/i.exec(resto);
  if (mOrigem) {
    origem = mOrigem[1].toLowerCase().split(/[,;\s]+/).filter((o) => ORIGENS.includes(o));
    resto = resto.slice(mOrigem[0].length);
  }
  const mNotas = /^NOTAS:\s*([^\n]*)\n?/i.exec(resto.replace(/^\s+/, ""));
  if (mNotas) {
    resto = resto.replace(/^\s+/, "").slice(mNotas[0].length);
    const pedidas = mNotas[1].split(/[,;]+/).map((s) => s.trim().toLowerCase()).filter(Boolean);
    notas.forEach((n) => {
      if (pedidas.includes(n.ficheiro.toLowerCase()) || pedidas.includes(n.titulo.toLowerCase())) notasUsadas.push(n);
    });
  }
  return { resposta: resto.trim(), origem, notasUsadas };
}

function limpaHistorico(h) {
  if (!Array.isArray(h)) return [];
  return h.slice(-HISTORICO_MAX).filter((x) => x && typeof x.p === "string" && typeof x.r === "string")
    .map((x) => ({ p: x.p.slice(0, HISTORICO_TEXTO_MAX), r: x.r.slice(0, HISTORICO_TEXTO_MAX) }));
}

export async function responderPergunta(request, env, origin, ctx, deps) {
  const cors = deps.corsHeaders(origin);
  if (!env.ANTHROPIC_API_KEY) return json({ ok: false, motivo: "Worker sem chave de API." }, 200, cors);

  let body;
  try { body = await request.json(); } catch (_) { body = null; }
  if (!body) return json({ ok: false, motivo: "Pedido inválido." }, 400, cors);
  const pergunta = typeof body.pergunta === "string" ? body.pergunta.trim() : "";
  const imagem = typeof body.imageBase64 === "string" ? body.imageBase64 : "";
  const tipoImagem = TIPOS_IMAGEM.includes(body.imageMediaType) ? body.imageMediaType : "";
  const temImagem = !!(imagem && tipoImagem);
  const pdf = typeof body.pdfBase64 === "string" ? body.pdfBase64 : "";
  const anexoTexto = typeof body.anexoTexto === "string" ? body.anexoTexto.trim() : "";
  const anexoNome = typeof body.anexoNome === "string" ? body.anexoNome.replace(/[\u0000-\u001f<>"]/g, "").slice(0, 120) : "";
  const temAnexo = !!(pdf || anexoTexto);
  if (!pergunta && !temImagem && !temAnexo) return json({ ok: false, motivo: "Escreve a pergunta ou junta uma foto, um PDF ou um texto." }, 400, cors);
  if (pdf.length > PDF_MAX_BASE64) return json({ ok: false, motivo: "PDF demasiado grande (máx. ~10 MB)." }, 400, cors);
  if (anexoTexto.length > ANEXO_TEXTO_MAX) return json({ ok: false, motivo: "Texto anexado demasiado longo (máx. " + ANEXO_TEXTO_MAX + " caracteres)." }, 400, cors);
  if (pergunta.length > PERGUNTA_MAX) return json({ ok: false, motivo: "Pergunta demasiado longa (máx. " + PERGUNTA_MAX + " caracteres)." }, 400, cors);
  if (imagem.length > IMAGEM_MAX_BASE64) return json({ ok: false, motivo: "Foto demasiado grande." }, 400, cors);

  const travado = await deps.travaDeGasto(request, env);
  if (travado) {
    const corpo = await travado.json().catch(() => ({}));
    return json({ ok: false, motivo: corpo.error || "Limite de pedidos atingido." }, travado.status, cors);
  }

  const nome = limpaNome(body.nome);
  const notas = await lerNotas(env, pergunta);
  const messages = [];
  limpaHistorico(body.historico).forEach((x) => {
    messages.push({ role: "user", content: x.p });
    messages.push({ role: "assistant", content: x.r });
  });
  const blocos = [];
  if (pdf) blocos.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: pdf }, title: anexoNome || "documento.pdf" });
  if (anexoTexto) blocos.push({ type: "text", text: "Texto anexado" + (anexoNome ? " (" + anexoNome + ")" : "") + ":\n<<<\n" + anexoTexto + "\n>>>" });
  if (temImagem) blocos.push({ type: "image", source: { type: "base64", media_type: tipoImagem, data: imagem } });
  blocos.push({ type: "text", text: pergunta || (temAnexo
    ? "Resume o que está anexado e diz o que é pedido, o que é preciso fazer e o que devo verificar."
    : "O que é que esta foto mostra, e o que devo verificar ou ajustar?") });
  messages.push({ role: "user", content: blocos });

  let res;
  try {
    res = await fetch(deps.ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": env.ANTHROPIC_API_KEY,
        "anthropic-version": deps.ANTHROPIC_VERSION,
      },
      body: JSON.stringify({
        model: MODELO_PERGUNTA,
        max_tokens: 1800,
        system: instrucoes(notas, nome),
        tools: [PESQUISA],
        messages,
      }),
    });
  } catch (e) {
    return json({ ok: false, motivo: "Não consegui chegar à IA: " + e.message }, 200, cors);
  }
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    return json({ ok: false, motivo: "A IA devolveu erro (" + res.status + ").", detalhe: txt.slice(0, 200) }, 200, cors);
  }

  const data = await res.json();
  const lida = lerResposta(data.content);
  const { resposta, origem: pedida, notasUsadas } = interpretar(lida.texto, notas);
  if (!resposta) return json({ ok: false, motivo: "A IA não devolveu resposta. Tenta outra vez." }, 200, cors);

  // ---- O CRIVO da origem: só fica o que tem prova ----------------------
  const origem = [];
  if (notasUsadas.length) origem.push("notas");
  if (lida.fontes.length) origem.push("web");
  if (!origem.length || pedida.includes("geral")) origem.push("geral");

  const saida = {
    ok: true,
    resposta,
    origem,
    notasUsadas: notasUsadas.map((n) => ({ ficheiro: n.ficheiro, titulo: n.titulo })),
    fontes: lida.fontes.slice(0, 8),
  };

  if (env.REGISTOS && ctx) {
    const quando = new Date().toISOString();
    const registo = {
      quando, tipo: "pergunta", nome, pergunta: pergunta.slice(0, 4000), temImagem, temPdf: !!pdf,
      anexoNome: anexoNome || null, temAnexoTexto: !!anexoTexto,
      resposta: resposta.slice(0, 4000), origem, notasUsadas: saida.notasUsadas, fontes: saida.fontes,
    };
    ctx.waitUntil(env.REGISTOS.put(quando + "-pergunta-" + crypto.randomUUID(), JSON.stringify(registo),
      { expirationTtl: REGISTO_VALIDADE }).catch(() => {}));
  }

  return json(saida, 200, cors);
}

/** "Propor como nota": guarda para revisão. Não chama a IA, não gasta. */
export async function proporNota(request, env, origin, deps) {
  const cors = deps.corsHeaders(origin);
  if (!env.REGISTOS) return json({ ok: false, motivo: "Worker sem armazenamento configurado." }, 200, cors);
  let body;
  try { body = await request.json(); } catch (_) { body = null; }
  const pergunta = body && typeof body.pergunta === "string" ? body.pergunta.trim().slice(0, 4000) : "";
  const resposta = body && typeof body.resposta === "string" ? body.resposta.trim().slice(0, 8000) : "";
  const comentario = body && typeof body.comentario === "string" ? body.comentario.trim().slice(0, 2000) : "";
  if (!resposta) return json({ ok: false, motivo: "Falta a resposta a propor." }, 400, cors);

  if (env.USO) {
    const dia = new Date().toISOString().slice(0, 10);
    const ip = request.headers.get("CF-Connecting-IP") || "sem-ip";
    const chave = "lim:prop:" + dia + ":" + ip;
    const n = parseInt(await env.USO.get(chave), 10) || 0;
    if (n >= PROPOSTAS_POR_IP_DIA) return json({ ok: false, motivo: "Já foram feitas muitas propostas hoje a partir desta ligação." }, 429, cors);
    await env.USO.put(chave, String(n + 1), { expirationTtl: 2 * 24 * 60 * 60 });
  }

  const origem = Array.isArray(body.origem) ? body.origem.filter((o) => ORIGENS.includes(o)) : [];
  const fontes = Array.isArray(body.fontes) ? body.fontes.slice(0, 8).filter((f) => f && typeof f.url === "string")
    .map((f) => ({ titulo: String(f.titulo || f.url).slice(0, 200), url: f.url.slice(0, 500) })) : [];
  const quando = new Date().toISOString();
  const nome = limpaNome(body.nome);
  const proposta = { quando, tipo: "proposta-nota", nome, pergunta, resposta, comentario, origem, fontes };
  await env.REGISTOS.put(quando + "-proposta-" + crypto.randomUUID(), JSON.stringify(proposta), { expirationTtl: PROPOSTA_VALIDADE });
  return json({ ok: true }, 200, cors);
}
