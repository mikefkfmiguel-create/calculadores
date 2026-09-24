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

// A PROCURA NA WEB é interceptada aqui. Nenhum teste toca no Worker a sério:
// custaria dinheiro, dependeria da net, e o que interessa medir é o que a
// app faz com cada resposta possível — não a resposta em si (essa tem os
// seus testes em worker/testes/modelo.test.mjs).
let respostaDaWeb = { ok: false, motivo: "não encontrei" };
let pedidosAWeb = [];
await ctx.route("**/modelo", async (rota) => {
  pedidosAWeb.push(JSON.parse(rota.request().postData() || "{}"));
  await rota.fulfill({ status: 200, contentType: "application/json",
                       body: JSON.stringify(respostaDaWeb) });
});

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

console.log("\n== o que a lista não tem entra sozinho, e nada abre ==");
await campo.click();
await pagina.keyboard.type(MODELO, { delay: 30 });
await pagina.waitForTimeout(1600);          // a regra do silêncio: 900 ms

const caixaTexto = () => pagina.evaluate(() => {
  const r = document.getElementById("tv-model").parentNode.querySelector(".model-search-noresult");
  return (r && r.style.display !== "none") ? r.textContent.replace(/\s+/g, " ").trim() : null;
});
const estado = () => pagina.evaluate(() => {
  const sel = document.getElementById("tv-model");
  const esc = sel.options[sel.selectedIndex];
  return {
    escolhido: esc ? esc.textContent : null,
    stock: esc ? esc.dataset.stock : null,
    diag: document.getElementById("tv-diag").value,
    ratio: document.getElementById("tv-ratio").value,
    res: document.getElementById("tv-out-res").textContent,
    largura: document.getElementById("tv-out-w").textContent,
    meus: (window.meusModelos.ler("tv") || []).map((m) => m.modelo),
    formulario: !!document.querySelector("#mm-dialog[open]")
  };
});

const sozinho = await aberturas();
const feito = await estado();
const recado = await caixaTexto();
conferir(sozinho.length === 0, `nenhum separador aberto (${sozinho.length})`);
conferir(!feito.formulario, "e nenhum formulário a pedir nada");
conferir(feito.meus.length === 1 && feito.meus[0] === MODELO,
  "o modelo entrou na lista sozinho: " + JSON.stringify(feito.meus));
conferir(!!feito.escolhido && feito.escolhido.includes(MODELO),
  "e ficou escolhido: " + feito.escolhido);
conferir(feito.diag === "55", "com a diagonal lida do nome: " + feito.diag);
conferir(/1,22/.test(feito.largura), "e a conta feita: largura " + feito.largura);

console.log("\n== e diz o que fez, com o que ficou por confirmar ==");
conferir(!!recado && /Acrescentei/.test(recado), "“" + (recado || "—") + "”");
conferir(!!recado && /por confirmar/.test(recado),
  "a resolução fica por confirmar — não se inventa um 4K que ninguém viu");
conferir(/não confirmada/.test(feito.res), "e a aba diz o mesmo: " + feito.res);

console.log("\n== e foi mesmo procurar na web ==");
conferir(pedidosAWeb.length >= 1, "a app pediu a procura (" + pedidosAWeb.length + ")");
conferir(!!pedidosAWeb[0] && pedidosAWeb[0].q === MODELO && pedidosAWeb[0].tipo === "tv",
  "com o que estava escrito: " + JSON.stringify(pedidosAWeb[0] || null));
conferir(!!recado && /a web não deu/.test(recado),
  "e, como a web não deu, diz porquê em vez de calar: “" + (recado || "") + "”");

console.log("\n== quando a web ENCONTRA, entra a ficha inteira ==");
// O caso que o pedido descreve: escrever uma marca que a lista não tem, e a
// app trazer a ficha de lá — com a resolução, que é a única coisa que ela
// não consegue deduzir sozinha.
respostaDaWeb = { ok: true, modelo: {
  modelo: "Xiripiti A55", diag: 55, ratio: "16:9",
  resolucao: { rx: 3840, ry: 2160 }, touchscreen: false,
  fonte: "https://www.xiripiti.com/tv/a55"
} };
await campo.fill("");
await pagina.keyboard.type("xiripiti", { delay: 25 });
await pagina.waitForTimeout(1800);
const daWeb = await estado();
const recadoWeb = await caixaTexto();
conferir(daWeb.meus.includes("Xiripiti A55"),
  "entrou com o nome que o fabricante usa: " + JSON.stringify(daWeb.meus));
conferir(daWeb.diag === "55", "com a diagonal da ficha: " + daWeb.diag);
conferir(/3840/.test(daWeb.res), "e a RESOLUÇÃO, que a app não sabia deduzir: " + daWeb.res);
conferir(!!recadoWeb && /encontrado em xiripiti\.com/.test(recadoWeb),
  "e diz onde a foi buscar: “" + (recadoWeb || "") + "”");
const fonteNaAba = await pagina.evaluate(() => {
  const a = document.getElementById("tv-model-source").querySelector("a");
  return a ? a.getAttribute("href") : null;
});
conferir(/xiripiti\.com/.test(fonteNaAba || ""), "com a fonte agarrada ao modelo: " + fonteNaAba);

console.log("\n== e sem rede continua a fazer a conta ==");
// Isto é o que garante que a app não fica inútil em obra: a web é o melhor
// caminho, nunca o único.
await pagina.context().setOffline(true);
await campo.fill("");
await pagina.keyboard.type("Telefunken 43", { delay: 25 });
await pagina.waitForTimeout(1800);
const semRede = await estado();
conferir(semRede.meus.includes("Telefunken 43"),
  "acrescentou à mesma: " + JSON.stringify(semRede.meus));
conferir(semRede.diag === "43", "com a diagonal lida do nome: " + semRede.diag);
conferir(/não confirmada/.test(semRede.res), "e a resolução por confirmar: " + semRede.res);
await pagina.context().setOffline(false);
respostaDaWeb = { ok: false, motivo: "não encontrei" };

console.log("\n== continuar a escrever substitui, não duplica ==");
// Uma pausa a meio de escrever acrescenta o que lá está; acabar a palavra
// tem de corrigir esse, e não deixar dois meios modelos na lista.
await campo.fill("");
await pagina.keyboard.type("Grundig", { delay: 25 });
await pagina.waitForTimeout(1500);
const aMeio = await estado();
await pagina.keyboard.type(" 43", { delay: 25 });
await pagina.waitForTimeout(1500);
const completo = await estado();
conferir(aMeio.meus.includes("Grundig"), "a meio ficou «Grundig» (" + aMeio.meus.join(", ") + ")");
conferir(completo.meus.includes("Grundig 43") && !completo.meus.includes("Grundig"),
  "e ao acabar ficou só «Grundig 43»: " + completo.meus.join(", "));
conferir(completo.diag === "43", "com a diagonal nova: " + completo.diag);

console.log("\n== desfazer tira-o outra vez ==");
await pagina.click(".model-search-noresult .model-desfazer");
await pagina.waitForTimeout(500);
const desfeito = await estado();
conferir(!desfeito.meus.includes("Grundig 43"), "saiu da lista: " + JSON.stringify(desfeito.meus));
conferir(desfeito.escolhido === "Personalizado…", "e a escolha voltou a «" + desfeito.escolhido + "»");

console.log("\n== sem diagonal em lado nenhum, pergunta só isso ==");
await pagina.fill("#tv-diag", "");
await campo.fill("");
await pagina.keyboard.type("Sharp tv", { delay: 25 });
await pagina.waitForTimeout(1500);
const semDiag = await estado();
const pergunta = await caixaTexto();
conferir(!semDiag.meus.some((m) => /sharp/i.test(m)),
  "não acrescentou nada a adivinhar: " + JSON.stringify(semDiag.meus));
conferir(!!pergunta && /diagonal/i.test(pergunta), "pede a diagonal: “" + (pergunta || "—") + "”");
conferir(await pagina.locator(".model-search-noresult .model-diag").count() === 1,
  "com UM campo, não um formulário");
await pagina.fill(".model-search-noresult .model-diag", "50");
await pagina.click(".model-search-noresult .model-add");
await pagina.waitForTimeout(700);
const comDiag = await estado();
conferir(comDiag.meus.includes("Sharp tv"), "escrita a diagonal, entrou: " + JSON.stringify(comDiag.meus));
conferir(comDiag.diag === "50", "e aplicou-se: " + comDiag.diag + '"');

console.log("\n== o mercado está na lista, em tamanhos ==");
const mercado = await pagina.evaluate(() => {
  const sel = document.getElementById("tv-model");
  const tamanhos = [...sel.options].filter((o) => /qualquer marca/.test(o.textContent));
  return { quantos: tamanhos.length, exemplo: tamanhos[0] ? tamanhos[0].textContent : null,
           valores: tamanhos.map((o) => o.value) };
});
conferir(mercado.quantos >= 14, mercado.quantos + " tamanhos de mercado na lista");
conferir(/qualquer marca \(16:9\)/.test(mercado.exemplo || ""), "dizem o que são: " + mercado.exemplo);
// Escolher um tem de dar a conta desse tamanho — é para isso que lá estão.
await pagina.evaluate((v) => {
  const sel = document.getElementById("tv-model");
  sel.value = v;
  sel.dispatchEvent(new Event("change", { bubbles: true }));
}, mercado.valores[mercado.valores.length - 1]);
await pagina.waitForTimeout(500);
const escolhido = await estado();
conferir(parseFloat(escolhido.diag) >= 98, "escolher um tamanho aplica-o: " + escolhido.diag + '"');

console.log("\n== a ficha completa-se quando alguém a tiver ==");
await campo.fill("");
await pagina.keyboard.type(MODELO, { delay: 25 });
await pagina.waitForTimeout(1500);
await pagina.click(".model-search-noresult .model-ficha");
await pagina.waitForTimeout(500);
const form = await pagina.evaluate(() => ({
  aberto: !!document.querySelector("#mm-dialog[open]"),
  modelo: document.getElementById("mm-modelo").value,
  diag: document.getElementById("mm-diag").value
}));
conferir(form.aberto && form.modelo === MODELO && form.diag === "55",
  "o formulário abre já com o que a app deduziu: " + form.modelo + " / " + form.diag);
await pagina.evaluate(() => {
  document.getElementById("mm-rx").value = "3840";
  document.getElementById("mm-ry").value = "2160";
  document.getElementById("mm-fonte").value = "https://www.mi.com/global/product/xiaomi-tv-a-pro/";
  document.getElementById("mm-guardar").click();
});
await pagina.waitForTimeout(800);
const comFicha = await pagina.evaluate(() => ({
  res: document.getElementById("tv-out-res").textContent,
  fonte: (function () {
    var a = document.getElementById("tv-model-source").querySelector("a");
    return a ? a.getAttribute("href") : null;
  })()
}));
conferir(/3840/.test(comFicha.res), "a resolução passou a estar confirmada: " + comFicha.res);
conferir(/^https:\/\/www\.mi\.com\//.test(comFicha.fonte || ""),
  "com fonte: " + (comFicha.fonte || "—"));

console.log("\n== e tem como sair daqui para o catálogo de toda a gente ==");
const linhaCat = await pagina.evaluate(() => {
  const caixa = document.getElementById("tv-model-meu");
  const m = window.meusModelos.ler("tv").find((x) => x.resolucao);
  return { visivel: !caixa.hidden, nota: caixa.textContent, linha: window.meusModelos.linhaDeCatalogo(m) };
});
conferir(linhaCat.visivel && /Acrescentado por ti/.test(linhaCat.nota),
  "a linha diz de quem é: “" + linhaCat.nota.replace(/\s+/g, " ").trim() + "”");
let comoNoCatalogo = null;
try { comoNoCatalogo = JSON.parse(linhaCat.linha); } catch (_) {}
conferir(!!comoNoCatalogo && comoNoCatalogo.modelo === MODELO && comoNoCatalogo.diag === 55 &&
  comoNoCatalogo.resolucao && comoNoCatalogo.resolucao.rx === 3840,
  "e a linha copiada entra no data/tvs.json tal como está: " + linhaCat.linha);
conferir(!("meu" in (comoNoCatalogo || {})) && !("auto" in (comoNoCatalogo || {})),
  "sem as marcas desta app («meu», «auto»), que não são do catálogo");

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

console.log("\n== o Enter acrescenta; o mercado é um link, e só a pedido ==");
await limpa.click('button.tab[data-mode="tv"]');
await limpa.waitForTimeout(400);
await limpa.evaluate(() => {
  window.__aberturas = [];
  window.open = function (url) { window.__aberturas.push(url); return { opener: null }; };
});
const campo2 = limpa.locator("#tv-model")
  .locator("xpath=preceding-sibling::div[contains(@class,'model-search-wrap')]//input");
await campo2.click();
await limpa.keyboard.type("Philips 65", { delay: 25 });
await limpa.keyboard.press("Enter");          // sem esperar pelo silêncio
await limpa.waitForTimeout(700);
const porEnter = await limpa.evaluate(() => ({
  aberturas: window.__aberturas.length,
  meus: (window.meusModelos.ler("tv") || []).map((m) => m.modelo),
  diag: document.getElementById("tv-diag").value
}));
conferir(porEnter.aberturas === 0, "o Enter não abre separador nenhum (" + porEnter.aberturas + ")");
conferir(porEnter.meus.includes("Philips 65"), "acrescenta logo: " + JSON.stringify(porEnter.meus));
conferir(porEnter.diag === "65", "e aplica: " + porEnter.diag + '"');

// O mercado continua a existir — como LINK, para conferir a ficha. Nunca
// sozinho, e por isso só se mede o endereço, que é o que um toque abriria.
const linkMercado = await limpa.evaluate(() => {
  const a = document.querySelector(".model-search-noresult a.srclink");
  return a ? a.getAttribute("href") : null;
});
conferir(!!linkMercado && /google\.com\/search/.test(linkMercado) &&
  /televisor/.test(decodeURIComponent(linkMercado)),
  "e o link leva à ficha, com o que a lista é: " + (linkMercado || "—"));

console.log("\n== sem erros na consola ==");
conferir(erros.length === 0, erros.length ? erros.join(" | ") : "nenhum");

await browser.close();
s.close();
console.log(falhas ? `\n${falhas} falha(s).` : "\nTudo certo.");
process.exit(falhas ? 1 : 0);
