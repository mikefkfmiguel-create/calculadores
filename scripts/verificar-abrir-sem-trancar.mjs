/**
 * ABRIR UM PROJETO NÃO PODE TRANCAR A APP.
 *
 * Reportado com o ficheiro na mão — um casamento com sete ecrãs: *"está a dar
 * erro ao abrir, fica travada a app"*.
 *
 * Não era erro nenhum, e não era um ciclo infinito: o JavaScript estava vivo e
 * as sete zonas tinham entrado bem. O que abria com elas eram **sete caixas
 * "Editar zona", modais, empilhadas** — fechava-se uma e aparecia a seguinte.
 * Uma `<dialog>` modal tapa a página inteira; sete são a app trancada.
 *
 * A causa era um argumento por omissão ao contrário. `lzAddZone(nome, opts,
 * startOpen)` abria o editor a quem não dissesse nada — certo para o "+ Ecrã"
 * à mão, errado para tudo o resto. Dos onze sítios que lhe chamam, nove diziam
 * `false` de propósito; os dois que **repõem** um projeto esqueceram-se.
 *
 * O que este teste guarda, e que nenhum dos outros guardava:
 *
 *   1. abrir um projeto com VÁRIAS zonas não deixa **nenhuma** caixa aberta —
 *      era o que faltava medir. O `verificar-abrir-projeto` só usava projetos
 *      de uma zona ou estragados de propósito, e uma caixa só parece um
 *      defeito pequeno; sete são outra coisa;
 *   2. as zonas entram todas e com os nomes certos — a cura não pode ser
 *      deixar de repor;
 *   3. o "+ Ecrã" à mão CONTINUA a abrir o editor, que é o que se quer lá;
 *   4. e duas caixas não se empilham venha de onde vier o pedido.
 *
 *   node scripts/verificar-abrir-sem-trancar.mjs
 */

import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = fileURLToPath(new URL("..", import.meta.url));

const TIPOS = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8",
  ".png": "image/png", ".svg": "image/svg+xml", ".ico": "image/x-icon",
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

// O projeto dele, reduzido ao que interessa a este teste: SETE zonas, que é o
// número que transformou um defeito pequeno numa app trancada. Os valores são
// os do ficheiro que ele mandou (tiles de 500 mm, 192×192 px), não inventados.
function zona(nome, mx, my, posX) {
  return {
    visible: true, modelValue: "10", tipo: "led", posMode: "center", sizeMode: "tiles",
    mx: String(mx), my: String(my), targetW: "2.0", targetH: "1.5",
    mw: "500", mh: "500", rx: "192", ry: "192", weight: "6.3", amp: "0.65",
    delayRx: "", delayRy: "", curveEnabled: false, curveMode: "angle",
    curveValue: "5", curveDir: "concave", name: nome,
    zid: "z" + nome.replace(/\W/g, ""), origem: null,
    posX: String(posX), posY: "0", ref: false
  };
}

const PROJETO = {
  _app: "calculadores-projeto", _v: 1, nome: "", projtype: "led",
  ledModelName: "custom", ledSizeMode: "tiles", ledMx: "16", ledMy: "9",
  ledW: "8.0", ledH: "4.5", ledUseZones: true,
  ledZones: [
    zona("trira", 3, 8, -7.55), zona("tiras pequenas", 2, 6, -5.24),
    zona("tiras pequenas 2", 2, 6, -3.15), zona("trira 2", 3, 8, -1.05),
    zona("tiras pequenas 3", 2, 6, 1.26), zona("tiras pequenas 4", 2, 6, 3.24),
    zona("trira 3", 3, 8, 5.45)
  ]
};

const { s, porta } = await servidor();
const { chromium } = await carregarPlaywright();
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM || "/opt/pw-browsers/chromium"
});
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: "block" });

let falhas = 0;
const conferir = (ok, texto) => { console.log((ok ? "  ✓ " : "  ✗ ") + texto); if (!ok) falhas++; };

const pagina = await ctx.newPage();
const erros = [];
pagina.on("pageerror", (e) => erros.push(e.message));
await pagina.goto(`http://127.0.0.1:${porta}/index.html`, { waitUntil: "networkidle" });
await pagina.waitForTimeout(2500);

// O que está MESMO no ecrã: quantas caixas modais abertas, e que zonas há.
const olhar = () => pagina.evaluate(() => ({
  abertas: document.querySelectorAll(".lz-details-dialog[open]").length,
  zonas: document.querySelectorAll("#lz-list > *").length,
  nomes: [...document.querySelectorAll("#lz-list .lz-name, #lz-list input.lz-name")]
    .map((e) => e.value || e.textContent).filter(Boolean)
}));

const abrirFicheiro = (projeto) => pagina.evaluate((texto) => {
  const dt = new DataTransfer();
  dt.items.add(new File([texto], "casamento.cal", { type: "application/json" }));
  const i = document.getElementById("proj-open-file");
  i.files = dt.files;
  i.dispatchEvent(new Event("change", { bubbles: true }));
}, JSON.stringify(projeto));

// ---- 1. O CASO DELE: sete ecrãs de um casamento -----------------------
console.log("\n== abrir um projeto com sete ecrãs ==");
await abrirFicheiro(PROJETO);
await pagina.waitForTimeout(2500);
const depois = await olhar();
console.log("   zonas=" + depois.zonas + " · caixas abertas=" + depois.abertas);
conferir(depois.zonas === 7, "as sete zonas entraram (" + depois.zonas + ")");
conferir(depois.abertas === 0,
  "e NENHUMA caixa «Editar zona» ficou aberta — eram sete, e era isso a app trancada");

// A app tem de continuar a responder ao toque: uma modal aberta não trava o
// JavaScript, trava a PESSOA. Por isso mede-se o que ela consegue fazer a
// seguir, e não só se o script responde.
const mexeu = await pagina.evaluate(async () => {
  const b = document.querySelector('.tab[data-mode="zonas"]');
  if (!b) return "sem aba";
  b.click();
  await new Promise((r) => setTimeout(r, 600));
  return (document.querySelector('.tab[aria-selected="true"]') || {}).textContent || "";
});
conferir(/complexo/i.test(mexeu), "e dá para mudar de aba a seguir — a app está mesmo a responder");

// ---- 2. O "+ Ecrã" à mão continua a abrir o editor ---------------------
//
// É metade do arranjo: tirar o popup a quem repõe não pode tirá-lo a quem
// acrescenta, que é onde ele serve.
console.log("\n== e o «+ Ecrã» à mão continua a abrir o editor ==");
await pagina.evaluate(() => {
  [...document.querySelectorAll(".lz-details-dialog[open]")].forEach((d) => d.close());
  const b = document.querySelector("#lz-add, #lz-add-top, #lz-add-canvas");
  if (b) b.click();
});
await pagina.waitForTimeout(700);
const aMao = await olhar();
console.log("   zonas=" + aMao.zonas + " · caixas abertas=" + aMao.abertas);
conferir(aMao.zonas === 8, "a zona nova entrou");
conferir(aMao.abertas === 1, "e o editor dela abriu-se — é para isso que ele serve ali");

// ---- 3. Duas nunca se empilham ----------------------------------------
console.log("\n== duas caixas não se empilham, venha de onde vier ==");
const empilhar = await pagina.evaluate(async () => {
  // Pede-se a abertura de TODAS as caixas de uma vez, por baixo dos botões,
  // como fazia o caminho estragado.
  const todas = [...document.querySelectorAll(".lz-details-dialog")];
  todas.forEach((d) => { try { d.showModal(); } catch (e) {} });
  await new Promise((r) => setTimeout(r, 200));
  const empilhadas = document.querySelectorAll(".lz-details-dialog[open]").length;
  todas.forEach((d) => { try { d.close(); } catch (e) {} });
  return empilhadas;
});
console.log("   showModal() em todas de uma vez → " + empilhar + " aberta(s) sem passar pela app");
const pelaApp = await pagina.evaluate(async () => {
  const botoes = [...document.querySelectorAll("#lz-list .lz-edit-btn")];
  for (const b of botoes.slice(0, 3)) { b.click(); await new Promise((r) => setTimeout(r, 250)); }
  return { botoes: botoes.length,
           abertas: document.querySelectorAll(".lz-details-dialog[open]").length };
});
console.log("   botões de editar encontrados: " + pelaApp.botoes);
// Um zero aqui não é "passou": é o teste a não ter carregado em nada. Por isso
// a contagem dos botões é conferida à parte — uma verificação que mede o
// vazio é pior do que verificação nenhuma, porque dá descanso.
conferir(pelaApp.botoes >= 3, "há botões de editar nas zonas para carregar (" + pelaApp.botoes + ")");
conferir(pelaApp.abertas === 1,
  "abrir três zonas seguidas pelos botões deixa UMA aberta (" + pelaApp.abertas + ") — a anterior fecha-se");

conferir(erros.length === 0, erros.length ? "erro de JavaScript: " + erros[0] : "sem erros de JavaScript");

await browser.close();
s.close();
console.log("\n" + (falhas ? falhas + " FALHA(S)"
  : "Abrir um projeto repõe as zonas e não tranca a app."));
process.exit(falhas ? 1 : 0);
