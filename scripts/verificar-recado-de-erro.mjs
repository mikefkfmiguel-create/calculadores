/**
 * QUANDO REBENTA, A APP DIZ ALGUMA COISA?
 *
 * Porque é que existe: *"a calculadora ao abrir um projeto crasha sem dizer
 * nada"*. E era verdade em toda a linha — a app não tinha UM apanhador de
 * erros. Um TypeError a meio de um recálculo parava o JavaScript onde estava,
 * deixava o ecrã com o que lá tinha, e mais nada acontecia. Num computador
 * abre-se a consola; num telemóvel, em cima de um cliente, não há consola
 * nenhuma — há uma app que "crashou".
 *
 * Este teste não procura o defeito que o fez crashar: garante que, seja ele
 * qual for, a app deixa de morrer calada. É a diferença entre um relato que
 * não dá para investigar e um que se arranja.
 *
 *   node scripts/verificar-recado-de-erro.mjs
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
const { chromium, devices } = await carregarPlaywright();
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM || "/opt/pw-browsers/chromium"
});

let falhas = 0;
const conferir = (ok, texto) => { console.log((ok ? "  ✓ " : "  ✗ ") + texto); if (!ok) falhas++; };

/** As três maneiras de falhar que existem nesta app. */
const CASOS = [
  {
    nome: "um erro de JavaScript a correr",
    provocar: (p) => p.evaluate(() => { setTimeout(() => { null.qualquerCoisa; }, 0); }),
    esperado: /qualquerCoisa|null|undefined/i
  },
  {
    nome: "uma promessa recusada sem ninguém a apanhar",
    provocar: (p) => p.evaluate(() => { Promise.reject(new Error("o fetch foi abaixo")); }),
    esperado: /o fetch foi abaixo/
  },
  {
    nome: "um ficheiro que não carregou (cache a meio)",
    provocar: (p) => p.evaluate(() => {
      const t = document.createElement("script");
      t.src = "./js/ficheiro-que-nao-existe.js";
      document.body.appendChild(t);
    }),
    esperado: /Não carregou/
  }
];

// No telemóvel, que é onde não há consola nenhuma — é esse o caso que importa.
for (const [aparelho, ops] of [["telemóvel", { ...devices["Pixel 7"] }],
                               ["computador", { viewport: { width: 1400, height: 950 } }]]) {
  console.log("\n== " + aparelho + " ==");
  for (const caso of CASOS) {
    const ctx = await browser.newContext({ ...ops, serviceWorkers: "block" });
    const pagina = await ctx.newPage();
    await pagina.goto(`http://127.0.0.1:${porta}/index.html`, { waitUntil: "networkidle" });
    await pagina.waitForFunction(() => !!window.recadoDeErro, null, { timeout: 20000 });

    await caso.provocar(pagina);
    await pagina.waitForTimeout(700);

    const visto = await pagina.evaluate(() => {
      const c = document.getElementById("recado-de-erro");
      return {
        aparece: !!c && c.style.display !== "none" && c.offsetHeight > 0,
        texto: c ? c.textContent : "",
        registados: (window.recadoDeErro.ocorrencias() || []).length,
        detalhe: window.recadoDeErro.detalhe()
      };
    });

    conferir(visto.aparece, caso.nome + " — a app diz alguma coisa");
    conferir(caso.esperado.test(visto.texto), "   e diz O QUÊ: " +
      (visto.texto.split("\n").filter(Boolean)[1] || "(nada)").slice(0, 70));
    conferir(/Copiar detalhe/.test(visto.texto), "   com botão para copiar o detalhe");
    conferir(/Calculadores v/.test(visto.detalhe) && /Mozilla|Chrome/.test(visto.detalhe),
      "   e o detalhe leva a versão e o aparelho");
    await ctx.close();
  }
}

// E o principal: o apanhador não pode ele próprio estragar a app.
{
  console.log("\n== a app continua a funcionar depois de um erro ==");
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 950 }, serviceWorkers: "block" });
  const pagina = await ctx.newPage();
  await pagina.goto(`http://127.0.0.1:${porta}/index.html`, { waitUntil: "networkidle" });
  await pagina.waitForFunction(() => document.querySelectorAll("#l-model option").length > 3, null, { timeout: 20000 });
  await pagina.evaluate(() => { setTimeout(() => { null.rebenta; }, 0); });
  await pagina.waitForTimeout(700);
  const continua = await pagina.evaluate(() => {
    document.querySelector('.tabs .tab[data-mode="led"]').click();
    const sel = document.getElementById("l-model");
    const o = [...sel.options].find((x) => x.value !== "custom" && x.value !== "");
    sel.value = o.value; sel.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  });
  await pagina.waitForTimeout(600);
  const tiles = await pagina.evaluate(() => (document.getElementById("l-out-tiles") || {}).textContent);
  conferir(continua && !!tiles && tiles !== "—", "as calculadoras continuam a contar (tiles = " + tiles + ")");
  await ctx.close();
}

await browser.close();
s.close();
console.log("\n" + (falhas ? falhas + " FALHA(S)" : "A app deixou de morrer calada."));
process.exit(falhas ? 1 : 0);
