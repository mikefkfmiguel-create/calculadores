/**
 * A PRIORIDADE DAS ELETRÓNICAS DE LED — a ordem e o selo dizem o mesmo?
 *
 * Reparo dele a olhar para a lista: *"esta prioridade de escolha de
 * electrónicas está errada"*. E estava, de duas maneiras que se alimentavam
 * uma à outra:
 *
 *   · a LISTA ordenava-se por nº de unidades (menos caixas para alugar e
 *     transportar) e o SELO saía só da percentagem de ocupação. Como as
 *     duas coisas não têm nada a ver uma com a outra, uma máquina a 92%
 *     ("Não aconselhado", a vermelho) aparecia ACIMA de outra a 40%
 *     ("Possível", a amarelo). Duas réguas na mesma linha;
 *   · e o primeiro da lista levava "Recomendado" SEMPRE. Em Full HD havia
 *     duas máquinas a 83% lado a lado: a de cima dizia "Recomendado" a
 *     verde, a de baixo "Não aconselhado" a vermelho. O mesmo número, dois
 *     selos opostos.
 *
 * O que este teste guarda, nas duas listas que existem (aba Sinal e aba
 * Projeto), e em três resoluções diferentes:
 *
 *   1. dentro da MESMA lista (própria ou mercado), o selo nunca piora e
 *      volta a melhorar — um "Não aconselhado" nunca fica acima de um
 *      "Possível";
 *   2. "Recomendado" só cai em cima de uma máquina com folga a sério (não
 *      passa da linha dos 80% que a própria app usa para dizer "Não
 *      aconselhado");
 *   3. há no máximo UM "Recomendado" por lista;
 *   4. e a linha que ele viu: em Full HD, a primeira já não é uma a 83%.
 *
 *   node scripts/verificar-prioridade-eletronicas.mjs
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

/** A linha dos 80% é a da app (APERTADO_PCT). Aqui repete-se de propósito:
 *  um teste que fosse buscar a constante à app aprovava-a fosse ela qual
 *  fosse. */
const APERTADO = 80;

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

/** Lê uma lista de eletrónicas do ecrã: selo, dono e percentagem, por linha. */
const lerLista = (id) => pagina.evaluate((alvo) => {
  const caixa = document.getElementById(alvo);
  if (!caixa) return null;
  return [...caixa.querySelectorAll(".lm-item")].map((el) => {
    const selo = el.querySelector(".lm-priority");
    const texto = el.textContent || "";
    const pct = /(\d+)\s*%\)?/.exec(texto.replace(/\s+/g, " "));
    return {
      selo: selo ? selo.textContent.trim() : "",
      mercado: !!el.querySelector(".lm-market"),
      pct: pct ? parseInt(pct[1], 10) : null,
      nome: (el.querySelector("strong") ? el.querySelector("strong").textContent : "") +
            " " + (el.querySelector(".lm-model") ? el.querySelector(".lm-model").textContent : "")
    };
  }).filter((l) => l.selo || l.pct != null);
}, id);

/**
 * As três regras, sobre uma lista lida do ecrã.
 *
 * A monotonia confere-se DENTRO de cada grupo de posse: o inventário da AVK
 * vem sempre primeiro (regra da casa), por isso um apertado da casa pode
 * ficar acima de um folgado do mercado — mas esse traz o selo "Mercado" ao
 * lado, a dizer que é outra lista.
 */
function conferirLista(linhas, onde) {
  conferir(Array.isArray(linhas) && linhas.length > 0,
    onde + ": a lista tem linhas (" + (linhas ? linhas.length : "nenhuma") + ")");
  if (!linhas || !linhas.length) return;

  const recomendados = linhas.filter((l) => l.selo === "Recomendado");
  conferir(recomendados.length <= 1,
    onde + ": no máximo um \"Recomendado\" (" + recomendados.length + ")");
  recomendados.forEach((r) => {
    conferir(r.pct != null && r.pct <= APERTADO,
      onde + ": o \"Recomendado\" tem folga a sério — " + r.nome.trim() + " a " + r.pct + "%");
  });

  ["propria", "mercado"].forEach((grupo) => {
    const doGrupo = linhas.filter((l) => (grupo === "mercado") === l.mercado);
    if (doGrupo.length < 2) return;
    // Valor de cada selo, do melhor para o pior. A lista tem de descer, e
    // nunca voltar a subir.
    const valor = (l) => (l.selo === "Recomendado" ? 0 : l.selo === "Possível" ? 1 : 2);
    let mau = null;
    for (let i = 1; i < doGrupo.length; i++) {
      if (valor(doGrupo[i]) < valor(doGrupo[i - 1])) {
        mau = doGrupo[i - 1].nome.trim() + " («" + doGrupo[i - 1].selo + "», " + doGrupo[i - 1].pct +
              "%) acima de " + doGrupo[i].nome.trim() + " («" + doGrupo[i].selo + "», " + doGrupo[i].pct + "%)";
        break;
      }
    }
    conferir(mau === null,
      onde + " · " + (grupo === "mercado" ? "mercado" : "da AVK") +
      ": o selo nunca piora e volta a melhorar" + (mau ? " — " + mau : ""));
  });
}

const escrever = (campos) => pagina.evaluate((c) => {
  Object.keys(c).forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.value = String(c[id]);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  });
}, campos);

const CASOS = [
  { nome: "Full HD", h: 1920, v: 1080 },
  { nome: "4K", h: 3840, v: 2160 },
  { nome: "um ecrã que dá 97% numa máquina", h: 2600, v: 1400 }
];

// ------------------------------------------------------------ aba Sinal

await pagina.evaluate(() => document.querySelector('.tabs .tab[data-mode="sinal"]').click());
await pagina.waitForTimeout(500);

for (const caso of CASOS) {
  console.log("\n== aba Sinal · " + caso.nome + " (" + caso.h + " × " + caso.v + ") ==");
  await escrever({ "sg-h": caso.h, "sg-v": caso.v });
  await pagina.waitForTimeout(500);
  const linhas = await lerLista("sg-ledproc-list");
  conferirLista(linhas, "Sinal/" + caso.nome);
  if (linhas && linhas.length) {
    console.log(linhas.slice(0, 5).map((l) =>
      "     " + (l.selo || "—").padEnd(13) + (l.mercado ? "[Mercado] " : "          ") +
      l.nome.trim() + " — " + l.pct + "%").join("\n"));
  }
}

// A linha que ele viu: em Full HD a primeira era uma máquina a 83%, com
// outra a 83% logo abaixo a dizer "Não aconselhado".
await escrever({ "sg-h": 1920, "sg-v": 1080 });
await pagina.waitForTimeout(500);
const fullHd = await lerLista("sg-ledproc-list");
console.log("\n== a linha que ele viu ==");
conferir(!!fullHd && fullHd.length > 0 && fullHd[0].pct <= APERTADO,
  "em Full HD, a primeira da lista já não está no limite (" +
  (fullHd && fullHd.length ? fullHd[0].nome.trim() + " a " + fullHd[0].pct + "%" : "lista vazia") + ")");
const oitentaETres = (fullHd || []).filter((l) => l.pct === 83);
conferir(oitentaETres.every((l) => l.selo !== "Recomendado"),
  "e nenhuma das que enchem 83% leva \"Recomendado\" (" + oitentaETres.length + " a 83%)");

// ----------------------------------------------------------- aba Projeto

await pagina.evaluate(() => document.querySelector('.tabs .tab[data-mode="projeto"]').click());
await pagina.waitForTimeout(600);

// A aba nasce em "custom", sem modelo escolhido — e sem modelo não há
// píxeis, e sem píxeis não há lista de eletrónicas nenhuma para conferir.
// Escolhe-se o primeiro painel do catálogo, e conta-se em tiles (é o modo
// em que a aba abre).
const painel = await pagina.evaluate(() => {
  const sel = document.getElementById("proj-led-model");
  const opt = [...sel.options].find((o) => o.value !== "custom" && o.value !== "");
  if (!opt) return null;
  sel.value = opt.value;
  sel.dispatchEvent(new Event("change", { bubbles: true }));
  return opt.textContent.trim();
});
conferir(!!painel, "escolhido um painel do catálogo na aba Projeto (" + painel + ")");
await pagina.waitForTimeout(600);

// Só a parte dos píxeis: o mesmo elemento escreve a seguir os MP, e juntar
// os dígitos dos dois dava um número que não é nada.
const pixeisDoProjeto = () => pagina.evaluate(() => {
  const m = /^([\d\s  ]+)px/.exec(document.getElementById("proj-out-pxtotal").textContent.trim());
  return m ? m[1].replace(/\D+/g, "") : "";
});
const pixeisVistos = [];

for (const caso of [{ nome: "4 × 2,5 m", l: 4, a: 2.5 }, { nome: "12 × 6 m", l: 12, a: 6 }]) {
  console.log("\n== aba Projeto · " + caso.nome + " ==");
  await escrever({ "proj-led-w": caso.l, "proj-led-h": caso.a });
  await pagina.waitForTimeout(600);
  // Um segundo caso que dá exactamente o mesmo não é um segundo caso: se os
  // metros não chegarem ao cálculo, isto mede duas vezes o mesmo ecrã e não
  // dá por nada. (Aconteceu: a primeira versão escrevia nos campos de tiles,
  // que nesta aba estão escondidos e não mexem em nada.)
  pixeisVistos.push(await pixeisDoProjeto());
  const linhas = await lerLista("proj-ledproc-list");
  conferirLista(linhas, "Projeto/" + caso.nome);
  if (linhas && linhas.length) {
    console.log(linhas.slice(0, 5).map((l) =>
      "     " + (l.selo || "—").padEnd(13) + (l.mercado ? "[Mercado] " : "          ") +
      l.nome.trim() + " — " + l.pct + "%").join("\n"));
  }
  // Os switchers da mesma aba partilham o markBestOption: um "Recomendado"
  // num switcher no limite era o mesmo defeito noutro sítio.
  const switchers = await lerLista("proj-switcher-list");
  if (switchers && switchers.length) {
    const rec = switchers.filter((x) => x.selo === "Recomendado");
    conferir(rec.every((x) => x.pct != null && x.pct <= APERTADO),
      "Projeto/" + caso.nome + " · switchers: o \"Recomendado\" também tem folga" +
      (rec.length ? " (" + rec[0].nome.trim() + " a " + rec[0].pct + "%)" : " (não há nenhum)"));
  }
}

conferir(pixeisVistos.length === 2 && pixeisVistos[0] && pixeisVistos[0] !== pixeisVistos[1],
  "os dois ecrãs da aba Projeto são mesmo diferentes (" +
  pixeisVistos.join(" px e ") + " px)");

console.log("\n== sem erros na consola ==");
conferir(erros.length === 0, erros.length ? erros.join(" | ") : "nenhum");

await browser.close();
s.close();
console.log(falhas ? `\n${falhas} falha(s).` : "\nA ordem e o selo dizem o mesmo.");
process.exit(falhas ? 1 : 0);
