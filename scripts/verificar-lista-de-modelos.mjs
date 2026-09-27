/**
 * A LISTA PRIMEIRO, A PROCURA A SEGUIR.
 *
 * Pedido, com uma foto do campo "Modelo de referência": *"em vez de ter
 * obrigatoriamente de escrever pode dar a lista de existentes, e a opção de
 * escrever para procura se não estiver na lista existente por falta de
 * atualização"*.
 *
 * A lista SEMPRE lá esteve — é o `<select>` com os 38 tiles do catálogo. O
 * que estava mal era a ordem de leitura: a caixa de pesquisa vinha POR CIMA
 * dela, e lia-se como se escrever fosse obrigatório; a lista, logo a seguir
 * e a dizer "Personalizado…", parecia vazia.
 *
 * Passa a ler-se pela ordem em que se decide: vê-se o que há, e só quem não
 * encontrar o seu é que escreve — e a caixa passou a dizer isso pelo nome.
 *
 * O que este teste guarda:
 *
 *   1. em TODOS os campos de modelo da app, a lista vem antes da caixa de
 *      procura — não só naquele da foto;
 *   2. a lista tem mesmo o catálogo lá dentro, sem ninguém escrever nada;
 *   3. a caixa diz para que serve ("não está na lista?");
 *   4. e continua a filtrar: escrever um modelo do catálogo deixa-o à vista
 *      e esconde os outros. O que mudou foi a ordem, não o que a caixa faz.
 *
 *   node scripts/verificar-lista-de-modelos.mjs
 */

import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = fileURLToPath(new URL("..", import.meta.url));

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

const { s, porta } = await servidor();
const { chromium } = await carregarPlaywright();
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM || "/opt/pw-browsers/chromium"
});
const ctx = await browser.newContext({ viewport: { width: 1500, height: 1000 }, serviceWorkers: "block" });
const pagina = await ctx.newPage();
const erros = [];
pagina.on("pageerror", (e) => erros.push(e.message));

let falhas = 0;
const conferir = (ok, texto) => { console.log((ok ? "  ✓ " : "  ✗ ") + texto); if (!ok) falhas++; };

await pagina.goto(`http://127.0.0.1:${porta}/index.html`, { waitUntil: "networkidle" });
await pagina.waitForFunction(() => document.querySelectorAll("#l-model option").length > 3, null, { timeout: 20000 });
// A app abre no menu de entrada; as abas estão atrás dele.
await pagina.evaluate(() => { const m = document.getElementById("btMenuCompleta"); if (m) m.click(); });
await pagina.waitForTimeout(600);

console.log("\n== o campo da foto: a lista antes da caixa ==");
await pagina.evaluate(() => document.querySelector('.tabs .tab[data-mode="led"]').click());
await pagina.waitForTimeout(700);

const campo = await pagina.evaluate(() => {
  const sel = document.getElementById("l-model");
  const caixa = sel.parentNode.querySelector(".model-search");
  if (!caixa) return null;
  // compareDocumentPosition: FOLLOWING (4) quer dizer que a caixa vem
  // DEPOIS da lista na página, que é o que se quer garantir.
  const depois = !!(sel.compareDocumentPosition(caixa) & Node.DOCUMENT_POSITION_FOLLOWING);
  return {
    opcoes: sel.options.length,
    primeiraOpcao: sel.options[0] ? sel.options[0].textContent.trim() : null,
    caixaDepoisDaLista: depois,
    placeholder: caixa.placeholder,
    exemplo: sel.options.length > 1 ? sel.options[1].textContent.trim() : null
  };
});
conferir(!!campo, "o campo existe");
if (campo) {
  conferir(campo.caixaDepoisDaLista, "a caixa de procura vem DEPOIS da lista");
  conferir(campo.opcoes > 10,
    "e a lista já traz o catálogo, sem se escrever nada (" + campo.opcoes + " opções)");
  conferir(/não está na lista/i.test(campo.placeholder),
    "a caixa diz para que serve: «" + campo.placeholder + "»");
  console.log("   primeira da lista: " + campo.primeiraOpcao + " · exemplo: " + campo.exemplo);
}

console.log("\n== e continua a filtrar, que é o que a caixa faz ==");
// O que mudou foi a ordem de leitura, não o comportamento. Escrever um
// modelo do catálogo tem de o deixar à vista e esconder os outros.
const filtrou = await pagina.evaluate(async (procurar) => {
  const sel = document.getElementById("l-model");
  const caixa = sel.parentNode.querySelector(".model-search");
  caixa.value = procurar;
  caixa.dispatchEvent(new Event("input", { bubbles: true }));
  await new Promise((r) => setTimeout(r, 500));
  const visiveis = [...sel.options].filter((o) => !o.hidden);
  return { total: sel.options.length, visiveis: visiveis.length,
           primeiro: visiveis[0] ? visiveis[0].textContent.trim() : null };
}, (campo && campo.exemplo ? campo.exemplo.split(" ")[0] : "Unilumin"));
conferir(filtrou.visiveis > 0 && filtrou.visiveis < filtrou.total,
  "escrever estreita a lista (" + filtrou.total + " → " + filtrou.visiveis + ")");
conferir(!!filtrou.primeiro, "e o que fica é o que se procurou: " + filtrou.primeiro);
await pagina.evaluate(() => {
  const sel = document.getElementById("l-model");
  const caixa = sel.parentNode.querySelector(".model-search");
  caixa.value = "";
  caixa.dispatchEvent(new Event("input", { bubbles: true }));
});

console.log("\n== e em TODOS os campos de modelo, não só naquele ==");
// A correcção está na função partilhada (lzAttachModelSearch), por isso vale
// para os quatro campos que a usam. Passar por todos é o que impede que um
// deles fique para trás no dia em que alguém mexa só num.
for (const aba of ["tv", "zonas", "projeto", "sinal"]) {
  await pagina.evaluate((m) => {
    const b = document.querySelector('.tabs .tab[data-mode="' + m + '"]');
    if (b) b.click();
  }, aba);
  await pagina.waitForTimeout(700);
}
const todos = await pagina.evaluate(() => {
  return [...document.querySelectorAll(".model-search")].map((caixa) => {
    const pai = caixa.closest(".field") || caixa.parentNode.parentNode;
    const sel = pai ? pai.querySelector("select") : null;
    return {
      id: sel ? (sel.id || "(sem id)") : "(sem lista)",
      opcoes: sel ? sel.options.length : 0,
      depois: !!(sel && (sel.compareDocumentPosition(caixa) & Node.DOCUMENT_POSITION_FOLLOWING)),
      placeholder: caixa.placeholder
    };
  });
});
conferir(todos.length >= 2, "há " + todos.length + " campos de modelo na app");
todos.forEach((c) => {
  conferir(c.depois, c.id + ": a caixa vem depois da lista (" + c.opcoes + " opções)");
  conferir(/não está na lista/i.test(c.placeholder), c.id + ": e diz para que serve");
});

console.log("\n== sem erros na consola ==");
conferir(erros.length === 0, erros.length ? erros.join(" | ") : "nenhum");

await browser.close();
s.close();
console.log(falhas ? `\n${falhas} falha(s).` : "\nVê-se o que há; escreve quem não encontrar o seu.");
process.exit(falhas ? 1 : 0);
