/**
 * A FOTO ENCOLHE ANTES DE SAIR DAQUI?
 *
 * Porque é que existe: o mike tirou uma foto no telemóvel, carregou em
 * Analisar, e levou *"Erro: Imagem demasiado grande (máx. ~5MB)"*. O limite do
 * Worker é real (7 MB de base64, que são ~5,2 MB de ficheiro — o base64
 * engorda um terço), mas a app mandava a foto inteira como vinha da câmara.
 *
 * E mesmo quando cabia era desperdício: a documentação da API diz que o
 * escalão do modelo usado tem o lado maior limitado a 1568 px, e encolhe
 * qualquer coisa maior ANTES de olhar para ela. Mandar 12 megapixéis paga
 * upload no meio de um pavilhão e não compra fidelidade nenhuma.
 *
 * Isto intercepta o pedido ao Worker — nada sai desta máquina — e mede o que a
 * app IA mandar: o tamanho em base64, o tipo, e as dimensões da imagem que lá
 * vai dentro.
 *
 *   node scripts/verificar-foto-encolhe.mjs
 */

import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = fileURLToPath(new URL("..", import.meta.url));
const LADO_MAIOR_UTIL = 1568;   // o mesmo número do index.html
const LIMITE_DO_WORKER = 7 * 1024 * 1024;

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
 * O CONTRATO, que não é "encolher sempre":
 *
 *   1. a imagem chega ao pedido;
 *   2. cabe no limite do Worker;
 *   3. NUNCA sai maior do que entrou;
 *   4. se foi mexida, o lado maior não passa dos 1568 px e a proporção mantém-se;
 *   5. uma imagem pequena passa intacta, sem recomprimir.
 *
 * O ponto 3 é o que impede a asneira óbvia: um PNG nítido e leve convertido
 * para JPEG fica MAIOR e mais feio. Nesse caso a app fica com o original — foi
 * o que este teste apanhou à primeira corrida, e o que ele passa a fixar.
 */
const CASOS = [
  { nome: "foto de telemóvel, 4000×3000", w: 4000, h: 3000, tipo: "image/jpeg", intacta: false },
  { nome: "a mesma deitada, 3000×4000", w: 3000, h: 4000, tipo: "image/jpeg", intacta: false },
  { nome: "print de ecrã 1920×1080 (PNG leve)", w: 1920, h: 1080, tipo: "image/png", intacta: null },
  { nome: "esquema pequeno 800×600", w: 800, h: 600, tipo: "image/png", intacta: true }
];

const { s, porta } = await servidor();
const { chromium } = await carregarPlaywright();
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM || "/opt/pw-browsers/chromium"
});

let falhas = 0;
const conferir = (ok, texto) => { console.log((ok ? "  ✓ " : "  ✗ ") + texto); if (!ok) falhas++; };

for (const caso of CASOS) {
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 950 }, serviceWorkers: "block" });
  const pagina = await ctx.newPage();
  const erros = [];
  pagina.on("pageerror", (e) => erros.push(e.message));

  // O pedido ao Worker NÃO SAI DAQUI: responde-se no sítio, com uma resposta
  // com a forma certa, e guarda-se o corpo que a app ia mandar.
  let enviado = null;
  const espiados = [];
  await pagina.route("**/*", async (rota) => {
    const url = rota.request().url();
    if (/workers\.dev|assistente/.test(url) && rota.request().method() === "POST") {
      let corpo = {};
      try { corpo = JSON.parse(rota.request().postData() || "{}"); } catch (_) {}
      espiados.push({ url, chaves: Object.keys(corpo) });
      // A contagem de uso vai para o MESMO domínio, e chega primeiro: só o
      // pedido com texto/imagem/pdf é o do assistente.
      if ("imageBase64" in corpo || "pdfBase64" in corpo || "text" in corpo) enviado = corpo;
      await rota.fulfill({
        status: 200, contentType: "application/json",
        body: JSON.stringify({ requisitos: { resumo: "teste", tipoEcra: "desconhecido" } })
      });
      return;
    }
    await rota.continue();
  });

  await pagina.goto(`http://127.0.0.1:${porta}/index.html`, { waitUntil: "networkidle" });
  await pagina.waitForFunction(() => !!document.getElementById("asst-pdf"), null, { timeout: 20000 });
  await pagina.evaluate(() => document.querySelector('.tabs .tab[data-mode="assistente"]').click());
  await pagina.waitForTimeout(300);

  // Fabrica-se a imagem no browser e entrega-se ao input como um ficheiro a
  // sério — é o mesmo caminho de uma foto escolhida à mão.
  await pagina.evaluate(async (c) => {
    const cv = document.createElement("canvas");
    cv.width = c.w; cv.height = c.h;
    const ctx2 = cv.getContext("2d");
    // Ruído grosso para o JPEG não comprimir a foto toda para nada, que é o
    // que aconteceria com um rectângulo de cor lisa.
    for (let y = 0; y < c.h; y += 8) {
      for (let x = 0; x < c.w; x += 8) {
        ctx2.fillStyle = "rgb(" + ((x * 7) % 256) + "," + ((y * 13) % 256) + "," + ((x + y) % 256) + ")";
        ctx2.fillRect(x, y, 8, 8);
      }
    }
    const blob = await new Promise((r) => cv.toBlob(r, c.tipo, 0.92));
    const nome = c.tipo === "image/png" ? "teste.png" : "teste.jpg";
    const dt = new DataTransfer();
    dt.items.add(new File([blob], nome, { type: c.tipo }));
    const input = document.getElementById("asst-pdf");
    input.files = dt.files;
    input.dispatchEvent(new Event("change", { bubbles: true }));
    window.__tamanhoOriginal = blob.size;
  }, caso);
  await pagina.waitForTimeout(200);

  const original = await pagina.evaluate(() => window.__tamanhoOriginal);
  await pagina.evaluate(() => document.getElementById("asst-analyze").click());
  await pagina.waitForFunction(() => true, null, { timeout: 5000 });
  for (let i = 0; i < 60 && !enviado; i++) await pagina.waitForTimeout(250);

  console.log("\n== " + caso.nome + " ==  original " + Math.round(original / 1024) + " KB");
  if (!enviado) {
    conferir(false, "o pedido nunca chegou a ser feito — apanhados: " + JSON.stringify(espiados));
    await ctx.close(); continue;
  }
  if (erros.length) conferir(false, "erro de JavaScript: " + erros[0]);

  const b64 = enviado.imageBase64 || "";
  // O base64 leva "=" de enchimento no fim, e cada um vale um byte a menos.
  // Sem descontar isso, uma imagem que passou INTACTA parecia ter crescido dois
  // bytes — e o teste acusava a app de uma coisa que ela não fez.
  const enchimento = (b64.match(/=+$/) || [""])[0].length;
  const bytes = Math.max(0, (b64.length / 4) * 3 - enchimento);
  // As dimensões lidas da imagem que REALMENTE vai no pedido, não das que a
  // app diz ter feito.
  const dim = await pagina.evaluate((dados) => new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => resolve(null);
    img.src = "data:image/jpeg;base64," + dados;
  }), b64);

  console.log("   vai " + Math.round(bytes / 1024) + " KB" +
    (dim ? " · " + dim.w + "×" + dim.h + " px" : "") + " · " + enviado.imageMediaType);
  const mexida = !!dim && (dim.w !== caso.w || dim.h !== caso.h);
  conferir(!!b64, "a imagem segue no pedido");
  conferir(b64.length < LIMITE_DO_WORKER, "cabe no limite do Worker (" + Math.round(b64.length / 1024) + " KB de base64)");
  conferir(bytes <= original, "não saiu maior do que entrou (" +
    Math.round(original / 1024) + " → " + Math.round(bytes / 1024) + " KB)");
  if (mexida) {
    conferir(Math.max(dim.w, dim.h) <= LADO_MAIOR_UTIL,
      "mexida: o lado maior não passa dos " + LADO_MAIOR_UTIL + " px que o modelo lê");
    conferir(Math.abs((dim.w / dim.h) - (caso.w / caso.h)) < 0.01,
      "mexida: a proporção manteve-se (" + caso.w + "×" + caso.h + " → " + dim.w + "×" + dim.h + ")");
    conferir(enviado.imageMediaType === "image/jpeg", "mexida: vai como JPEG");
  } else {
    conferir(!!dim && dim.w === caso.w && dim.h === caso.h,
      "intacta, sem recomprimir (" + caso.w + "×" + caso.h + ")");
    conferir(enviado.imageMediaType === caso.tipo, "intacta: manteve o tipo " + caso.tipo);
  }
  if (caso.intacta === true) conferir(!mexida, "esta TEM de passar intacta — é pequena e nítida");
  if (caso.intacta === false) conferir(mexida, "esta TEM de ser encolhida — é uma foto de câmara");
  await ctx.close();
}

await browser.close();
s.close();
console.log("\n" + (falhas ? falhas + " FALHA(S)" : "A foto sai daqui do tamanho que serve."));
process.exit(falhas ? 1 : 0);
