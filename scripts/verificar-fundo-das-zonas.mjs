/**
 * SOBREPOR NA FOLHA NÃO É CHOCAR NA SALA.
 *
 * Reportado a olhar para as duas apps lado a lado, com nove zonas arrumadas no
 * Preview 3D e este diagrama a dizer "sobrepõe 0,50 m" três vezes:
 * *"vê o que falta"*.
 *
 * Faltava a terceira dimensão, e faltava nos dois sentidos:
 *
 *   1. as zonas voltam do 3D com o sítio onde ficaram NA SALA (`preview3d`:
 *      ↔, fundo, altura, rodar) e esses números não apareciam em lado nenhum
 *      desta app -- quem arrumou nove zonas lá voltava aqui e encontrava só a
 *      folha chata;
 *   2. e o diagrama chamava "sobrepõe" a duas zonas que estão a metros uma da
 *      outra em fundo. Isso é um alarme a quem montou aquilo de propósito -- e
 *      um alarme errado ensina a ignorar os certos.
 *
 * O que NÃO muda: a medida continua escrita. No canvas de píxeis a
 * sobreposição é real, e para o media server conta. O que muda é a palavra e a
 * cor: "cruza", com o fundo ao lado, em vez de "sobrepõe" a vermelho.
 *
 *   node scripts/verificar-fundo-das-zonas.mjs
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

const { s, porta } = await servidor();
const { chromium } = await carregarPlaywright();
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM || "/opt/pw-browsers/chromium"
});
const ctx = await browser.newContext({ viewport: { width: 1400, height: 950 }, serviceWorkers: "block" });

let falhas = 0;
const conferir = (ok, texto) => { console.log((ok ? "  ✓ " : "  ✗ ") + texto); if (!ok) falhas++; };

const pagina = await ctx.newPage();
const erros = [];
pagina.on("pageerror", (e) => erros.push(e.message));
await pagina.goto(`http://127.0.0.1:${porta}/index.html`, { waitUntil: "networkidle" });
await pagina.waitForTimeout(2500);

/**
 * Duas zonas que se cruzam na folha, vindas do Preview. O `fundo` é o que
 * distingue os dois casos deste teste -- entra pelo mesmo caminho por onde o
 * Preview as devolve de verdade (lzImportarProjetoDoPreview).
 */
const importar = (fundoDaSegunda) => pagina.evaluate(async (fundo) => {
  const projeto = {
    nome: "Duas que se cruzam",
    zonas: [
      { nome: "frente", id: "z1", x: 0, y: 0, w: 4, h: 2.5, tipo: "led",
        preview: { dx: 0, dy: 0, dz: 0, rot: 0 } },
      // Começa 0,5 m ANTES de a primeira acabar: na folha, sobrepõem-se.
      { nome: "atrás", id: "z2", x: 3.5, y: 0, w: 4, h: 2.5, tipo: "led",
        preview: { dx: 0, dy: 0, dz: fundo, rot: -25 } }
    ]
  };
  const n = window.lzImportarProjetoDoPreview(projeto);
  await new Promise((r) => setTimeout(r, 1500));
  const svg = document.getElementById("lz-diagram");
  const detalhes = document.getElementById("lz-diagram-details");
  return {
    zonas: n,
    cotas: svg ? [...svg.querySelectorAll("text")].map((t) => t.textContent.trim()) : [],
    vermelhas: svg ? [...svg.querySelectorAll("text")].filter((t) =>
      /sobrepõe/.test(t.textContent)).length : 0,
    detalhes: detalhes ? detalhes.textContent.replace(/\s+/g, " ") : ""
  };
}, fundoDaSegunda);

// ---- 1. Mesma parede: sobrepor é sobrepor -----------------------------
console.log("\n== duas zonas na MESMA parede, a cruzarem-se 0,50 m ==");
const mesmaParede = await importar(0);
console.log("   cotas: " + JSON.stringify(mesmaParede.cotas.filter((t) => /m$|m ·/.test(t))));
conferir(mesmaParede.zonas === 2, "as duas zonas entraram");
conferir(mesmaParede.cotas.some((t) => /sobrepõe 0,50 m/.test(t)),
  "no mesmo plano, continua a dizer SOBREPÕE — é uma colisão a sério");

// ---- 2. Uma delas empurrada para o fundo no 3D ------------------------
//
// É o caso da fotografia: nove zonas arrumadas na sala, umas à frente das
// outras, e o diagrama a gritar sobreposições que não existem.
console.log("\n== a segunda empurrada 9,60 m para o fundo, no 3D ==");
const comFundo = await importar(9.6);
console.log("   cotas: " + JSON.stringify(comFundo.cotas.filter((t) => /m$|m ·/.test(t))));
conferir(comFundo.cotas.some((t) => /cruza 0,50 m/.test(t)),
  "passa a dizer CRUZA — na sala uma está à frente da outra");
conferir(comFundo.cotas.some((t) => /9,60 m de fundo/.test(t)),
  "e diz QUANTO fundo há entre elas, que é o número que faltava");
conferir(!comFundo.cotas.some((t) => /sobrepõe/.test(t)),
  "e já não dá o alarme de colisão a quem montou aquilo de propósito");

// ---- 3. Os números do 3D ficam à vista --------------------------------
console.log("\n== e o que o 3D fez a cada zona lê-se aqui ==");
console.log("   " + comFundo.detalhes.slice(0, 220));
conferir(/no 3D: fundo 9,60 m/.test(comFundo.detalhes),
  "o fundo de cada zona aparece na lista — antes não estava em lado nenhum");
conferir(/rodada -25°/.test(comFundo.detalhes),
  "e a rotação também — é o que esta folha chata não consegue desenhar");
conferir(!/no 3D:/.test(comFundo.detalhes.split("atrás")[0] || ""),
  "e a zona que ninguém mexeu não leva nada a dizer — só se escreve o que foi mexido");

// ---- 4. Um projeto que nunca foi ao 3D fica como estava ---------------
//
// É a maioria: sem `preview3d` não há terceira dimensão nenhuma para
// consultar, e inventar uma era pior do que não a ter.
console.log("\n== um projeto que nunca foi ao 3D ==");
const semPreview = await pagina.evaluate(async () => {
  const projeto = { nome: "Sem 3D", zonas: [
    { nome: "a", id: "a", x: 0, y: 0, w: 4, h: 2.5, tipo: "led" },
    { nome: "b", id: "b", x: 3.5, y: 0, w: 4, h: 2.5, tipo: "led" }
  ] };
  window.lzImportarProjetoDoPreview(projeto);
  await new Promise((r) => setTimeout(r, 1500));
  const svg = document.getElementById("lz-diagram");
  return {
    cotas: [...svg.querySelectorAll("text")].map((t) => t.textContent.trim()),
    detalhes: document.getElementById("lz-diagram-details").textContent
  };
});
conferir(semPreview.cotas.some((t) => /sobrepõe 0,50 m/.test(t)),
  "sem informação do 3D, sobrepor continua a ser sobrepor");
conferir(!/no 3D:/.test(semPreview.detalhes),
  "e não se inventa um fundo que ninguém deu");

conferir(erros.length === 0, erros.length ? "erro de JavaScript: " + erros[0] : "sem erros de JavaScript");

await browser.close();
s.close();
console.log("\n" + (falhas ? falhas + " FALHA(S)"
  : "A folha já sabe o que o 3D fez às zonas — e deixou de gritar colisões que não existem."));
process.exit(falhas ? 1 : 0);
