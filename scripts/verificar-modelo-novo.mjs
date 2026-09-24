/**
 * ACRESCENTAR À LISTA O QUE ELA NÃO TEM.
 *
 * Pedido, a corrigir a versão anterior: *"a pesquisa auto não será para
 * popups mas sim para adicionar a lista se não existir"*. E tem razão — um
 * separador do Google que abre sozinho resolve a curiosidade e não resolve o
 * trabalho: no fim daquilo a lista continua sem a TV.
 *
 * A regra da casa manda no resto: *"nunca inventar dados técnicos — só
 * valores reais, com fonte"*. Por isso a app não vai buscar a ficha a lado
 * nenhum. Abre um formulário, e os números são de quem os escreve.
 *
 * O que este teste guarda:
 *
 *   1. NADA abre sozinho — nem um separador, em três segundos parado;
 *   2. a caixa oferece acrescentar o que está escrito, com esse nome;
 *   3. o formulário nasce com o nome escrito e com a diagonal e o formato
 *      que já estavam na aba — não se escreve o mesmo número duas vezes;
 *   4. recusa o que não faz medida nenhuma: sem nome, sem diagonal, ou com
 *      meia resolução (um lado escrito e o outro não);
 *   5. guardado, o modelo entra na lista, fica escolhido, e aplica-se — a
 *      diagonal, o formato e a resolução aparecem na conta;
 *   6. e fica marcado como MEU, nem stock nem mercado, com a fonte à vista;
 *   7. sobrevive a fechar e abrir a app;
 *   8. viaja dentro do projeto: um .cal aberto noutro browser traz o modelo
 *      com ele, em vez de cair em "Personalizado…" calado;
 *   9. e a procura no mercado continua lá — a pedido, pelo Enter.
 *
 *   node scripts/verificar-modelo-novo.mjs
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

// Uma TV que a AVK não tem, conferido contra o catálogo — senão isto media o
// vazio, que já aconteceu neste ficheiro.
const tvs = JSON.parse(await readFile(join(RAIZ, "data/tvs.json"), "utf8"));
const MARCA = "Xiaomi";
const MODELO = "Xiaomi TV A Pro 55";
if (tvs.some((t) => t.modelo.toLowerCase().includes(MARCA.toLowerCase()))) {
  console.log("O catálogo passou a ter " + MARCA + " — escolher outra marca para este teste.");
  process.exit(2);
}

const { s, porta } = await servidor();
const { chromium } = await carregarPlaywright();
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM || "/opt/pw-browsers/chromium"
});
const ctx = await browser.newContext({ viewport: { width: 1280, height: 950 }, serviceWorkers: "block", acceptDownloads: true });

let falhas = 0;
const conferir = (ok, texto) => { console.log((ok ? "  ✓ " : "  ✗ ") + texto); if (!ok) falhas++; };

const pagina = await ctx.newPage();
const erros = [];
pagina.on("pageerror", (e) => erros.push(e.message));
await pagina.goto(`http://127.0.0.1:${porta}/index.html`, { waitUntil: "networkidle" });
await pagina.waitForTimeout(2500);
await pagina.click("#btMenuCompleta");
await pagina.waitForTimeout(700);
await pagina.click('button.tab[data-mode="tv"]');
await pagina.waitForTimeout(500);

// Contador no lugar do window.open: é a única forma de contar separadores
// sem os abrir a sério.
await pagina.evaluate(() => {
  window.__aberturas = [];
  window.open = function (url) { window.__aberturas.push(url); return { opener: null }; };
});
const aberturas = () => pagina.evaluate(() => window.__aberturas.slice());

const campo = pagina.locator("#tv-model")
  .locator("xpath=preceding-sibling::div[contains(@class,'model-search-wrap')]//input");

// A diagonal já escrita na aba, como quem estava a fazer a conta antes de ir
// procurar o modelo — é o que o formulário deve aproveitar.
await pagina.fill("#tv-diag", "55");
await pagina.waitForTimeout(200);

console.log("\n== nada abre sozinho ==");
await campo.click();
await pagina.keyboard.type(MODELO, { delay: 30 });
await pagina.waitForTimeout(3000);
const sozinho = await aberturas();
conferir(sozinho.length === 0, `${sozinho.length} separadores em 3 s parado`);

const caixaTexto = () => pagina.evaluate(() => {
  const r = document.getElementById("tv-model").parentNode.querySelector(".model-search-noresult");
  return (r && r.style.display !== "none") ? r.textContent : null;
});
const recado = await caixaTexto();
conferir(!!recado && /Acrescentar/i.test(recado) && recado.includes(MODELO),
  "a caixa oferece acrescentar o que está escrito");

console.log("\n== o formulário nasce preenchido com o que já se sabia ==");
await pagina.click(".model-search-noresult .model-add");
await pagina.waitForTimeout(400);
const inicio = await pagina.evaluate(() => ({
  aberto: !!document.querySelector("#mm-dialog[open]"),
  modelo: document.getElementById("mm-modelo").value,
  diag: document.getElementById("mm-diag").value,
  ratio: document.getElementById("mm-ratio").value
}));
conferir(inicio.aberto, "o formulário abriu");
conferir(inicio.modelo === MODELO, "com o nome escrito: " + inicio.modelo);
conferir(inicio.diag === "55", "e com a diagonal que estava na aba: " + inicio.diag);
conferir(inicio.ratio === "16:9", "e o formato: " + inicio.ratio);

console.log("\n== recusa o que não faz medida nenhuma ==");
const erroCom = (accao) => pagina.evaluate(async (a) => {
  const d = document.getElementById("mm-dialog");
  const g = (id) => document.getElementById(id);
  if (a === "sem-nome") { g("mm-modelo").value = ""; }
  if (a === "sem-diag") { g("mm-modelo").value = "X"; g("mm-diag").value = ""; }
  if (a === "meia-res") { g("mm-modelo").value = "X"; g("mm-diag").value = "55"; g("mm-rx").value = "3840"; g("mm-ry").value = ""; }
  d.querySelector("#mm-guardar").click();
  await new Promise((r) => setTimeout(r, 150));
  const e = d.querySelector(".mm-erro");
  return { aberto: !!document.querySelector("#mm-dialog[open]"), erro: e.hidden ? null : e.textContent };
}, accao);

for (const [accao, esperado] of [["sem-nome", /nome/i], ["sem-diag", /diagonal/i], ["meia-res", /dois lados/i]]) {
  const r = await erroCom(accao);
  conferir(r.aberto && !!r.erro && esperado.test(r.erro), `${accao}: “${(r.erro || "—").trim()}”`);
}

console.log("\n== guardado, entra na lista e aplica-se ==");
await pagina.evaluate((nome) => {
  const g = (id) => document.getElementById(id);
  g("mm-modelo").value = nome;
  g("mm-diag").value = "55";
  g("mm-ratio").value = "16:9";
  g("mm-rx").value = "3840";
  g("mm-ry").value = "2160";
  g("mm-fonte").value = "https://www.mi.com/global/product/xiaomi-tv-a-pro/";
  document.getElementById("mm-guardar").click();
}, MODELO);
await pagina.waitForTimeout(800);

const depois = await pagina.evaluate((nome) => {
  const sel = document.getElementById("tv-model");
  const escolhida = sel.options[sel.selectedIndex];
  const naLista = [...sel.options].filter((o) => o.textContent.includes(nome));
  const outras = ["proj-dsm-tvmodel", "proj-delay-tvmodel", "v-tvmodel"].map((id) =>
    [...document.getElementById(id).options].some((o) => o.textContent.includes(nome)));
  return {
    fechado: !document.querySelector("#mm-dialog[open]"),
    naLista: naLista.length,
    etiqueta: naLista[0] ? naLista[0].textContent : null,
    escolhida: escolhida ? escolhida.textContent : null,
    stock: escolhida ? escolhida.dataset.stock : null,
    nasOutras: outras,
    diag: document.getElementById("tv-diag").value,
    ratio: document.getElementById("tv-ratio").value,
    res: document.getElementById("tv-out-res").textContent,
    largura: document.getElementById("tv-out-w").textContent,
    // O endereço, e não o texto: a app escreve sempre "Referenciado ↗" no
    // link, por isso ler o texto não provava que a fonte certa lá estava.
    fonte: (function () {
      var a = document.getElementById("tv-model-source").querySelector("a");
      return a ? a.getAttribute("href") : null;
    })()
  };
}, MODELO);

conferir(depois.fechado, "o formulário fechou");
conferir(depois.naLista === 1, `o modelo está na lista uma vez (${depois.naLista})`);
conferir(!!depois.escolhida && depois.escolhida.includes(MODELO), "e ficou escolhido: " + depois.escolhida);
conferir(depois.nasOutras.every(Boolean), "está também nas outras três listas de TVs");
conferir(/· meu/.test(depois.etiqueta || ""), "marcado como meu: " + depois.etiqueta);
conferir(!/\(mercado\)/.test(depois.etiqueta || ""), "e não como «(mercado)», que seria mentira");
conferir(depois.stock === "0", "nem como stock da casa");
conferir(depois.diag === "55" && depois.ratio === "16:9", `aplicou-se: ${depois.diag}" ${depois.ratio}`);
conferir(/3840/.test(depois.res) && /2160/.test(depois.res), "com a resolução escrita: " + depois.res);
conferir(/1,22/.test(depois.largura), "e a conta saiu: largura " + depois.largura);
conferir(/^https:\/\/www\.mi\.com\//.test(depois.fonte || ""),
  "a fonte escrita é a que aparece ao lado: " + (depois.fonte || "—"));

console.log("\n== e tem como sair daqui para o catálogo de toda a gente ==");
const linhaCat = await pagina.evaluate(() => {
  const caixa = document.getElementById("tv-model-meu");
  const visivel = !caixa.hidden;
  const sel = document.getElementById("tv-model");
  const m = window.meusModelos.ler("tv")[0];
  return {
    visivel,
    nota: caixa.textContent,
    linha: window.meusModelos.linhaDeCatalogo(m)
  };
});
conferir(linhaCat.visivel && /Acrescentado por ti/.test(linhaCat.nota),
  "a linha diz de quem é: “" + linhaCat.nota.replace(/\s+/g, " ").trim() + "”");
// A linha tem de ser JSON válido e com a forma do data/tvs.json -- se não
// for, "copiar para o catálogo" dá trabalho a quem a recebe em vez de o
// poupar.
let comoNoCatalogo = null;
try { comoNoCatalogo = JSON.parse(linhaCat.linha); } catch (_) {}
const chavesCatalogo = Object.keys(tvs[0]).filter((k) => k in (comoNoCatalogo || {}));
conferir(!!comoNoCatalogo && comoNoCatalogo.modelo === MODELO && comoNoCatalogo.diag === 55 &&
  comoNoCatalogo.resolucao && comoNoCatalogo.resolucao.rx === 3840 &&
  chavesCatalogo.length >= 5,
  "e a linha copiada entra no data/tvs.json tal como está: " + linhaCat.linha);
conferir(!("meu" in (comoNoCatalogo || {})), "sem o «meu», que é marca desta app e não do catálogo");

console.log("\n== sobrevive a fechar e abrir a app ==");
await pagina.reload({ waitUntil: "networkidle" });
await pagina.waitForTimeout(2500);
await pagina.click("#btMenuCompleta");
await pagina.waitForTimeout(600);
await pagina.click('button.tab[data-mode="tv"]');
await pagina.waitForTimeout(400);
const depoisDeAbrir = await pagina.evaluate((nome) =>
  [...document.getElementById("tv-model").options].some((o) => o.textContent.includes(nome)), MODELO);
conferir(depoisDeAbrir, "continua na lista depois de recarregar");

console.log("\n== viaja dentro do projeto ==");
// O ficheiro que o "Guardar projeto" escreve tem de o levar...
const [download] = await Promise.all([
  pagina.waitForEvent("download"),
  pagina.evaluate(() => {
    document.querySelector('button.tab[data-mode="projeto"]').click();
    setTimeout(() => document.getElementById("proj-save").click(), 300);
  })
]);
const caminho = await download.path();
const projeto = JSON.parse(await readFile(caminho, "utf8"));
const levou = projeto.modelosMeus && Array.isArray(projeto.modelosMeus.tv) &&
  projeto.modelosMeus.tv.some((m) => m.modelo === MODELO);
conferir(!!levou, "o .cal guardado leva o modelo acrescentado");

// ...e um browser que nunca o viu tem de o receber ao abrir esse ficheiro.
const limpa = await ctx.newPage();
await limpa.goto(`http://127.0.0.1:${porta}/index.html`, { waitUntil: "networkidle" });
await limpa.waitForTimeout(2500);
await limpa.evaluate(() => localStorage.removeItem("mikeapps-meus-modelos-v1"));
await limpa.reload({ waitUntil: "networkidle" });
await limpa.waitForTimeout(2500);
await limpa.click("#btMenuCompleta");
await limpa.waitForTimeout(600);
const semEle = await limpa.evaluate((nome) =>
  [...document.getElementById("tv-model").options].some((o) => o.textContent.includes(nome)), MODELO);
conferir(!semEle, "um browser limpo não o conhece (a prova de que o ficheiro é que o traz)");

await limpa.evaluate((texto) => {
  const dt = new DataTransfer();
  dt.items.add(new File([texto], "projeto.cal", { type: "application/json" }));
  const i = document.getElementById("proj-open-file");
  i.files = dt.files;
  i.dispatchEvent(new Event("change", { bubbles: true }));
}, JSON.stringify(projeto));
await limpa.waitForTimeout(2500);
const chegou = await limpa.evaluate((nome) =>
  [...document.getElementById("tv-model").options].some((o) => o.textContent.includes(nome)), MODELO);
conferir(chegou, "abrir o projeto trouxe o modelo com ele");

console.log("\n== a procura no mercado continua, a pedido ==");
await limpa.click('button.tab[data-mode="tv"]');
await limpa.waitForTimeout(400);
await limpa.evaluate(() => {
  window.__aberturas = [];
  window.open = function (url) { window.__aberturas.push(url); return { opener: null }; };
});
const campo2 = limpa.locator("#tv-model")
  .locator("xpath=preceding-sibling::div[contains(@class,'model-search-wrap')]//input");
await campo2.click();
await limpa.keyboard.type("Grundig", { delay: 30 });
await limpa.waitForTimeout(500);
const antesDoEnter = await limpa.evaluate(() => window.__aberturas.length);
await limpa.keyboard.press("Enter");
await limpa.waitForTimeout(300);
const porEnter = await limpa.evaluate(() => window.__aberturas.slice());
conferir(antesDoEnter === 0, "nada antes do Enter");
conferir(porEnter.length === 1 && /google\.com\/search/.test(porEnter[0]),
  "e o Enter leva à ficha no mercado: " + (porEnter[0] || "—"));
conferir(/televisor/.test(decodeURIComponent(porEnter[0] || "")),
  "com o que a lista é, para vir a ficha e não a loja");

console.log("\n== sem erros na consola ==");
conferir(erros.length === 0, erros.length ? erros.join(" | ") : "nenhum");

await browser.close();
s.close();
console.log(falhas ? `\n${falhas} falha(s).` : "\nTudo certo.");
process.exit(falhas ? 1 : 0);
