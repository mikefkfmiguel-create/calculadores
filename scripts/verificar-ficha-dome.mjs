/**
 * A FICHA DA CÚPULA: o mesmo texto de sempre, e a mesma coisa em pares.
 *
 * Porque é que existe: o resumo da aba Dome passou a ser construído a partir
 * de uma lista de pares (rótulo, valor), para que a ponte para o Preview possa
 * levar exactamente os MESMOS valores sem ninguém os recalcular do outro lado
 * — que é a regra da casa ("a conta faz-se uma vez, no sítio onde ela vive").
 *
 * O risco dessa mudança é um só e é grande: o texto que o mike lê e copia todos
 * os dias mudar sem ninguém dar por isso. Por isso este teste não olha para o
 * bonito — compara o resumo **caracter a caracter** com o que ficou gravado em
 * scripts/ficha-dome-esperado.json, e falha à primeira vírgula diferente.
 *
 *   node scripts/verificar-ficha-dome.mjs            # confere
 *   node scripts/verificar-ficha-dome.mjs --gravar   # regrava a referência
 *
 * Regravar é uma decisão: só se faz quando a mudança no texto foi pedida.
 */

import { createServer } from "node:http";
import { readFile, writeFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = fileURLToPath(new URL("..", import.meta.url));
const REFERENCIA = join(RAIZ, "scripts", "ficha-dome-esperado.json");
const GRAVAR = process.argv.includes("--gravar");

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

/**
 * Casos escolhidos pelos RAMOS do texto, não por serem bonitos: com lente e
 * sem lente, com ganho e sem ganho, meia-esfera e calota, fisheye truncado, e
 * o aproveitamento impossível. Cada um acende linhas que os outros não acendem.
 */
const CASOS = [
  { nome: "a cúpula do mike — 8,7 m, 4 em anel, sem ganho",
    campos: { diam: 8.7, forma: "meia", qtd: 4, colocacao: "anel", "alt-mont": 1.5,
              atravessa: 3, "px-h": 1920, "px-v": 1200, lumens: 12000, blend: 15, alvo: 3 } },
  { nome: "a mesma, com o ganho da superfície",
    campos: { diam: 8.7, forma: "meia", qtd: 4, colocacao: "anel", "alt-mont": 1.5,
              atravessa: 3, "px-h": 1920, "px-v": 1200, lumens: 12000, blend: 15, alvo: 3, ganho: 0.4 } },
  { nome: "calota baixa, seis máquinas com zénite",
    campos: { diam: 12, forma: "calota", altura: 4, qtd: 6, colocacao: "anel-zenite",
              "alt-mont": 2.5, atravessa: 2, "px-h": 3840, "px-v": 2400, lumens: 20000, blend: 20, alvo: 3 } },
  { nome: "sem lúmenes — a luz cala-se",
    campos: { diam: 10, forma: "meia", qtd: 4, colocacao: "anel", atravessa: 3,
              "px-h": 1920, "px-v": 1200, lumens: 0, blend: 15, alvo: 3 } },
  { nome: "fisheye truncado",
    campos: { diam: 12, forma: "meia", qtd: 1, colocacao: "centro", atravessa: 1,
              "px-h": 3840, "px-v": 2160, lumens: 20000, blend: 0, alvo: 3, truncar: true } },
  { nome: "alvo apertado — aproveitamento no limite",
    campos: { diam: 20, forma: "meia", qtd: 4, colocacao: "anel", atravessa: 3,
              "px-h": 1920, "px-v": 1200, lumens: 12000, blend: 25, alvo: 1 } }
];

const { s, porta } = await servidor();
const { chromium } = await carregarPlaywright();
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM || "/opt/pw-browsers/chromium"
});
const ctx = await browser.newContext({ viewport: { width: 1400, height: 950 } });
const pagina = await ctx.newPage();
const errosDaPagina = [];
pagina.on("pageerror", (e) => errosDaPagina.push(e.message));

await pagina.goto(`http://127.0.0.1:${porta}/index.html`);
await pagina.waitForFunction(() => !!document.getElementById("dome-diam"), null, { timeout: 20000 });
// O catálogo de projetores chega assíncrono; sem ele o modelo não se escolhe.
await pagina.waitForTimeout(1500);

const obtidos = {};
for (const caso of CASOS) {
  await pagina.evaluate((campos) => {
    const set = (id, v) => {
      const el = document.getElementById("dome-" + id);
      if (!el) return;
      if (el.type === "checkbox") { el.checked = !!v; }
      else { el.value = String(v); }
      el.dispatchEvent(new Event(el.tagName === "SELECT" || el.type === "checkbox" ? "change" : "input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    };
    // Limpar os que não vêm no caso, para um caso não herdar do anterior.
    for (const id of ["ganho", "alt-mont", "raio-mont", "angulo", "prof"]) {
      const el = document.getElementById("dome-" + id);
      if (el) { el.value = ""; el.dispatchEvent(new Event("input", { bubbles: true })); }
    }
    const t = document.getElementById("dome-truncar");
    if (t && t.checked) { t.checked = false; t.dispatchEvent(new Event("change", { bubbles: true })); }
    for (const [id, v] of Object.entries(campos)) set(id, v);
  }, caso.campos);
  await pagina.waitForTimeout(500);

  obtidos[caso.nome] = await pagina.evaluate(() => {
    const sum = document.getElementById("dome-sum");
    const ficha = (typeof window.lzDomeFicha === "function") ? window.lzDomeFicha() : null;
    return { resumo: sum ? sum.textContent : "", ficha: ficha };
  });
}

await browser.close();
s.close();

if (errosDaPagina.length) {
  console.log("✗ erro de JavaScript na página: " + errosDaPagina[0]);
  process.exit(1);
}

if (GRAVAR) {
  await writeFile(REFERENCIA, JSON.stringify(obtidos, null, 2) + "\n", "utf8");
  console.log("Referência gravada: " + Object.keys(obtidos).length + " casos.");
  process.exit(0);
}

let esperado = null;
try { esperado = JSON.parse(await readFile(REFERENCIA, "utf8")); } catch (_) {
  console.log("Não há referência ainda. Corre com --gravar depois de confirmares o texto à mão.");
  process.exit(2);
}

let falhas = 0;
for (const caso of CASOS) {
  const a = (esperado[caso.nome] || {}).resumo || "";
  const b = (obtidos[caso.nome] || {}).resumo || "";
  if (a === b) {
    // E a ficha tem de dizer o MESMO que o resumo: cada par dela aparece lá.
    const ficha = (obtidos[caso.nome] || {}).ficha;
    const soltos = Array.isArray(ficha)
      ? ficha.filter(([k, v]) => b.indexOf(k + ": " + v) === -1)
      : null;
    if (!Array.isArray(ficha)) {
      falhas++; console.log(`✗ ${caso.nome}\n    a ficha não existe — lzDomeFicha() não devolveu uma lista`);
    } else if (!ficha.length) {
      falhas++; console.log(`✗ ${caso.nome}\n    a ficha veio vazia`);
    } else if (soltos.length) {
      falhas++;
      console.log(`✗ ${caso.nome}\n    a ficha diz coisa diferente do resumo, em ${soltos.length}:`);
      soltos.slice(0, 3).forEach(([k, v]) => console.log(`      "${k}: ${v}"`));
    } else {
      console.log(`✓ ${caso.nome}  (${ficha.length} linhas na ficha)`);
    }
  } else {
    falhas++;
    console.log(`✗ ${caso.nome} — o resumo MUDOU`);
    const la = a.split("\n"), lb = b.split("\n");
    for (let i = 0; i < Math.max(la.length, lb.length); i++) {
      if (la[i] !== lb[i]) {
        console.log(`    linha ${i + 1}\n      antes: ${JSON.stringify(la[i])}\n      agora: ${JSON.stringify(lb[i])}`);
      }
    }
  }
}

if (falhas) {
  console.log(`\n${falhas} ${falhas === 1 ? "caso falhou" : "casos falharam"}.`);
  process.exit(1);
}
console.log("\nO resumo da cúpula está igual ao caracter, e a ficha diz o mesmo que ele.");
