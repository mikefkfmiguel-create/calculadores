/**
 * OS FICHEIROS DIZEM DE QUE APP SÃO — E O ANTIGO CONTINUA A ABRIR.
 *
 * Pedido: *"os ficheiros gravados nas duas apps devem ter extensões que os
 * identifique, sair apenas json não sei nunca qual é de onde. Podia ser «Pvw»
 * para o 3D e «Cal» para as calculadoras"*.
 *
 * O que isto mede não é o nome bonito — é o que se perde ao mudá-lo:
 *
 *   1. o nome novo sai mesmo (.cal e .pvw), dos dois lados;
 *   2. os ficheiros JÁ GRAVADOS (.calculadores.json, .preview.json) continuam
 *      a abrir. Uma extensão nova que deixasse de fora o que está no telemóvel
 *      era perder trabalho feito por causa de uma etiqueta;
 *   3. trocado o ficheiro, a app diz de QUEM ele é, não só que não é dela --
 *      que é o ponto todo do pedido;
 *   4. o accept="" leva as extensões por extenso. São desconhecidas do sistema
 *      e chegam sem tipo: um accept só com "application/json" punha-as a
 *      cinzento no seletor do telemóvel, impossíveis de escolher.
 *
 * As duas apps têm de ser servidas da MESMA origem (é o que elas são em
 * produção), por isso este teste serve /home/user inteiro.
 *
 *   node scripts/verificar-extensoes.mjs
 */

import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = fileURLToPath(new URL("../..", import.meta.url));   // /home/user

const TIPOS = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8",
  ".png": "image/png", ".svg": "image/svg+xml", ".webmanifest": "application/manifest+json"
};

function servidor() {
  return new Promise((resolve) => {
    const s = createServer(async (req, res) => {
      const caminho = decodeURIComponent(req.url.split("?")[0]);
      const ficheiro = join(RAIZ, normalize(caminho).replace(/^(\.\.[/\\])+/, ""));
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

let falhas = 0;
const conferir = (ok, texto) => { console.log((ok ? "  ✓ " : "  ✗ ") + texto); if (!ok) falhas++; };

const ctx = await browser.newContext({ viewport: { width: 1400, height: 950 },
                                       serviceWorkers: "block", acceptDownloads: true });
const erros = [];

// ---- 1. Que nome sai de cada app ----------------------------------------
console.log("\n== o nome com que cada app grava ==");
const calc = await ctx.newPage();
calc.on("pageerror", (e) => erros.push("calc: " + e.message));
await calc.goto(`http://127.0.0.1:${porta}/calculadores/index.html`, { waitUntil: "networkidle" });
await calc.waitForFunction(() => !!window.mikeappsFicheiros, null, { timeout: 20000 });

const prev = await ctx.newPage();
prev.on("pageerror", (e) => erros.push("preview: " + e.message));
await prev.goto(`http://127.0.0.1:${porta}/preview/index.html`, { waitUntil: "networkidle" });
await prev.waitForFunction(() => !!window.mikeappsFicheiros, null, { timeout: 20000 });

const nomes = await calc.evaluate(() => ({
  cal: window.mikeappsFicheiros.nomeDoFicheiro("calculadores", "Festa São João — Sala 1"),
  pvw: window.mikeappsFicheiros.nomeDoFicheiro("preview", "Festa São João — Sala 1"),
  semNome: window.mikeappsFicheiros.nomeDoFicheiro("calculadores", "")
}));
console.log("   " + JSON.stringify(nomes));
conferir(nomes.cal.endsWith(".cal"), "os Calculadores gravam .cal — " + nomes.cal);
conferir(nomes.pvw.endsWith(".pvw"), "o Preview grava .pvw — " + nomes.pvw);
conferir(!/[^a-z0-9.\-]/.test(nomes.cal),
  "sem acentos nem espaços: estes ficheiros viajam por email e WhatsApp");
conferir(nomes.semNome === "projeto.cal", "um projeto sem nome também tem nome de ficheiro");

// E a regra é a MESMA dos dois lados — o ficheiro é copiado, não reescrito.
const doOutroLado = await prev.evaluate(() => ({
  cal: window.mikeappsFicheiros.nomeDoFicheiro("calculadores", "Festa São João — Sala 1"),
  pvw: window.mikeappsFicheiros.nomeDoFicheiro("preview", "Festa São João — Sala 1")
}));
conferir(doOutroLado.cal === nomes.cal && doOutroLado.pvw === nomes.pvw,
  "as duas apps dão exactamente o mesmo nome (a regra está num sítio só)");

// ---- 2. Quem é quem, e o que se diz quando está trocado ------------------
console.log("\n== trocar o ficheiro: a app diz de QUEM ele é ==");
const julgamento = await calc.evaluate(() => {
  const f = window.mikeappsFicheiros;
  const doCalc = { _app: "calculadores-projeto", nome: "x" };
  const doPrev = { tipo: "preview-projeto", nome: "x" };
  return {
    reconheceCalc: f.deQuemE(doCalc), reconhecePrev: f.deQuemE(doPrev),
    lixo: f.deQuemE({ qualquer: "coisa" }), nada: f.deQuemE(null),
    prevNoCalc: f.recadoDeFicheiroErrado(doPrev, "calculadores"),
    calcNoPrev: f.recadoDeFicheiroErrado(doCalc, "preview"),
    lixoNoCalc: f.recadoDeFicheiroErrado({ qualquer: "coisa" }, "calculadores")
  };
});
conferir(julgamento.reconheceCalc === "calculadores" && julgamento.reconhecePrev === "preview",
  "cada ficheiro é reconhecido pelo que tem DENTRO, não pelo nome");
conferir(julgamento.lixo === null && julgamento.nada === null,
  "um ficheiro qualquer não é dado como de nenhuma das duas");
console.log("   .pvw nos Calculadores: " + julgamento.prevNoCalc);
console.log("   .cal no Preview:       " + julgamento.calcNoPrev);
conferir(/Preview 3D/.test(julgamento.prevNoCalc) && /\.pvw/.test(julgamento.prevNoCalc),
  "os Calculadores dizem que aquilo é do Preview, e não só «não é meu»");
conferir(/Calculadores/.test(julgamento.calcNoPrev) && /\.cal/.test(julgamento.calcNoPrev),
  "e o Preview diz que aquilo é dos Calculadores");
conferir(/\.cal/.test(julgamento.lixoNoCalc),
  "com um ficheiro estranho, diz pelo menos qual é a extensão certa");

// ---- 3. O accept="" deixa mesmo escolher os novos e os antigos -----------
console.log("\n== o seletor de ficheiros ==");
const aceites = await calc.evaluate(() =>
  (document.getElementById("proj-open-file") || {}).accept || "");
const aceitesPrev = await prev.evaluate(() =>
  (document.getElementById("ficheiroProjeto") || {}).accept || "");
console.log("   calculadores: " + aceites);
console.log("   preview:      " + aceitesPrev);
[[aceites, "Calculadores"], [aceitesPrev, "Preview"]].forEach(([a, quem]) => {
  conferir(/\.cal/.test(a) && /\.pvw/.test(a),
    quem + ": as extensões vão por extenso (senão ficam a cinzento no telemóvel)");
  conferir(/\.json/.test(a),
    quem + ": e o .json de antes continua escolhível — há projetos gravados assim");
});

// ---- 4. O QUE MAIS IMPORTA: a volta completa, e o ficheiro antigo --------
//
// Aqui não se inventa o conteúdo de um ficheiro: GRAVA-SE pela app, para o
// que se reabre ser mesmo o que ela produz. Um teste com um JSON escrito à
// mão prova que a app lê o que EU acho que ela grava -- que é outra coisa.
console.log("\n== gravar e reabrir, pela app ==");
await calc.evaluate(() => {
  const n = document.getElementById("proj-nome");
  n.value = "Festa São João — Sala 1";
  n.dispatchEvent(new Event("input", { bubbles: true }));
});
const descarga = await Promise.all([
  calc.waitForEvent("download", { timeout: 15000 }),
  calc.evaluate(() => document.getElementById("proj-save").click())
]).then(([d]) => d);

const nomeGravado = descarga.suggestedFilename();
console.log("   gravou: " + nomeGravado);
conferir(nomeGravado === "festa-sao-joao-sala-1.cal",
  "o ficheiro sai mesmo com .cal (e não um nome só à espera de ser usado)");

const caminho = await descarga.path();
const conteudo = await readFile(caminho, "utf8");
const gravado = JSON.parse(conteudo);
conferir(gravado._app === "calculadores-projeto" && gravado.nome === "Festa São João — Sala 1",
  "por dentro continua a ser JSON legível, com o projeto lá todo");

// Agora limpa-se o campo e reabre-se o MESMO conteúdo, com o nome ANTIGO --
// que é o ficheiro que ele tem gravado no telemóvel do mês passado. Se isto
// falhar, a mudança de extensão apagou trabalho que já existia.
console.log("\n== e um ficheiro gravado ANTES desta mudança ==");
const abriu = await calc.evaluate(async (texto) => {
  document.getElementById("proj-nome").value = "";
  const dt = new DataTransfer();
  dt.items.add(new File([texto], "festa.calculadores.json", { type: "application/json" }));
  const input = document.getElementById("proj-open-file");
  input.files = dt.files;
  input.dispatchEvent(new Event("change", { bubbles: true }));
  await new Promise((r) => setTimeout(r, 900));
  return {
    nome: (document.getElementById("proj-nome") || {}).value || "",
    toast: (document.getElementById("app-toast") || {}).textContent || ""
  };
}, conteudo);
console.log("   " + JSON.stringify(abriu));
conferir(abriu.nome === "Festa São João — Sala 1",
  "um .calculadores.json de antes abre na mesma (não se perde nada do que já está gravado)");

// E um .pvw aberto nos Calculadores é recusado COM O RECADO certo.
const trocado = await calc.evaluate(async () => {
  const dt = new DataTransfer();
  dt.items.add(new File([JSON.stringify({ tipo: "preview-projeto" })], "festa.pvw",
    { type: "application/json" }));
  const input = document.getElementById("proj-open-file");
  input.files = dt.files;
  input.dispatchEvent(new Event("change", { bubbles: true }));
  await new Promise((r) => setTimeout(r, 700));
  return (document.getElementById("app-toast") || {}).textContent || "";
});
console.log("   ao abrir um .pvw aqui: " + trocado);
conferir(/Preview 3D/.test(trocado),
  "e abrir um .pvw nos Calculadores diz para onde ele é, em vez de só recusar");

// ---- 5. E a mesma volta do lado do Preview ------------------------------
console.log("\n== gravar e reabrir, pelo Preview ==");
await prev.evaluate(() => {
  const n = document.getElementById("nomeProjeto");
  n.value = "Festa São João — Sala 1";
  n.dispatchEvent(new Event("input", { bubbles: true }));
});
const descargaPrev = await Promise.all([
  prev.waitForEvent("download", { timeout: 15000 }),
  prev.evaluate(() => document.getElementById("btGuardarProjeto").click())
]).then(([d]) => d);

console.log("   gravou: " + descargaPrev.suggestedFilename());
conferir(descargaPrev.suggestedFilename().endsWith(".pvw"),
  "o Preview grava mesmo em .pvw — " + descargaPrev.suggestedFilename());

const conteudoPrev = await readFile(await descargaPrev.path(), "utf8");
conferir(JSON.parse(conteudoPrev).tipo === "preview-projeto",
  "e por dentro continua JSON, com a marca do Preview");

// Um .preview.json de antes, reaberto hoje.
const abriuPrev = await prev.evaluate(async (texto) => {
  document.getElementById("nomeProjeto").value = "";
  const dt = new DataTransfer();
  dt.items.add(new File([texto], "festa.preview.json", { type: "application/json" }));
  const input = document.getElementById("ficheiroProjeto");
  input.files = dt.files;
  input.dispatchEvent(new Event("change", { bubbles: true }));
  await new Promise((r) => setTimeout(r, 1500));
  return {
    nome: (document.getElementById("nomeProjeto") || {}).value || "",
    aviso: (document.getElementById("aviso") || {}).textContent || ""
  };
}, conteudoPrev);
console.log("   " + JSON.stringify(abriuPrev));
conferir(abriuPrev.nome === "Festa São João — Sala 1",
  "um .preview.json de antes abre na mesma");

// E um .cal aberto no Preview diz de onde ele é.
const trocadoPrev = await prev.evaluate(async () => {
  const dt = new DataTransfer();
  dt.items.add(new File([JSON.stringify({ _app: "calculadores-projeto" })], "festa.cal",
    { type: "application/json" }));
  const input = document.getElementById("ficheiroProjeto");
  input.files = dt.files;
  input.dispatchEvent(new Event("change", { bubbles: true }));
  await new Promise((r) => setTimeout(r, 900));
  return (document.getElementById("aviso") || {}).textContent || "";
});
console.log("   ao abrir um .cal aqui: " + trocadoPrev);
conferir(/Calculadores/.test(trocadoPrev) && /\.cal/.test(trocadoPrev),
  "e abrir um .cal no Preview diz para onde ele é");

conferir(erros.length === 0, erros.length ? "erro de JavaScript: " + erros[0] : "sem erros de JavaScript");

await browser.close();
s.close();
console.log("\n" + (falhas ? falhas + " FALHA(S)"
  : "Os ficheiros dizem de que app são, e os antigos continuam a abrir."));
process.exit(falhas ? 1 : 0);
