/**
 * LIMPAR TUDO LIMPA MESMO TUDO? — nas duas apps, e nos dois sentidos.
 *
 * Porque é que existe: um projeto acabado de fazer na aba Ecrã LED apareceu no
 * 3D com um DSM que ninguém lhe tinha posto — estava guardado numa chave só
 * dele, de outro dia, e ia colado a tudo desde então. O "Limpar tudo" que
 * existia apagava UMA chave e recarregava.
 *
 * O pedido veio a testar no telemóvel, a fazer de gestor na rua com um
 * cliente: *"forma simples de limpar tudo mas a fundo, tudo vazio sem nada por
 * omissão ao toque de um botão, que sirva para os dois sem ter de estar a
 * limpar num e noutro"*.
 *
 * Um teste que enumerasse as chaves a apagar tinha o mesmo defeito do botão
 * antigo: uma chave nova ficava de fora e ninguém dava por isso. Por isso este
 * enche o localStorage com chaves de TODOS os nossos prefixos — incluindo umas
 * inventadas, que fazem de "chave que alguém vai criar para o mês" — e exige
 * que sobrem SÓ as da lista de preferências.
 *
 *   node scripts/verificar-limpeza.mjs
 *
 * Precisa das duas apps servidas da MESMA ORIGEM, que é como elas vivem no
 * GitHub Pages (/calculadores e /preview). O servidor daqui serve as duas a
 * partir de /home/user.
 */

import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = join(fileURLToPath(new URL("..", import.meta.url)), "..");

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

// Tudo o que as duas apps guardam hoje, mais três que ainda não existem: são
// estas que provam a regra. Se a limpeza fosse por lista, passavam ao lado.
const SUJIDADE = {
  "calculadores-zonas-v1": '[{"nome":"z"}]',
  "calculadores-dsm-v1": '{"n":1,"w":0.71,"h":0.4}',
  "calculadores-dome-v1": '{"diam":8.7}',
  "calculadores-tv-v1": '{"n":2}',
  "calculadores-led-noprojeto-v1": '{"x":1}',
  "calculadores-historico-v1": '[{"nome":"antigo"}]',
  "mikeapps-projeto-v1": '{"zonas":[{"nome":"Ecrã LED"}]}',
  "mikeapps-projetor-v1": '{"projetores":[]}',
  "mikeapps-ecra-v1": '{"w":6}',
  "mikeapps-sala-v1": '{"largura":20}',
  "mikeapps-briefing-v1": '{"texto":"pedido do cliente"}',
  "mikeapps-preview-ajustes-v1": '{"delays":{}}',
  "preview-projeto": '{"nome":"x"}',
  // As que ainda não existem:
  "calculadores-coisa-nova-v9": '{"inventada":true}',
  "mikeapps-outra-coisa-v1": '"inventada"',
  "preview-terceira-coisa": '"inventada"'
};

// As preferências, com valores que se reconhecem à saída.
const PREFERENCIAS = {
  "calc-lang": '"en"',
  "calc-install-dismissed": '"1"',
  "calculadores-uso-v1": '{"id":"abc","ligado":false}',
  "calculadores-assistente-worker-url": '"https://exemplo"',
  "calculadores-canvas-mode": '"dwg"',
  "mikeapps-sincronizacao-v1": '"ligada"',
  "mikeapps-sincronizacao-aviso-v1": '"visto"',
  "preview-painel": '"aberto"',
  "preview-dobras": '{"sProjeto":true}',
  "preview-largura-painel": '"380"',
  "preview-edicao-livre": '"1"'
};

const { s, porta } = await servidor();
const { chromium } = await carregarPlaywright();
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM || "/opt/pw-browsers/chromium"
});

let falhas = 0;
const conferir = (ok, texto) => { console.log((ok ? "  ✓ " : "  ✗ ") + texto); if (!ok) falhas++; };

async function sujar(pagina) {
  await pagina.evaluate(({ sujidade, preferencias }) => {
    for (const [k, v] of Object.entries(sujidade)) localStorage.setItem(k, v);
    for (const [k, v] of Object.entries(preferencias)) localStorage.setItem(k, v);
  }, { sujidade: SUJIDADE, preferencias: PREFERENCIAS });
}

async function lerChaves(pagina) {
  return pagina.evaluate(() => {
    const fora = {};
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      fora[k] = localStorage.getItem(k);
    }
    return fora;
  });
}

/**
 * Responde "sim" à pergunta, seja ela qual for.
 *
 * As duas apps perguntam de maneiras diferentes: o Preview usa o confirm() do
 * browser, os Calculadores um <dialog> próprio (appConfirm) porque o nativo não
 * se pode desenhar. Um teste que só soubesse do nativo dava tudo verde à custa
 * de nunca chegar a carregar em nada -- foi o que aconteceu à primeira corrida.
 */
async function dizerQueSim(pagina) {
  await pagina.waitForTimeout(350);
  await pagina.evaluate(() => {
    const d = document.getElementById("app-confirm-dialog");
    if (d && d.open) d.querySelector(".app-confirm-yes").click();
  });
}

/**
 * O mesmo exame para as duas apps: sujar, carregar no botão, e ver o que sobra.
 */
async function examinar(nome, url, botao) {
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 950 }, serviceWorkers: "block" });
  const pagina = await ctx.newPage();
  const erros = [];
  pagina.on("pageerror", (e) => erros.push(e.message));
  pagina.on("dialog", (d) => d.accept());

  await pagina.goto(url, { waitUntil: "networkidle" });
  await pagina.waitForSelector(botao, { timeout: 20000, state: "attached" });
  await sujar(pagina);
  const antes = await lerChaves(pagina);

  console.log("\n== " + nome + " ==  " + Object.keys(antes).length + " chaves antes");
  await pagina.evaluate((sel) => document.querySelector(sel).click(), botao);
  await dizerQueSim(pagina);
  // O botão recarrega a página; espera-se por ela de pé outra vez.
  await pagina.waitForTimeout(1800);
  await pagina.waitForLoadState("networkidle");
  const depois = await lerChaves(pagina);

  const sobraram = Object.keys(depois);
  const deviamSobrar = Object.keys(PREFERENCIAS);
  // Uma limpeza também deixa a sua própria marca, e essa não conta.
  // Algumas chaves voltam a nascer no arranque -- a sala, por exemplo, que o
  // Preview escreve no fim de cada desenho. Isso é o certo: o que não pode é
  // voltar com o CONTEÚDO de antes. Por isso compara-se o valor, não a
  // presença.
  const renascidas = sobraram.filter((k) => !deviamSobrar.includes(k) && k !== "mikeapps-limpeza-v1" &&
    SUJIDADE[k] !== undefined && depois[k] !== SUJIDADE[k]);
  const extra = sobraram.filter((k) => k !== "mikeapps-limpeza-v1" && !deviamSobrar.includes(k) &&
    !renascidas.includes(k));
  if (renascidas.length) {
    console.log("   (renasceram por omissão, com conteúdo novo: " + renascidas.join(", ") + ")");
    renascidas.forEach((k) => console.log("       " + k + " = " + String(depois[k]).slice(0, 90)));
  }
  const emFalta = deviamSobrar.filter((k) => !sobraram.includes(k));

  console.log("   ficaram " + sobraram.length + ": " + sobraram.sort().join(", "));
  conferir(extra.length === 0, extra.length ? "SOBROU o que devia ser apagado: " + extra.join(", ")
                                            : "nada de projeto ficou para trás");
  conferir(emFalta.length === 0, emFalta.length ? "APAGOU preferências: " + emFalta.join(", ")
                                                : "as preferências ficaram todas");
  // A contagem de uso é a mais importante das preferências: apagá-la voltava a
  // ligar a contagem a quem a tinha desligado.
  conferir(depois["calculadores-uso-v1"] === PREFERENCIAS["calculadores-uso-v1"],
    "a contagem de uso ficou tal e qual (desligada continua desligada)");
  conferir(!!depois["mikeapps-limpeza-v1"], "deixou a marca para o outro separador dar por ela");
  conferir(erros.length === 0, erros.length ? "erro de JavaScript: " + erros[0] : "sem erros de JavaScript");
  await ctx.close();
}

const CALC = `http://127.0.0.1:${porta}/calculadores/index.html`;
const PREV = `http://127.0.0.1:${porta}/preview/index.html`;

await examinar("Calculadores → limpa as duas", CALC, "#proj-clear");
await examinar("Preview → limpa as duas", PREV, "#btLimpar");

// ---------------------------------------------------------- a pergunta antes

{
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 950 }, serviceWorkers: "block" });
  const pagina = await ctx.newPage();
  pagina.on("dialog", (d) => d.dismiss());
  await pagina.goto(PREV, { waitUntil: "networkidle" });
  await pagina.waitForSelector("#btLimpar", { timeout: 20000, state: "attached" });
  await sujar(pagina);
  await pagina.evaluate(() => document.querySelector("#btLimpar").click());
  await pagina.waitForTimeout(800);
  const depois = await lerChaves(pagina);
  console.log("\n== dizer que não à pergunta ==");
  conferir(!!depois["calculadores-dsm-v1"] && !!depois["mikeapps-projeto-v1"],
    "dizer que não não apaga nada");
  await ctx.close();
}

// ------------------------------------------- o outro separador dá por ela

{
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 950 }, serviceWorkers: "block" });
  const calc = await ctx.newPage();
  const prev = await ctx.newPage();
  calc.on("dialog", (d) => d.accept());
  prev.on("dialog", (d) => d.accept());
  await calc.goto(CALC, { waitUntil: "networkidle" });
  await prev.goto(PREV, { waitUntil: "networkidle" });
  await calc.waitForSelector("#proj-clear", { timeout: 20000, state: "attached" });
  await prev.waitForSelector("#btLimpar", { timeout: 20000, state: "attached" });
  await sujar(calc);

  console.log("\n== os dois separadores abertos ==");
  // Marca-se o separador do Preview para se saber se ele recarregou mesmo.
  await prev.evaluate(() => { window.__aindaOMesmo = true; });
  await calc.evaluate(() => document.querySelector("#proj-clear").click());
  await dizerQueSim(calc);
  await calc.waitForTimeout(2500);
  const recarregou = await prev.evaluate(() => typeof window.__aindaOMesmo === "undefined");
  const noPreview = await lerChaves(prev);
  conferir(recarregou, "o Preview, aberto ao lado, recarregou sozinho");
  conferir(noPreview["calculadores-dsm-v1"] === undefined && noPreview["mikeapps-projeto-v1"] === undefined,
    "e já não tem nada do projeto antigo");
  await ctx.close();
}

await browser.close();
s.close();
console.log("\n" + (falhas ? falhas + " FALHA(S)" : "Limpa as duas, a fundo, e guarda o que era para guardar."));
process.exit(falhas ? 1 : 0);
