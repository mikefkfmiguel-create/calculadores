/**
 * AS DUAS JANELAS SÃO A MESMA LISTA — e nenhuma come o trabalho da outra.
 *
 * Reportado a trabalhar com as duas abertas: *"como adiciono ao projeto daqui,
 * que não está a desenhar dentro da calculadora no complexo"*. E estava certo:
 * a página solta (ecra-complexo.html) e a aba Ecrã Complexo dos Calculadores
 * guardam na MESMA chave — nada se perdia — mas a janela que não fez a mudança
 * nunca ia lá buscar. Construía-se o conjunto numa e a outra ficava vazia.
 *
 * O SEGUNDO CASO É O QUE IMPORTA MAIS, e só apareceu ao medir: a primeira
 * versão desta ligação PERDIA ZONAS. A janela A acrescenta a zona 1, a B
 * recebe-a e regrava-a, esse eco chega a A -- que entretanto já ia na zona 2 --
 * e A apaga a zona 2 para ficar igual ao eco. Trabalho acabado de escrever a
 * desaparecer em silêncio, por a app estar a falar sozinha.
 *
 *   node scripts/verificar-duas-janelas.mjs
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

const TILE = {
  modelValue: "custom", tipo: "led", posMode: "center", sizeMode: "tiles",
  mw: "500", mh: "500", rx: "192", ry: "192", weight: "6.3", amp: "0.65", visible: true
};
const z = (nome, mx, my, posX) => ({ ...TILE, name: nome, mx: String(mx), my: String(my),
                                     posX: String(posX), posY: "0" });

const { s, porta } = await servidor();
const { chromium } = await carregarPlaywright();
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM || "/opt/pw-browsers/chromium"
});
const ctx = await browser.newContext({ viewport: { width: 1400, height: 950 }, serviceWorkers: "block" });

let falhas = 0;
const conferir = (ok, texto) => { console.log((ok ? "  ✓ " : "  ✗ ") + texto); if (!ok) falhas++; };

const app = await ctx.newPage();
const solta = await ctx.newPage();
const erros = [];
app.on("pageerror", (e) => erros.push("app: " + e.message));
solta.on("pageerror", (e) => erros.push("solta: " + e.message));

await app.goto(`http://127.0.0.1:${porta}/index.html`, { waitUntil: "networkidle" });
await app.waitForFunction(() => document.querySelectorAll("#l-model option").length > 3, null, { timeout: 20000 });
await solta.goto(`http://127.0.0.1:${porta}/ecra-complexo.html`, { waitUntil: "networkidle" });
await solta.waitForFunction(() => typeof window.lzAddZone === "function", null, { timeout: 20000 });
await solta.waitForTimeout(600);

const nomes = (p) => p.evaluate(() =>
  [...document.querySelectorAll("#lz-list .card .lz-name")].map((e) => e.value));
const guardadas = (p) => p.evaluate(() => {
  try { return (JSON.parse(localStorage.getItem("calculadores-zonas-v1") || "[]") || []).map((x) => x.name); }
  catch (e) { return ["(ilegível)"]; }
});

// ---- 1. O que ele fez: construir na janela solta, com a outra aberta ------
console.log("\n== construir na janela solta ==");
await solta.evaluate((zs) => {
  document.getElementById("lz-list").innerHTML = "";
  zs.forEach((x) => window.lzAddZone(x.name, x, false));
}, [z("wings", 8, 2, -20), z("tira 1", 2, 10, 0), z("right side", 5, 7, 12)]);
await solta.waitForTimeout(2000);

const naSolta = await nomes(solta), naApp = await nomes(app);
console.log("   solta: " + JSON.stringify(naSolta));
console.log("   app:   " + JSON.stringify(naApp));
conferir(naSolta.length === 3, "a janela onde se escreveu ficou com as TRÊS zonas (perder aqui é perder trabalho)");
conferir(JSON.stringify(naApp) === JSON.stringify(naSolta), "e a calculadora do lado mostra exactamente o mesmo");
conferir(JSON.stringify(await guardadas(solta)) === JSON.stringify(naSolta), "o que está guardado é o mesmo");

// ---- 2. E no sentido contrário -------------------------------------------
console.log("\n== e agora mexer na calculadora ==");
await app.evaluate((x) => window.lzAddZone(x.name, x, false), z("delay", 2, 2, 20));
await app.waitForTimeout(2000);
const naApp2 = await nomes(app), naSolta2 = await nomes(solta);
console.log("   app:   " + JSON.stringify(naApp2));
console.log("   solta: " + JSON.stringify(naSolta2));
conferir(naApp2.length === 4, "a calculadora ficou com as quatro");
conferir(JSON.stringify(naSolta2) === JSON.stringify(naApp2), "e a janela solta acompanhou");

// ---- 3. Limpar de um lado limpa o outro ----------------------------------
console.log("\n== limpar numa ==");
await solta.evaluate(() => {
  document.getElementById("lz-list").innerHTML = "";
  if (typeof window.calcLedZones === "function") window.calcLedZones();
  else document.getElementById("lz-list").dispatchEvent(new Event("input", { bubbles: true }));
});
await solta.waitForTimeout(1800);
const naApp3 = await nomes(app);
console.log("   app: " + JSON.stringify(naApp3));
conferir(naApp3.length === 0, "limpar numa janela limpa a outra");

conferir(erros.length === 0, erros.length ? "erro de JavaScript: " + erros[0] : "sem erros de JavaScript");

await browser.close();
s.close();
console.log("\n" + (falhas ? falhas + " FALHA(S)" : "As duas janelas são a mesma lista, e nenhuma come o trabalho da outra."));
process.exit(falhas ? 1 : 0);
