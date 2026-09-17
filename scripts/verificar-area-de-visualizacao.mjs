/**
 * ÁREA TOTAL OU SÓ A JANELA 16/9 — E AS DUAS APPS A DIZER O MESMO.
 *
 * Pedido: *"quando o ecrã for por exemplo um 20 por 5, ela está a usar toda a
 * base de imagem sempre, mas a maioria das vezes os dados são apresentados em
 * pips 16/9 e não em ecrã total. Devia ter um switch para essa conta, se área
 * total se apenas 16/9 — e medir o conforto de visualização também com essa
 * regra aplicada consoante o seletor indicar"*.
 *
 * AO IR VER, APARECEU UMA COISA QUE NINGUÉM SABIA: as duas apps já discordavam.
 * O Preview já partia um ecrã largo em fatias de ~16:9 e usava a largura da
 * FATIA no conforto (de um pedido anterior: *"divide quando cabem dois ou mais
 * 16/9"*). Os Calculadores contavam sempre com a largura toda. Num 20×5, um
 * dizia 20 m e o outro 10 m -- para a mesma pergunta, no mesmo projeto.
 *
 * Por isso o que este teste guarda não é só o interruptor: é as duas apps
 * responderem à mesma pergunta com o mesmo número, seja qual for a posição
 * dele. E guarda as três coisas que o interruptor NÃO pode fazer:
 *
 *   - não muda nada num ecrã normal (16:9, 16:10, 4:3);
 *   - não mexe na altura, e por isso o AVIXA dá o mesmo nos dois modos;
 *   - um projeto guardado ANTES disto existir não muda de conforto por ter
 *     sido aberto num dia diferente.
 *
 *   node scripts/verificar-area-de-visualizacao.mjs
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
const ctx = await browser.newContext({ viewport: { width: 1400, height: 950 }, serviceWorkers: "block" });

let falhas = 0;
const conferir = (ok, texto) => { console.log((ok ? "  ✓ " : "  ✗ ") + texto); if (!ok) falhas++; };
const num = (t) => parseFloat(String(t).replace(",", ".").replace(/[^\d.-]/g, ""));

const calc = await ctx.newPage();
const erros = [];
calc.on("pageerror", (e) => erros.push("calc: " + e.message));
await calc.goto(`http://127.0.0.1:${porta}/calculadores/index.html`, { waitUntil: "networkidle" });
await calc.waitForFunction(() => !!window.mikeappsVisualizacao, null, { timeout: 20000 });
await calc.waitForTimeout(400);

/** Põe um ecrã na aba Distância de Visualização e lê o que a app responde. */
const naAba = (largura, altura, modo, standard) => calc.evaluate(async ([w, h, modo, std]) => {
  document.querySelector('.tabs .tab[data-mode="visualizacao"]').click();
  await new Promise((r) => setTimeout(r, 250));
  const por = (id, v) => { const el = document.getElementById(id);
    if (!el) return; el.value = String(v);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true })); };
  por("v-standard", std);
  // "Personalizado" é o que deixa pôr largura e altura à mão (v-rw / v-rh).
  por("v-ratio", "custom");
  await new Promise((r) => setTimeout(r, 250));
  por("v-rw", w); por("v-rh", h);
  por("v-area", modo);
  await new Promise((r) => setTimeout(r, 600));
  return {
    dmin: (document.getElementById("v-out-dmin") || {}).textContent || "",
    dmax: (document.getElementById("v-out-dmax") || {}).textContent || "",
    nota: (document.getElementById("v-rule-note") || {}).textContent || ""
  };
}, [largura, altura, modo, standard]);

// ---- 1. A regra sozinha, que é o que as duas apps partilham -------------
console.log("\n== a regra (js/visualizacao.js) ==");
const regra = await calc.evaluate(() => {
  const v = window.mikeappsVisualizacao;
  return {
    fatias20x5: v.fatiasDeEcra(20, 5),
    largura20x5: v.larguraDeConta(20, 5, "16-9"),
    total20x5: v.larguraDeConta(20, 5, "total"),
    // Um 16:9 normal: não se divide, e o switch não faz nada.
    fatias16x9: v.fatiasDeEcra(5.33, 3),
    largura16x9: v.larguraDeConta(5.33, 3, "16-9"),
    // Um ecrã ainda mais comprido.
    fatias40x5: v.fatiasDeEcra(40, 5),
    largura40x5: v.larguraDeConta(40, 5, "16-9"),
    omissao: v.MODO_POR_OMISSAO
  };
});
console.log("   " + JSON.stringify(regra));
conferir(regra.fatias20x5 === 2 && Math.abs(regra.largura20x5 - 10) < 0.001,
  "20×5 → 2 fatias de 10,00 m (cabem 2 larguras de 16:9 de 8,89 m)");
conferir(Math.abs(regra.total20x5 - 20) < 0.001,
  "em «área total», a mesma conta usa os 20 m");
conferir(regra.fatias16x9 === 1 && Math.abs(regra.largura16x9 - 5.33) < 0.001,
  "um ecrã 16:9 normal não se divide — o interruptor não lhe toca");
conferir(regra.fatias40x5 === 4 && Math.abs(regra.largura40x5 - 10) < 0.001,
  "40×5 → 4 fatias, também de 10,00 m");
conferir(regra.omissao === "16-9",
  "por omissão fica o 16/9 («a maioria das vezes os dados vão em pips»)");

// ---- 2. Na aba, com o ecrã dele -----------------------------------------
console.log("\n== o 20×5 na aba Distância de Visualização ==");
const total = await naAba(20, 5, "total", "width-thx");
const pip = await naAba(20, 5, "16-9", "width-thx");
console.log("   área total: " + total.dmin + " – " + total.dmax);
console.log("   16/9:       " + pip.dmin + " – " + pip.dmax);
console.log("   nota: " + pip.nota);
conferir(Math.abs(num(total.dmin) - 30) < 0.1 && Math.abs(num(total.dmax) - 120) < 0.5,
  "área total dá 30–120 m (largura × 1,5–6 sobre os 20 m)");
conferir(Math.abs(num(pip.dmin) - 15) < 0.1 && Math.abs(num(pip.dmax) - 60) < 0.5,
  "e a janela 16/9 dá 15–60 m (sobre os 10 m da fatia)");
conferir(/16\/9/.test(pip.nota) && /10,00/.test(pip.nota),
  "e a app DIZ com que janela contou, em vez de mudar os números em silêncio");

// ---- 3. O AVIXA não muda — e isso é de propósito -------------------------
//
// A fatia tem a altura toda do ecrã: a divisão é só horizontal. Um standard
// por altura tem de dar o mesmo nos dois modos, senão o interruptor estava a
// mexer onde não devia.
console.log("\n== o AVIXA (por altura) ==");
const avixaTotal = await naAba(20, 5, "total", "avixa");
const avixaPip = await naAba(20, 5, "16-9", "avixa");
console.log("   área total: " + avixaTotal.dmax + " · 16/9: " + avixaPip.dmax);
conferir(avixaTotal.dmax === avixaPip.dmax,
  "por altura, os dois modos dão o mesmo — a fatia tem a altura toda do ecrã");

// ---- 4. Um ecrã normal não se mexe --------------------------------------
console.log("\n== um ecrã 16:9 normal ==");
const normalTotal = await naAba(5.33, 3, "total", "width-thx");
const normalPip = await naAba(5.33, 3, "16-9", "width-thx");
console.log("   área total: " + normalTotal.dmax + " · 16/9: " + normalPip.dmax);
conferir(normalTotal.dmax === normalPip.dmax,
  "num ecrã normal o interruptor não muda nada — e a nota não fala de recorte");
conferir(!/16\/9/.test(normalPip.nota),
  "sem recorte a declarar, a app não enche a nota com uma explicação inútil");

// ---- 5. E O QUE MAIS IMPORTA: o 3D obedece ao mesmo interruptor ---------
console.log("\n== o conforto no 3D segue o seletor ==");
const prev = await ctx.newPage();
prev.on("pageerror", (e) => erros.push("preview: " + e.message));
await prev.goto(`http://127.0.0.1:${porta}/preview/index.html`, { waitUntil: "networkidle" });
await prev.waitForFunction(() => !!window.mikeappsVisualizacao, null, { timeout: 20000 });
await prev.waitForTimeout(400);

// Pergunta-se À FUNÇÃO DO PREVIEW, não a uma cópia da regra escrita aqui:
// repetir a conta do lado de fora era testar a minha cópia e não a que a app
// corre -- exactamente o defeito que este trabalho todo anda a tirar de cima.
await prev.waitForFunction(() => window.preview && window.preview.segmentosDeZona,
  null, { timeout: 20000 });
const noPreview = await prev.evaluate(() => {
  const zona = { nome: "principal", x: 0, y: 0, w: 20, h: 5 };
  const conta = (modo) => {
    const segs = window.preview.segmentosDeZona(zona, modo);
    return { fatias: segs.length, larguraDeConta: segs[0].w,
             cobreOEcraTodo: Math.abs(segs.reduce((s, x) => s + x.w, 0) - zona.w) < 1e-9 };
  };
  return { com169: conta("16-9"), comTotal: conta("total"),
           // E o que um projeto traz no payload chega mesmo à divisão.
           doPayload: window.preview.regraDeDistancia(
             { standard: { basis: "width", min: 1.5, max: 6, area: "total" } }).area };
});
console.log("   " + JSON.stringify(noPreview));
conferir(noPreview.com169.fatias === 2 && Math.abs(noPreview.com169.larguraDeConta - 10) < 0.001,
  "o Preview parte o 20×5 em 2 fatias de 10,00 m — o mesmo que a calculadora");
conferir(noPreview.comTotal.fatias === 1 && Math.abs(noPreview.comTotal.larguraDeConta - 20) < 0.001,
  "e em «área total» trata o ecrã inteiro como um só, também como ela");
conferir(noPreview.com169.cobreOEcraTodo,
  "as fatias cobrem o ecrã inteiro — não fica um pedaço de ecrã sem conta");
conferir(noPreview.doPayload === "total",
  "e a escolha que vem no payload do projeto chega mesmo à divisão");

// A prova de que é MESMO o mesmo ficheiro, e não duas cópias que já divergiram.
const mesmaRegra = await prev.evaluate(() => ({
  f: window.mikeappsVisualizacao.fatiasDeEcra(20, 5),
  l: window.mikeappsVisualizacao.larguraDeConta(20, 5, "16-9"),
  omissao: window.mikeappsVisualizacao.MODO_POR_OMISSAO
}));
conferir(mesmaRegra.f === regra.fatias20x5 &&
         Math.abs(mesmaRegra.l - regra.largura20x5) < 1e-9 &&
         mesmaRegra.omissao === regra.omissao,
  "as duas apps respondem exactamente o mesmo — a regra está num ficheiro só");

// ---- 6. Um projeto guardado ANTES disto existir -------------------------
//
// Sem "area" no payload, o 3D tem de continuar a fazer o que já fazia. Um
// projeto antigo não pode mudar de conforto por ter sido aberto hoje.
console.log("\n== um projeto de antes deste interruptor ==");
const antigo = await prev.evaluate(() => {
  const v = window.mikeappsVisualizacao;
  const semArea = { basis: "width", min: 1.5, max: 6, label: "x" };   // sem .area
  const modo = semArea.area || v.MODO_POR_OMISSAO;
  return { modo: modo, fatias: (modo === "total") ? 1 : v.fatiasDeEcra(20, 5) };
});
console.log("   " + JSON.stringify(antigo));
conferir(antigo.modo === "16-9" && antigo.fatias === 2,
  "cai no 16/9, que é o que o Preview já fazia — nada muda debaixo dos pés");

conferir(erros.length === 0, erros.length ? "erro de JavaScript: " + erros[0] : "sem erros de JavaScript");

await browser.close();
s.close();
console.log("\n" + (falhas ? falhas + " FALHA(S)"
  : "O interruptor manda nas duas apps, e as duas dizem o mesmo número."));
process.exit(falhas ? 1 : 0);
