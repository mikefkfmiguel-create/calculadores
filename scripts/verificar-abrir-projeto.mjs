/**
 * ABRIR UM PROJETO NUNCA PODE FALHAR CALADO.
 *
 * Reportado assim: *"a calculadora ao abrir um projeto crasha em silêncio"*.
 *
 * O apanhador de erros da app (js/recado-de-erro.js) já mostra o que rebenta
 * — mas só vê o que ninguém apanhou. Um erro dentro de um `try/catch`, ou um
 * `return` sem uma palavra, passam-lhe ao lado: a app não morre, só não faz
 * nada. Do lado de quem carregou no projeto é a mesma coisa que morrer.
 *
 * Havia três desses caminhos, e é isso que este teste guarda:
 *
 *   1. uma entrada do histórico sem o projeto lá dentro (o navegador corta as
 *      chaves grandes quando o espaço acaba) -- carregava-se e não acontecia
 *      NADA;
 *   2. uma entrada que rebenta a meio de ser reposta -- o ecrã ficava com meio
 *      projeto e ninguém sabia;
 *   3. um ficheiro que o browser não consegue LER (na nuvem e sem rede, movido,
 *      sem permissão) -- o FileReader só tinha onload, e a falha não tinha
 *      sequer para onde ir.
 *
 * O que se mede não é a app aguentar tudo: é ela DIZER. Uma app que responde
 * ao toque com silêncio não se distingue de uma avariada.
 *
 *   node scripts/verificar-abrir-projeto.mjs
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
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 },
                                       serviceWorkers: "block", acceptDownloads: true });

let falhas = 0;
const conferir = (ok, texto) => { console.log((ok ? "  ✓ " : "  ✗ ") + texto); if (!ok) falhas++; };

const pagina = await ctx.newPage();
await pagina.goto(`http://127.0.0.1:${porta}/index.html`, { waitUntil: "networkidle" });
await pagina.waitForTimeout(2500);

const CHAVE = "calculadores-historico-v1";
const chaveDoHistorico = await pagina.evaluate((tentativa) => {
  // A chave verdadeira é a que a app usa; procura-se pelo prefixo para o teste
  // não ficar preso a um nome que ela pode vir a mudar.
  const todas = Object.keys(localStorage).filter((k) => /historico/i.test(k));
  return todas[0] || tentativa;
}, CHAVE);
console.log("   chave do histórico: " + chaveDoHistorico);

const escreverHistorico = (lista) => pagina.evaluate(([chave, lista]) => {
  localStorage.setItem(chave, JSON.stringify(lista));
  // A lista no ecrã relê do localStorage; basta pedir-lhe que se reescreva.
  const recarregar = document.getElementById("proj-historico");
  return !!recarregar;
}, [chaveDoHistorico, lista]);

const textoDoHistorico = () => pagina.evaluate(() => {
  const c = document.getElementById("proj-historico");
  return c ? c.textContent.replace(/\s+/g, " ").trim() : "";
});

// ---- 1. Uma entrada sem o projeto lá dentro ----------------------------
//
// É o que o navegador deixa quando corta uma chave grande por falta de
// espaço: a entrada fica, o estado não.
console.log("\n== uma entrada do histórico sem o projeto lá dentro ==");
await escreverHistorico([{ nome: "Projeto cortado ao meio", quando: Date.now() }]);
await pagina.reload({ waitUntil: "networkidle" });
await pagina.waitForTimeout(2500);

const antes1 = await textoDoHistorico();
const tocou1 = await pagina.evaluate(async () => {
  const b = document.querySelector("#proj-historico [data-abrir], #proj-historico button");
  if (!b) return { havia: false };
  b.click();
  await new Promise((r) => setTimeout(r, 900));
  return { havia: true };
});
const depois1 = await textoDoHistorico();
console.log("   " + depois1.slice(0, 160));
conferir(tocou1.havia, "a entrada aparece na lista, com botão para abrir");
conferir(depois1 !== antes1 && /não tem o projeto|espaço/i.test(depois1),
  "e tocar-lhe DIZ o que se passa — antes não acontecia nada");

// ---- 2. Uma entrada que rebenta a meio --------------------------------
//
// Zonas com um buraco: é o que sobra de um ficheiro escrito a meio. A app
// pode não conseguir repô-la — o que não pode é ficar calada com meio projeto
// no ecrã.
console.log("\n== uma entrada que rebenta a meio de ser reposta ==");
await escreverHistorico([{
  nome: "Projeto estragado",
  quando: Date.now(),
  // Um estado com um buraco na lista das zonas: é o que sobra de um ficheiro
  // escrito a meio, e é onde a app rebenta a tentar reconstruí-lo.
  estado: { nome: "Projeto estragado", projtype: "led",
            ledUseZones: true, ledZones: [null] }
}]);
await pagina.reload({ waitUntil: "networkidle" });
await pagina.waitForTimeout(2500);
const partiu = await pagina.evaluate(async () => {
  const b = document.querySelector("#proj-historico [data-abrir], #proj-historico button");
  if (b) b.click();
  await new Promise((r) => setTimeout(r, 1200));
  const c = document.getElementById("proj-historico");
  return { texto: c ? c.textContent.replace(/\s+/g, " ").trim() : "",
           contados: (window.recadoDeErro ? window.recadoDeErro.ocorrencias().length : -1) };
});
console.log("   " + partiu.texto.slice(0, 180));
conferir(/não consegui abrir/i.test(partiu.texto),
  "a app diz que não conseguiu abrir aquele até ao fim, e porquê");
conferir(partiu.contados > 0,
  "e a falha entra no detalhe que se copia numa mensagem — é com isso que se arranja");

// ---- 3. Um ficheiro que não se consegue LER ---------------------------
//
// Não é o ficheiro errado nem o ficheiro estragado: é o ficheiro que o browser
// não chega a ler. O FileReader só tinha onload, e a falha não tinha para onde
// ir. Aqui obriga-se o erro, trocando o FileReader por um que falha.
console.log("\n== um ficheiro que o browser não consegue ler ==");
await pagina.reload({ waitUntil: "networkidle" });
await pagina.waitForTimeout(2500);
const naoLeu = await pagina.evaluate(async () => {
  const Original = window.FileReader;
  window.FileReader = function () {
    const eu = { onload: null, onerror: null, error: { message: "ficheiro indisponível" },
                 readAsText: function () { setTimeout(() => { if (eu.onerror) eu.onerror(); }, 30); } };
    return eu;
  };
  const dt = new DataTransfer();
  dt.items.add(new File(["{}"], "na-nuvem.cal", { type: "application/json" }));
  const i = document.getElementById("proj-open-file");
  i.files = dt.files;
  i.dispatchEvent(new Event("change", { bubbles: true }));
  await new Promise((r) => setTimeout(r, 900));
  window.FileReader = Original;
  const t = document.getElementById("app-toast");
  return t ? t.textContent.replace(/\s+/g, " ").trim() : "";
});
console.log("   " + naoLeu);
conferir(/não consegui ler/i.test(naoLeu),
  "a app diz que não conseguiu ler o ficheiro — antes não dizia nada nenhum");

// ---- 4. E o caminho bom continua bom ----------------------------------
console.log("\n== e um projeto a sério continua a abrir ==");
const bom = await pagina.evaluate(async () => {
  const nome = document.getElementById("proj-nome");
  nome.value = "Projeto que abre bem";
  nome.dispatchEvent(new Event("input", { bubbles: true }));
  await new Promise((r) => setTimeout(r, 600));
  return !!nome.value;
});
const descarga = await Promise.all([
  pagina.waitForEvent("download", { timeout: 20000 }),
  pagina.evaluate(() => document.getElementById("proj-save").click())
]).then(([d]) => d);
const conteudo = await readFile(await descarga.path(), "utf8");

await pagina.reload({ waitUntil: "networkidle" });
await pagina.waitForTimeout(2500);
const reaberto = await pagina.evaluate(async (t) => {
  const dt = new DataTransfer();
  dt.items.add(new File([t], "bom.cal", { type: "application/json" }));
  const i = document.getElementById("proj-open-file");
  i.files = dt.files;
  i.dispatchEvent(new Event("change", { bubbles: true }));
  await new Promise((r) => setTimeout(r, 1800));
  return { nome: (document.getElementById("proj-nome") || {}).value || "",
           erros: window.recadoDeErro ? window.recadoDeErro.ocorrencias() : [] };
}, conteudo);
console.log("   " + JSON.stringify(reaberto));
conferir(bom && reaberto.nome === "Projeto que abre bem",
  "grava e reabre, com o nome certo");
conferir(reaberto.erros.length === 0, "e sem nada a contar — porque não houve nada");

await browser.close();
s.close();
console.log("\n" + (falhas ? falhas + " FALHA(S)"
  : "Abrir um projeto ou abre, ou diz porque não — nunca fica calado."));
process.exit(falhas ? 1 : 0);
