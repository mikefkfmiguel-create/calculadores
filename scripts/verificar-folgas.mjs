/**
 * AS FOLGAS ENTRE ECRÃS — o desenho e o texto dizem o mesmo?
 *
 * Pedido a olhar para um conjunto de quatro: *"aqui dava jeito saber o tamanho
 * dos gaps visualmente entre ecrãs"*. O número já existia na soma ("Dimensão
 * do conjunto (com gaps)"), mas para saber quanto media CADA um era preciso ir
 * aos limites X na coluna ao lado e subtrair de cabeça.
 *
 * O risco desta funcionalidade não é desenhar mal: é o desenho e o texto que
 * se copia divergirem, e alguém levar para a obra um número que a app já não
 * diz. Por isso este teste compara os TRÊS: a geometria calculada à mão aqui,
 * o que está escrito no SVG, e o que está no resumo que se copia.
 *
 *   node scripts/verificar-folgas.mjs
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

// Tiles de 500×500 mm com 192×192 px, que é o do conjunto que deu origem a
// isto. Serve para as medidas saírem redondas e conferíveis à mão.
const TILE = {
  modelValue: "custom", tipo: "led", posMode: "center", sizeMode: "tiles",
  mw: "500", mh: "500", rx: "192", ry: "192", weight: "6.3", amp: "0.65", visible: true
};
const z = (nome, mx, my, posX, posY) => ({ ...TILE, name: nome, mx: String(mx), my: String(my),
                                           posX: String(posX), posY: String(posY) });

const CASOS = [
  {
    nome: "o conjunto de quatro que deu origem a isto",
    zonas: [z("left side", 5, 7, -15.0, 0), z("ppt left", 14, 8, -9.5, 0),
            z("ppt left 2", 14, 8, 3.95, -0.06), z("right side", 5, 7, 9.2, 0)],
    espera: [0.75, 6.45, 0.50]
  },
  {
    nome: "dois encostados — não há folga nenhuma a declarar",
    zonas: [z("A", 4, 4, -1.0, 0), z("B", 4, 4, 1.0, 0)],
    espera: []
  },
  {
    nome: "dois sobrepostos — é problema, não é folga",
    zonas: [z("A", 4, 4, -0.9, 0), z("B", 4, 4, 0.9, 0)],
    espera: [-0.2]
  },
  {
    // Quatro tiles de 500 mm são 2,00 m de zona, não 4 -- a primeira versão
    // deste caso esperava 0,5 m por eu ter contado tiles como metros, e o
    // teste acusou a app de um erro que era meu. Fica escrito porque é a
    // armadilha óbvia de quem olhar para estes números outra vez.
    nome: "duas filas — a de baixo não faz folga com as de cima",
    zonas: [z("cima esq", 4, 4, -2.0, 3.0), z("cima dir", 4, 4, 2.5, 3.0),
            z("baixo", 4, 4, 0, -3.0)],
    espera: [2.5]
  },
  {
    nome: "três tiras seguidas — cada uma mede à anterior, não à primeira",
    zonas: [z("t1", 2, 4, -3.0, 0), z("t2", 2, 4, 0, 0), z("t3", 2, 4, 3.0, 0)],
    espera: [2.0, 2.0]
  }
];

const { s, porta } = await servidor();
const { chromium } = await carregarPlaywright();
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM || "/opt/pw-browsers/chromium"
});

let falhas = 0;
const conferir = (ok, texto) => { console.log((ok ? "  ✓ " : "  ✗ ") + texto); if (!ok) falhas++; };
const num = (t) => parseFloat(String(t).replace(",", ".").replace(/[^\d.-]/g, ""));

for (const caso of CASOS) {
  const ctx = await browser.newContext({ viewport: { width: 1500, height: 1100 }, serviceWorkers: "block" });
  const pagina = await ctx.newPage();
  const erros = [];
  pagina.on("pageerror", (e) => erros.push(e.message));
  await pagina.goto(`http://127.0.0.1:${porta}/ecra-complexo.html`, { waitUntil: "networkidle" });
  await pagina.waitForFunction(() => typeof window.lzAddZone === "function", null, { timeout: 20000 });
  await pagina.waitForTimeout(500);

  await pagina.evaluate((zs) => {
    const lista = document.getElementById("lz-list");
    if (lista) lista.innerHTML = "";
    zs.forEach((x) => window.lzAddZone(x.name, x, false));
  }, caso.zonas);
  await pagina.waitForTimeout(1200);

  const visto = await pagina.evaluate(() => {
    const svg = document.getElementById("lz-diagram") || document.querySelector("#lz-diagram-wrap svg");
    return {
      noDesenho: svg ? [...svg.querySelectorAll("text")].map((t) => t.textContent)
        .filter((t) => /^-?[\d,]+ m$|^sobrepõe /.test(t)) : [],
      resumo: (document.getElementById("lz-sum") || {}).textContent || ""
    };
  });

  console.log("\n== " + caso.nome + " ==");
  console.log("   no desenho: " + JSON.stringify(visto.noDesenho));

  // 1. Os números do desenho são os que a geometria manda?
  const medidos = visto.noDesenho.map((t) => /sobrepõe/.test(t) ? -num(t) : num(t));
  const batem = medidos.length === caso.espera.length &&
    caso.espera.every((e, i) => Math.abs(medidos[i] - e) < 0.006);
  conferir(batem, "as folgas são " + JSON.stringify(caso.espera) +
    (batem ? "" : " mas o desenho diz " + JSON.stringify(medidos)));

  // 2. E o texto que se copia diz exactamente o mesmo?
  const linha = (visto.resumo.split("\n").find((l) => /^Folgas entre ecrãs:/.test(l)) || "");
  if (!caso.espera.length) {
    conferir(!linha, "sem folgas, o resumo não inventa uma linha para o dizer");
  } else {
    console.log("   no resumo:  " + linha);
    const noTexto = (linha.match(/-?[\d,]+ m/g) || []).map(num)
      .map((v, i) => /SOBREPÕEM/.test(linha.split("·")[i] || "") ? -v : v);
    const iguais = noTexto.length === caso.espera.length &&
      caso.espera.every((e, i) => Math.abs(noTexto[i] - e) < 0.006);
    conferir(iguais, "o resumo que se copia diz o MESMO que o desenho");
  }
  conferir(erros.length === 0, erros.length ? "erro de JavaScript: " + erros[0] : "sem erros de JavaScript");
  await ctx.close();
}

await browser.close();
s.close();
console.log("\n" + (falhas ? falhas + " FALHA(S)" : "As folgas estão medidas, e o desenho e o texto dizem o mesmo."));
process.exit(falhas ? 1 : 0);
