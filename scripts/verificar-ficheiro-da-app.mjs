/**
 * O FICHEIRO É DESTA APP -- E FECHAR COM TRABALHO POR GUARDAR PERGUNTA.
 *
 * (O gémeo deste teste vive no Preview, para o .cal. As duas apps gravam
 * ficheiros e as duas têm de os reclamar: o mesmo par de perguntas, cada uma
 * na sua casa.)
 *
 * Dois pedidos na mesma frase: *"só falta os projetos guardados terem ícone da
 * app, perguntar se quero guardar ao fechar por segurança"*.
 *
 * O ÍCONE E O DUPLO CLIQUE SÃO A MESMA COISA. O sistema só põe o ícone de uma
 * app num ficheiro quando essa app o declara como seu, no manifest
 * (`file_handlers`). Mas declarar sem mais nada é pior do que não declarar: o
 * ficheiro passa a abrir a app e a app abre VAZIA, porque um ficheiro aberto
 * pelo sistema não entra pelo botão "Abrir projeto…" -- entra pela fila de
 * arranque (`launchQueue`). Este teste mede as duas metades.
 *
 * A PERGUNTA AO FECHAR é o que o browser deixa: dizer que há coisas por
 * guardar. O texto da caixa é dele. O que está aqui em teste é o que é NOSSO
 * -- perguntar quando há o que perder, e calar quando não há. Uma pergunta ao
 * fechar uma janela onde não se mexeu é uma pergunta que se aprende a
 * despachar sem ler, e depois despacha-se também a que interessava.
 *
 *   node scripts/verificar-ficheiro-da-app.mjs
 */

import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = fileURLToPath(new URL("..", import.meta.url));

const TIPOS = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8",
  ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml",
  ".wasm": "application/wasm", ".ico": "image/x-icon",
  ".webmanifest": "application/manifest+json"
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

// ---- 1. O MANIFEST DECLARA O .cal COMO SEU ----------------------------
console.log("\n== o manifest ==");
const manifest = JSON.parse(await readFile(join(RAIZ, "manifest.json"), "utf8"));
const handlers = manifest.file_handlers || [];
const doCal = handlers.find((h) => JSON.stringify(h.accept || {}).includes(".cal"));
console.log("   " + JSON.stringify(handlers.map((h) => h.accept)));
conferir(!!doCal, "declara o .cal — é isto que dá o ícone da app ao ficheiro");
conferir(!!doCal && Array.isArray(doCal.icons) && doCal.icons.length > 0,
  "com ícones próprios, que é o que o sistema vai buscar");
for (const icone of (doCal ? doCal.icons : [])) {
  let existe = true;
  try { await readFile(join(RAIZ, icone.src)); } catch (_) { existe = false; }
  conferir(existe, "e o ícone " + icone.src + " existe mesmo");
}
conferir(!!doCal && typeof doCal.action === "string" && doCal.action.length > 0,
  "e diz que página abrir");

const { s, porta } = await servidor();
const { chromium } = await carregarPlaywright();
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM || "/opt/pw-browsers/chromium"
});
const ctx = await browser.newContext({ viewport: { width: 1300, height: 900 }, serviceWorkers: "block" });

// A FILA DE ARRANQUE TEM DE SER SUBSTITUÍDA, NÃO TAPADA.
//
// O Chromium expõe `window.launchQueue` mesmo num separador normal (só que
// nunca lá chega ficheiro nenhum, porque isso é coisa da app instalada). A
// primeira versão deste teste fazia `window.launchQueue = {…}` e ficou a
// medir nada: a atribuição não pega numa propriedade nativa, a app chamava a
// verdadeira, e o duplo registava-se a si próprio. Com defineProperty a
// substituição é real -- e o que se mede passa a ser a app.
await ctx.addInitScript(() => {
  Object.defineProperty(window, "launchQueue", {
    configurable: true,
    value: { setConsumer: (fn) => { window.__consumidorDoArranque = fn; } }
  });
});

const pagina = await ctx.newPage();
const erros = [];
pagina.on("pageerror", (e) => erros.push(e.message));
await pagina.goto(`http://127.0.0.1:${porta}/index.html`, { waitUntil: "networkidle" });
await pagina.waitForTimeout(2500);

console.log("\n== a app fica à espera de um ficheiro do sistema ==");
const espera = await pagina.evaluate(() => typeof window.__consumidorDoArranque === "function");
conferir(espera, "a app consome a fila de arranque — sem isto o duplo clique abria-a vazia");

// ---- 2. UM .cal ABERTO PELO SISTEMA ABRE MESMO -------------------------
console.log("\n== abrir um .cal pelo sistema (duplo clique) ==");
await pagina.evaluate(async () => {
  const n = document.getElementById("proj-nome");
  n.value = "Projeto do duplo clique";
  n.dispatchEvent(new Event("input", { bubbles: true }));
  await new Promise((r) => setTimeout(r, 700));
});
const descarga = await Promise.all([
  pagina.waitForEvent("download", { timeout: 20000 }),
  pagina.evaluate(() => document.getElementById("proj-save").click())
]).then(([d]) => d);
const conteudo = await readFile(await descarga.path(), "utf8");
console.log("   gravado: " + descarga.suggestedFilename());

await pagina.reload({ waitUntil: "networkidle" });
await pagina.waitForTimeout(2500);

const aberto = await pagina.evaluate(async (texto) => {
  document.getElementById("proj-nome").value = "";
  await window.__consumidorDoArranque({
    files: [{ getFile: async () => new File([texto], "duplo-clique.cal", { type: "application/json" }) }]
  });
  await new Promise((r) => setTimeout(r, 2500));
  return { nome: document.getElementById("proj-nome").value,
           toast: (document.getElementById("app-toast") || {}).textContent || "" };
}, conteudo);
console.log("   " + JSON.stringify(aberto));
conferir(aberto.nome === "Projeto do duplo clique",
  "o ficheiro entregue pelo sistema abre pela mesma porta do botão");

// ---- 3. FECHAR COM TRABALHO POR GUARDAR --------------------------------
//
// Mede-se o que é nosso: se a app PEDE a caixa ao browser. O teste apanha o
// pedido em vez da caixa, que é do browser e não se lê daqui.
console.log("\n== fechar a janela ==");
const pergunta = () => pagina.evaluate(() => {
  const e = new Event("beforeunload", { cancelable: true });
  window.dispatchEvent(e);
  return e.defaultPrevented;
});

conferir(!(await pergunta()),
  "acabado de abrir um projeto, não pergunta nada — não há o que perder");

await pagina.evaluate(async () => {
  const el = document.getElementById("proj-nome");
  el.value = "Projeto mexido depois de abrir";
  el.dispatchEvent(new Event("input", { bubbles: true }));
  await new Promise((r) => setTimeout(r, 900));
});
conferir(await pergunta(), "depois de mexer no projeto, pergunta — era o pedido");

const descarga2 = await Promise.all([
  pagina.waitForEvent("download", { timeout: 20000 }),
  pagina.evaluate(() => document.getElementById("proj-save").click())
]).then(([d]) => d);
console.log("   gravado outra vez: " + descarga2.suggestedFilename());
conferir(!(await pergunta()),
  "e depois de gravar, cala-se — o trabalho está no ficheiro");

conferir(erros.length === 0, erros.length ? "erro de JavaScript: " + erros[0] : "sem erros de JavaScript");

await browser.close();
s.close();
console.log("\n" + (falhas ? falhas + " FALHA(S)"
  : "O .cal é desta app, abre-se com dois cliques, e fechar com trabalho por guardar pergunta."));
process.exit(falhas ? 1 : 0);
