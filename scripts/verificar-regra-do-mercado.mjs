/**
 * A REGRA DA PROCURA NO MERCADO.
 *
 * Pedido: *"monta uma regra para quando devolve não encontrado disparar uma
 * procura no mercado"*.
 *
 * O link já existia; o que é novo é ele sair SOZINHO. E o perigo todo está
 * em disparar a meio de uma palavra: quem escreve "Samsung" passa por "S",
 * "Sa", "Sam" — e todos eles não encontram nada. Uma app que abre um
 * separador a cada letra é inutilizável, por isso a regra é feita de
 * condições, e é isso que este teste guarda:
 *
 *   1. não dispara com menos de 3 caracteres;
 *   2. não dispara sem uma letra — "55" é uma medida, não um modelo;
 *   3. não dispara a meio de escrever: só depois de 1,2 s de silêncio;
 *   4. dispara UMA vez por texto, e não repete no mesmo;
 *   5. não dispara com o campo já fora de foco;
 *   6. não dispara quando a lista TEM o modelo — o caso normal;
 *   7. desligada, não dispara nada, e o Enter continua a abrir à mão;
 *   8. e quando o browser recusa abrir (bloqueador de popups), o recado
 *      di-lo em vez de ficar calado a fingir que abriu.
 *
 * Como se mede: window.open é substituído por um contador. É a única forma
 * de contar aberturas sem abrir separadores a sério — e é a função que a app
 * chama mesmo, não uma cópia da regra escrita aqui fora.
 *
 *   node scripts/verificar-regra-do-mercado.mjs
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
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: "block" });

let falhas = 0;
const conferir = (ok, texto) => { console.log((ok ? "  ✓ " : "  ✗ ") + texto); if (!ok) falhas++; };

const pagina = await ctx.newPage();
const erros = [];
pagina.on("pageerror", (e) => erros.push(e.message));
await pagina.goto(`http://127.0.0.1:${porta}/index.html`, { waitUntil: "networkidle" });
await pagina.waitForTimeout(2500);

// A app abre no menu de partida ("Por onde queres começar?"). Entra-se pela
// mesma porta que ele usa.
await pagina.click("#btMenuCompleta");
await pagina.waitForTimeout(800);

// A aba TVs, que é onde o campo da fotografia vive. Sem ela aberta, o campo
// existe mas está escondido — e um teste que escreve num campo escondido não
// mede o que a pessoa faz.
await pagina.click('button.tab[data-mode="tv"]');
await pagina.waitForTimeout(600);

// O contador no lugar do window.open. Devolve um objeto (como um separador a
// sério) para a app o ler como "abriu"; o modo `recusar` devolve null, que é
// o que um bloqueador de popups faz.
await pagina.evaluate(() => {
  window.__aberturas = [];
  window.__recusar = false;
  window.open = function (url) {
    window.__aberturas.push(url);
    return window.__recusar ? null : { opener: null, closed: false };
  };
});

const limpar = () => pagina.evaluate(() => { window.__aberturas = []; });
const aberturas = () => pagina.evaluate(() => window.__aberturas.slice());

// Escrever à mão, tecla a tecla, para o relógio do silêncio correr como corre
// com uma pessoa a escrever.
const escrever = async (texto) => {
  const campo = pagina.locator("#tv-model").locator("xpath=preceding-sibling::div[contains(@class,'model-search-wrap')]//input");
  await campo.click();
  await campo.fill("");
  await pagina.keyboard.type(texto, { delay: 40 });
};

const recado = () => pagina.evaluate(() => {
  const r = document.getElementById("tv-model").parentNode.querySelector(".model-search-noresult");
  return (r && r.style.display !== "none") ? r.textContent : null;
});

const ESPERA = 1200;   // a mesma da regra, em js/utils.js

console.log("\n== não dispara com pouco escrito, nem sem letras ==");
// "55" não serve para medir isto: a lista TEM 21 modelos com 55, por isso
// nem sequer há recado — não se estaria a medir a regra, estaria a medir-se
// o vazio. Tem de ser algo que a lista não conhece: "xi" (curto de mais) e
// "1234" (sem uma única letra).
for (const [curto, porque] of [["xi", "curto de mais"], ["1234", "sem letras"]]) {
  await limpar();
  await escrever(curto);
  await pagina.waitForTimeout(ESPERA + 700);
  const a = await aberturas();
  const r = await recado();
  conferir(!!r, `«${curto}» não está na lista (há recado — a regra foi mesmo posta à prova)`);
  conferir(a.length === 0, `e não foi ao mercado: ${porque} (${a.length} aberturas)`);
}

console.log("\n== não dispara a meio de escrever ==");
await limpar();
await escrever("xiaomi");
// Meio segundo depois da última tecla ainda ninguém acabou de escrever.
await pagina.waitForTimeout(500);
const aMeio = await aberturas();
conferir(aMeio.length === 0, `meio segundo depois da última tecla: ${aMeio.length} aberturas`);

console.log("\n== e dispara sozinha quando o silêncio chega ==");
await pagina.waitForTimeout(ESPERA);
const depois = await aberturas();
conferir(depois.length === 1, `uma abertura (${depois.length})`);
conferir(!!depois[0] && /google\.com\/search/.test(depois[0]), "foi ao mercado: " + (depois[0] || "—"));
conferir(!!depois[0] && /xiaomi/i.test(decodeURIComponent(depois[0])),
  "com o que estava escrito");
conferir(!!depois[0] && /televisor/i.test(decodeURIComponent(depois[0])),
  "e com o que a lista é («televisor»), para vir a ficha e não a loja");

console.log("\n== e avisa, antes e depois ==");
// Pedido: *"adiciona um aviso de que está a procurar"*. Mede-se nos dois
// momentos: enquanto o relógio conta, e depois de abrir.
await limpar();
await escrever("hisense");
await pagina.waitForTimeout(400);           // a meio da espera
const aviso1 = await recado();
const aberturasAoAvisar = await aberturas();
conferir(!!aviso1 && /a procurar/i.test(aviso1),
  "durante a espera diz que está a procurar: “" + (aviso1 || "").split("\n")[0].trim() + "”");
conferir(aberturasAoAvisar.length === 0, "e ainda não abriu nada — o aviso vem ANTES");
await pagina.waitForTimeout(ESPERA);
const aviso2 = await recado();
conferir(!!aviso2 && /separador novo/i.test(aviso2),
  "depois de abrir diz onde foi parar: “" + (aviso2 || "").trim().slice(-60) + "”");

// E o aviso sai quando a procura deixa de estar de pé: escrever mais uma
// letra desarma, e um "vou procurar" pendurado sem nunca procurar é pior do
// que aviso nenhum.
await pagina.keyboard.type("x");
await pagina.waitForTimeout(150);
const aviso3 = await recado();
conferir(!!aviso3 && !/separador novo/i.test(aviso3),
  "escrever apaga o aviso da procura anterior");
await limpar();

console.log("\n== não repete no mesmo texto ==");
await limpar();
await escrever("sony");
await pagina.waitForTimeout(ESPERA + 700);
const uma = await aberturas();
conferir(uma.length === 1, `disparou uma vez (${uma.length})`);
await pagina.waitForTimeout(ESPERA + 700);
const repetiu = await aberturas();
conferir(repetiu.length === 1, `e continua em ${repetiu.length} abertura`);

console.log("\n== não dispara com o campo fora de foco ==");
await limpar();
await escrever("grundig");
// PRIMEIRO provar que havia o que disparar: sem isto, "0 aberturas" tanto
// pode ser a regra a portar-se bem como uma marca que afinal está na lista.
const antesDoBlur = await recado();
conferir(!!antesDoBlur, "há recado de mercado (a regra tinha o que disparar)");
await pagina.evaluate(() => document.activeElement.blur());
await pagina.waitForTimeout(ESPERA + 700);
const semFoco = await aberturas();
conferir(semFoco.length === 0, `${semFoco.length} aberturas com o campo largado`);

console.log("\n== o caso normal: a lista TEM o modelo ==");
await limpar();
await escrever("samsung 55");
await pagina.waitForTimeout(ESPERA + 700);
const comLista = await aberturas();
const r1 = await recado();
conferir(comLista.length === 0, `${comLista.length} aberturas — há modelos na lista`);
conferir(r1 === null, "e nem sequer há recado de mercado");

console.log("\n== quando o browser recusa, diz-se ==");
await limpar();
await pagina.evaluate(() => { window.__recusar = true; });
await escrever("hisense");
await pagina.waitForTimeout(ESPERA + 900);
const recusado = await aberturas();
const r2 = await recado();
conferir(recusado.length === 1, "tentou abrir uma vez");
conferir(!!r2 && /não deixou abrir/i.test(r2),
  "e o recado diz que o browser não deixou: “" + (r2 || "").trim() + "”");
await pagina.evaluate(() => { window.__recusar = false; });

console.log("\n== desligada, não dispara — e o Enter continua a abrir ==");
await limpar();
await escrever("sharp");
await pagina.waitForTimeout(400);
const antesDeDesligar = await recado();
conferir(!!antesDeDesligar, "há recado de mercado antes de desligar a regra");
await pagina.evaluate(() => {
  document.querySelector("#tv-model").parentNode
    .querySelector(".mercado-auto-caixa").click();      // desliga
});
await pagina.waitForTimeout(ESPERA + 900);
const desligada = await aberturas();
conferir(desligada.length === 0, `${desligada.length} aberturas com a regra desligada`);

await pagina.locator("#tv-model").locator("xpath=preceding-sibling::div[contains(@class,'model-search-wrap')]//input").click();
await pagina.keyboard.press("Enter");
await pagina.waitForTimeout(300);
const porEnter = await aberturas();
conferir(porEnter.length === 1, "o Enter abriu à mesma (" + porEnter.length + ")");

// A escolha fica guardada: reabrir a app não devolve a regra ligada a quem a
// desligou. É o mesmo princípio do interruptor da sincronização.
const guardado = await pagina.evaluate(() => localStorage.getItem("mikeapps-mercado-auto-v1"));
conferir(guardado === "0", "e a escolha ficou guardada (" + guardado + ")");

console.log("\n== sem erros na consola ==");
conferir(erros.length === 0, erros.length ? erros.join(" | ") : "nenhum");

await browser.close();
s.close();
console.log(falhas ? `\n${falhas} falha(s).` : "\nTudo certo.");
process.exit(falhas ? 1 : 0);
