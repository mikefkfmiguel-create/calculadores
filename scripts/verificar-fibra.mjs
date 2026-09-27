/**
 * A ABA DA FIBRA — capacidades, distâncias e tipologia.
 *
 * Pedido: *"quero incluir tudo nas calculadoras mesmo sem ter na casa para
 * poder decidir se peço para comprar. A ideia é ter um calculador real das
 * capacidades, distâncias e tipologia. Por exemplo que distância e com que
 * tipo de SFP e fibra conseguimos determinado bandwidth"*.
 *
 * O risco desta aba não é calcular mal — a conta das perdas é uma soma. É
 * **mentir com um número plausível**: alguém pede para comprar um SFP por
 * causa de uma linha que ninguém confirmou. Por isso a maioria das
 * asserções aqui é sobre a PROVENIÊNCIA e sobre o que a app admite não
 * saber, e não sobre a aritmética.
 *
 * O que este teste guarda:
 *
 *   1. toda a linha da tabela tem fonte — nenhuma exceção;
 *   2. onde o orçamento ótico não foi recolhido, a app **diz que não foi**,
 *      em vez de mostrar um número;
 *   3. cada linha diz de onde vem o valor (norma, ficha, ou a confirmar);
 *   4. a app avisa que a tabela é uma primeira recolha — sem isso, um "não
 *      há nada melhor" lê-se como verdade e leva a uma compra errada;
 *   5. a pergunta dele funciona: dá-se débito e distância e a resposta muda
 *      com eles, e o que não chega lá fica de fora;
 *   6. a conta das perdas bate certo, feita à mão aqui ao lado;
 *   7. e a app diz de que edição da norma são os valores de perdas.
 *
 *   node scripts/verificar-fibra.mjs
 */

import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = fileURLToPath(new URL("..", import.meta.url));

const TIPOS = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8",
  ".png": "image/png", ".svg": "image/svg+xml", ".webmanifest": "application/manifest+json"
};

function servidor() {
  return new Promise((resolve) => {
    const s = createServer(async (req, res) => {
      const caminho = decodeURIComponent(req.url.split("?")[0]);
      const ficheiro = join(RAIZ, normalize(caminho === "/" ? "/index.html" : caminho).replace(/^(\.\.[/\\])+/, ""));
      try {
        const dados = await readFile(ficheiro);
        res.writeHead(200, { "Content-Type": TIPOS[extname(ficheiro)] || "application/octet-stream" });
        res.end(dados);
      } catch (_) { res.writeHead(404).end("não há"); }
    });
    s.listen(0, "127.0.0.1", () => resolve({ s, porta: s.address().port }));
  });
}

async function carregarPlaywright() {
  const sitios = [process.env.PLAYWRIGHT, "playwright",
                  "/opt/node22/lib/node_modules/playwright/index.mjs"].filter(Boolean);
  for (const sitio of sitios) { try { return await import(sitio); } catch (_) {} }
  console.log("Falta o playwright. `npm i -D playwright`, ou PLAYWRIGHT a apontar a uma instalação.");
  process.exit(2);
}

let falhas = 0;
const conferir = (ok, texto) => { console.log((ok ? "  ✓ " : "  ✗ ") + texto); if (!ok) falhas++; };

// ---------------------------------------------------- a tabela, do ficheiro

console.log("\n== nada na tabela sem fonte ==");
const dados = JSON.parse(await readFile(join(RAIZ, "data/fibra.json"), "utf8"));
const CONFIANCAS = ["norma", "fabricante", "indicativo"];

const linhas = [].concat(
  dados.fibras.map((x) => ["fibra " + x.id, x]),
  dados.oticas.map((x) => ["ótica " + x.nome, x]),
  dados.conectores_de_terreno.map((x) => ["conector " + x.nome, x])
);
conferir(linhas.length >= 15, "a tabela tem " + linhas.length + " linhas");

const semFonte = linhas.filter(([, x]) => !x.fonte || !/^https?:\/\//.test(x.fonte));
conferir(semFonte.length === 0,
  "todas trazem fonte" + (semFonte.length ? " — sem fonte: " + semFonte.map((l) => l[0]).join(", ") : ""));

const semConfianca = linhas.filter(([, x]) => CONFIANCAS.indexOf(x.confianca) === -1);
conferir(semConfianca.length === 0,
  "e todas dizem de onde vem o valor" +
  (semConfianca.length ? " — sem isso: " + semConfianca.map((l) => l[0]).join(", ") : ""));

conferir(!!dados.perdas.fonte && !!dados.perdas.fonte_aviso,
  "as perdas trazem fonte e o aviso da edição da norma");

// ------------------------------------------------------------- e na app

const { s, porta } = await servidor();
const { chromium } = await carregarPlaywright();
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM || "/opt/pw-browsers/chromium"
});
const ctx = await browser.newContext({ viewport: { width: 1500, height: 1000 }, serviceWorkers: "block" });
const pagina = await ctx.newPage();
const erros = [];
pagina.on("pageerror", (e) => erros.push(e.message));

await pagina.goto(`http://127.0.0.1:${porta}/index.html`, { waitUntil: "networkidle" });
await pagina.waitForFunction(() => document.querySelectorAll("#l-model option").length > 3, null, { timeout: 20000 });
await pagina.evaluate(() => { const m = document.getElementById("btMenuCompleta"); if (m) m.click(); });
await pagina.waitForTimeout(600);
await pagina.evaluate(() => document.querySelector('.tabs .tab[data-mode="fibra"]').click());
await pagina.waitForTimeout(900);

const pedir = (gbps, metros) => pagina.evaluate(async (v) => {
  const g = document.getElementById("fib-gbps");
  g.value = String(v.gbps); g.dispatchEvent(new Event("input", { bubbles: true }));
  const d = document.getElementById("fib-dist");
  d.value = String(v.metros); d.dispatchEvent(new Event("input", { bubbles: true }));
  await new Promise((r) => setTimeout(r, 400));
  const caixa = document.getElementById("fib-lista");
  return {
    linhas: [...caixa.querySelectorAll(".lm-item")].map((el) => el.textContent.replace(/\s+/g, " ").trim()),
    resumo: document.getElementById("fib-resumo").textContent.trim(),
    comFonte: [...caixa.querySelectorAll(".lm-item")].every((el) => !!el.querySelector("a[href^='http']"))
  };
}, { gbps, metros });

console.log("\n== a pergunta dele: que SFP e que fibra levam X a Y metros ==");
const dezA300 = await pedir(10, 300);
conferir(dezA300.linhas.length > 0, "10 Gbps a 300 m dá respostas (" + dezA300.linhas.length + ")");
conferir(dezA300.comFonte, "e cada uma traz o link da fonte");
conferir(/10GBASE-SR/.test(dezA300.linhas.join(" ")), "com o 10GBASE-SR lá dentro");
console.log("   " + dezA300.resumo);

const dezA5km = await pedir(10, 5000);
conferir(dezA5km.linhas.length < dezA300.linhas.length,
  "a 5 km sobram menos opções (" + dezA300.linhas.length + " → " + dezA5km.linhas.length + ")");
conferir(!/10GBASE-SR/.test(dezA5km.linhas.join(" ")),
  "e o 10GBASE-SR (400 m) deixa de aparecer");
conferir(/10GBASE-LR|10GBASE-ER/.test(dezA5km.linhas.join(" ")),
  "mas o monomodo de longo alcance aparece");

console.log("\n== o que a app NÃO sabe, ela diz ==");
// É a asserção que separa uma ferramenta de compra de uma máquina de
// palpites: onde o orçamento não foi recolhido, não se inventa um.
const juntas = dezA300.linhas.join(" ");
conferir(/orçamento não recolhido/.test(juntas),
  "onde o orçamento ótico não foi recolhido, diz-se");
conferir(/orçamento 2,9 dB|orçamento 6,3 dB/.test(juntas),
  "e onde foi, mostra-se o valor");

const selos = await pagina.evaluate(() =>
  [...document.querySelectorAll("#fib-lista .lm-priority")].map((e) => e.textContent.trim()));
conferir(selos.some((s) => s === "Norma"), "as linhas de norma estão marcadas como tal");
conferir(selos.every((s) => ["Norma", "Ficha", "A confirmar", "Chega"].includes(s) || /^Fica a /.test(s)),
  "e não há selo nenhum fora do vocabulário (" + [...new Set(selos)].join(", ") + ")");

console.log("\n== e avisa que a tabela não é o catálogo do mundo ==");
const aviso = await pagina.evaluate(() => {
  const e = document.getElementById("fib-incompleta");
  return e ? { texto: e.textContent.replace(/\s+/g, " ").trim(), visivel: e.offsetParent !== null } : null;
});
conferir(!!aviso && aviso.visivel, "o aviso está à vista");
conferir(!!aviso && /primeira recolha/i.test(aviso.texto) && /não existe/i.test(aviso.texto),
  "e diz que o que não está lá não é o que não existe");

console.log("\n== monomodo e multimodo: a fibra E a ótica ==");
// A confusão entre as duas é a que custa dinheiro: a FIBRA decide quantos
// caminhos a luz tem, a ÓTICA decide o que se paga. Se a explicação só
// falar de uma delas, não explica o preço.
await pagina.evaluate(() => { document.getElementById("fib-modos-card").open = true; });
await pagina.waitForTimeout(300);
const modos = await pagina.evaluate(() => {
  const e = document.getElementById("fib-modos");
  return { texto: e.textContent.replace(/\s+/g, " "), fonte: !!e.querySelector("a[href^='http']") };
});
conferir(/Na fibra/.test(modos.texto) && /Na ótica/.test(modos.texto),
  "explica as duas metades: a fibra e a ótica");
conferir(/µm/.test(modos.texto) && /9/.test(modos.texto) && /50/.test(modos.texto),
  "com os núcleos (9 µm contra 50)");
conferir(/VCSEL/.test(modos.texto) && /laser/i.test(modos.texto),
  "e as fontes de luz (VCSEL contra laser), que é o que explica o preço");
conferir(/dispersão modal/i.test(modos.texto),
  "diz que o que limita o multimodo é a dispersão modal, e não a perda");
conferir(/80 m/.test(modos.texto) && /3 km/.test(modos.texto),
  "e traz o exemplo com as duas contas lado a lado");
conferir(/1,74 dB/.test(modos.texto) && /2,7 dB/.test(modos.texto),
  "com os números feitos: 1,74 dB nos 80 m e 2,7 dB nos 3 km");
conferir(modos.fonte, "e a fonte");

console.log("\n== quanto custa em banda: áudio, vídeo e luz ==");
const custos = await pagina.evaluate(() => {
  const caixa = document.getElementById("fib-custos");
  return {
    grupos: [...caixa.querySelectorAll(".divider")].map((e) => e.textContent.trim()),
    linhas: caixa.querySelectorAll(".fib-custo").length,
    comFonte: [...caixa.querySelectorAll(".fib-custo")].every((e) => !!e.querySelector("a[href^='http']")),
    comSelo: [...caixa.querySelectorAll(".fib-custo")].every((e) => !!e.querySelector(".lm-priority"))
  };
});
conferir(custos.grupos.join(",") === "Vídeo,Áudio,Iluminação",
  "os três grupos estão lá (" + custos.grupos.join(", ") + ")");
conferir(custos.linhas >= 10, "com " + custos.linhas + " sinais");
conferir(custos.comFonte, "e todos com fonte");
conferir(custos.comSelo, "e todos a dizer de onde vem o valor");

// E servem para alguma coisa: tocar num põe o débito e a lista responde.
const tocou = await pagina.evaluate(async () => {
  const b = [...document.querySelectorAll(".fib-custo")].find((x) => /12G-SDI/.test(x.textContent));
  if (!b) return null;
  b.click();
  await new Promise((r) => setTimeout(r, 500));
  return {
    gbps: document.getElementById("fib-gbps").value,
    primeira: document.getElementById("fib-lista").querySelector(".lm-item").textContent.replace(/\s+/g, " ")
  };
});
conferir(!!tocou && parseFloat(tocou.gbps) === 11.88,
  "tocar no 12G-SDI põe 11,88 Gbps no débito");
conferir(!!tocou && /12G-SDI/.test(tocou.primeira),
  "e a lista responde com a ótica de 12G-SDI");

console.log("\n== a conta das perdas ==");
const perdas = await pagina.evaluate(async () => {
  const por = (id, v) => {
    const e = document.getElementById(id);
    e.value = String(v); e.dispatchEvent(new Event("input", { bubbles: true }));
  };
  const tipo = document.getElementById("fib-tipo");
  tipo.value = "OS2"; tipo.dispatchEvent(new Event("change", { bubbles: true }));
  por("fib-comp", 2000); por("fib-conect", 4); por("fib-emendas", 2);
  await new Promise((r) => setTimeout(r, 400));
  return document.getElementById("fib-perdas").textContent.replace(/\s+/g, " ").trim();
});
// À mão: 2 km × 0,4 dB/km = 0,8 · 4 pares × 0,75 = 3,0 · 2 emendas × 0,3 = 0,6 → 4,4 dB
conferir(/Perda total: 4,40 dB/.test(perdas),
  "2 km de OS2 + 4 pares + 2 emendas = 4,40 dB — a conta feita à mão aqui ao lado bate certo");
conferir(/0,4 dB\/km/.test(perdas), "e diz com que atenuação contou");

console.log("\n== e de que edição da norma são os valores ==");
const fontes = await pagina.evaluate(() =>
  document.getElementById("fib-fontes").textContent.replace(/\s+/g, " ").trim());
conferir(/TIA-568\.3-D/.test(fontes) && /edição E/i.test(fontes),
  "a app diz que são da edição D e que a E mudou");

console.log("\n== sem erros na consola ==");
conferir(erros.length === 0, erros.length ? erros.join(" | ") : "nenhum");

await browser.close();
s.close();
console.log(falhas ? `\n${falhas} falha(s).` : "\nDiz o que sabe, com a fonte — e diz o que não sabe.");
process.exit(falhas ? 1 : 0);
