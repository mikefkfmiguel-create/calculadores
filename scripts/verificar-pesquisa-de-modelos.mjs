/**
 * PROCURAR UM MODELO NA LISTA.
 *
 * Reportado com uma fotografia da aba TVs, com "Xiaomi tv" escrito no campo:
 * *"não encontra"*.
 *
 * Nesse caso não havia nada a encontrar — a AVK não tem Xiaomi nenhum, e o
 * link para o mercado é a saída certa. Mas ao medir a lista a sério apareceu
 * um defeito maior, que escondia equipamento que a casa TEM: a pesquisa
 * procurava o texto escrito INTEIRO dentro da etiqueta da opção. A etiqueta é
 * `Led TV 55" 4K Samsung TU55DU7105K — 55"`, e por isso:
 *
 *     "samsung 55"     →  1 resultado,   e há 13
 *     "55 samsung"     →  0,             e há 13
 *     "samsung uhd"    →  0,             e há  8
 *     "lg 86 4k"       →  0,             e há  4
 *     "traulux 75"     →  0,             e há  1
 *
 * Quem escreve a marca antes do tamanho tinha de adivinhar a ordem por que o
 * inventário foi escrito. Agora procura-se PALAVRA a palavra: aparece o que
 * tem todas, seja qual for a ordem.
 *
 * O que este teste guarda:
 *
 *   1. as consultas acima trazem o que a lista tem mesmo — contado contra o
 *      `data/tvs.json`, não contra um número escrito à mão aqui;
 *   2. a ordem das palavras deixou de contar;
 *   3. uma marca que a casa não tem continua a não inventar nada: zero
 *      opções, e o link para o mercado à vista;
 *   4. e o recado DIZ QUAL É A PALAVRA que não existe — era o que faltava
 *      para "não encontra" deixar de parecer uma avaria;
 *   5. limpar o campo devolve a lista toda.
 *
 *   node scripts/verificar-pesquisa-de-modelos.mjs
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

// A CONTA DE CONTROLO SAI DO CATÁLOGO, não de um número escrito aqui. Um
// número à mão envelhece no dia em que a AVK comprar outra TV, e um teste que
// envelhece assim é pior do que teste nenhum.
const normal = (s) => String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const tvs = JSON.parse(await readFile(join(RAIZ, "data/tvs.json"), "utf8"));
const etiquetas = tvs.map((t) => t.modelo + ' — ' + t.diag + '"' + (t.touchscreen ? " touchscreen" : ""));
const quantosNoCatalogo = (consulta) => {
  const termos = normal(consulta).split(/\s+/).filter(Boolean);
  return etiquetas.filter((e) => termos.every((t) => normal(e).indexOf(t) !== -1)).length;
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

// Escreve no campo de pesquisa que a app põe por cima do select das TVs, e
// devolve o que ficou VISÍVEL — não o que o filtro devia ter feito.
const procurar = (texto) => pagina.evaluate(async (t) => {
  const sel = document.getElementById("tv-model");
  const campo = sel.parentNode.querySelector(".model-search");
  campo.value = t;
  campo.dispatchEvent(new Event("input", { bubbles: true }));
  await new Promise((r) => setTimeout(r, 120));
  const visiveis = [...sel.options].filter((o) => !o.hidden && o.value !== "custom");
  const recado = sel.parentNode.querySelector(".model-search-noresult");
  return {
    visiveis: visiveis.length,
    exemplos: visiveis.slice(0, 2).map((o) => o.textContent),
    recado: (recado && recado.style.display !== "none") ? recado.textContent : null,
    link: !!(recado && recado.style.display !== "none" && recado.querySelector("a"))
  };
}, texto);

const contagem = await pagina.evaluate(() => {
  const opts = [...document.getElementById("tv-model").options].filter((o) => o.value !== "custom");
  const tamanhos = opts.filter((o) => /qualquer marca/.test(o.textContent)).length;
  return { total: opts.length, tamanhos: tamanhos };
});
const totalNaLista = contagem.total;
console.log("\n   a lista tem " + totalNaLista + " entradas: " + tvs.length +
  " do inventário + " + contagem.tamanhos + " tamanhos de mercado");
// Desde a v4.17 a lista não é só o inventário — leva também os tamanhos de
// mercado, que são geometria e não fichas. O inventário tem de lá estar
// INTEIRO na mesma: é isso que esta conta guarda.
conferir(totalNaLista === tvs.length + contagem.tamanhos && contagem.tamanhos > 0,
  "a lista traz o catálogo todo, mais os tamanhos de mercado");

console.log("\n== a ordem das palavras deixou de contar ==");
for (const consulta of ["samsung 55", "55 samsung", "samsung uhd", "lg 86 4k", "traulux 75", "touchscreen"]) {
  const r = await procurar(consulta);
  const esperado = quantosNoCatalogo(consulta);
  conferir(r.visiveis === esperado && esperado > 0,
    `«${consulta}» → ${r.visiveis} modelos (catálogo diz ${esperado})` +
    (r.exemplos[0] ? "  ex: " + r.exemplos[0] : ""));
}

// A mesma pergunta escrita ao contrário tem de dar o mesmo — era este o
// defeito, e é a asserção que o impede de voltar.
const a = await procurar("samsung 55");
const b = await procurar("55 samsung");
conferir(a.visiveis === b.visiveis && a.visiveis > 1,
  `"samsung 55" e "55 samsung" dão o mesmo (${a.visiveis} e ${b.visiveis})`);

console.log("\n== o que a casa não tem continua a não aparecer ==");
const x = await procurar("Xiaomi tv");
conferir(x.visiveis === 0, "«Xiaomi tv» → 0 modelos (a AVK não tem Xiaomi)");
conferir(x.link, "e o link para procurar no mercado está à vista");
conferir(!!x.recado && /xiaomi/i.test(x.recado),
  "o recado diz qual é a palavra que não existe: “" + (x.recado || "").trim() + "”");

// Uma palavra que existe, outra que não: o recado tem de apontar a que falha,
// e não dizer só "nada".
const meio = await procurar("samsung xiaomi");
conferir(meio.visiveis === 0 && /xiaomi/i.test(meio.recado || "") && !/«samsung»/i.test(meio.recado || ""),
  "«samsung xiaomi» aponta só o «xiaomi»: “" + (meio.recado || "").trim() + "”");

// Duas palavras que existem mas nunca juntas — outro recado, porque é outra
// coisa: não é a lista que não conhece a palavra, é a combinação que não há.
const cruzado = await procurar("samsung lg");
conferir(cruzado.visiveis === 0 && /junta/i.test(cruzado.recado || ""),
  "«samsung lg» diz que cada palavra existe mas nenhum modelo as junta: “" +
  (cruzado.recado || "").trim() + "”");

console.log("\n== limpar o campo devolve a lista toda ==");
const limpo = await procurar("");
conferir(limpo.visiveis === totalNaLista, `${limpo.visiveis} de ${totalNaLista} modelos de volta`);
conferir(limpo.recado === null, "e o recado do mercado desaparece");

console.log("\n== sem erros na consola ==");
conferir(erros.length === 0, erros.length ? erros.join(" | ") : "nenhum");

await browser.close();
s.close();
console.log(falhas ? `\n${falhas} falha(s).` : "\nTudo certo.");
process.exit(falhas ? 1 : 0);
