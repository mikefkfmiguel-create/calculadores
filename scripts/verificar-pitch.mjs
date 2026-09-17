/**
 * O PITCH QUE A APP ESCREVE TEM DE EXISTIR NO PAINEL.
 *
 * A app mostrava sempre a MÉDIA dos dois eixos. Num painel normal ninguém dá
 * por isso — os dois são iguais, a média é o mesmo número. Mas o Traulux
 * transparente é 3,91 mm na horizontal e 7,81 mm na vertical (de propósito: é
 * isso que o deixa transparente), e a app escrevia:
 *
 *     Pixel pitch: 5,86 mm
 *
 * Um valor que não está na ficha do fabricante nem se mede em lado nenhum
 * daquele painel — com ar de especificação, e pronto a ser copiado para um
 * email ou uma ficha técnica. O aviso ao lado já dizia a verdade, mas quem
 * copia o resumo leva o número, não o aviso.
 *
 * Este teste anda por vários sítios porque o mesmo número aparece em vários,
 * e o defeito de sempre é dizerem coisas diferentes: a aba LED, a aba
 * Projeto, a aba Blending, e o texto que se copia de cada uma. E confirma o
 * principal — que num painel normal nada disto muda nada.
 *
 * A aba Blending leva o mesmo tratamento mas com a RÉGUA DELA. Ali o "pixel
 * size" não é a ficha de um painel: sai de uma divisão entre os metros e os
 * píxeis de uma imagem projetada, onde uns décimos de diferença são o normal
 * de qualquer conta com casas decimais. A pergunta não é "são iguais?" mas
 * "a imagem está esticada?", e a resposta é a que o aviso já dava: mais de
 * 5%. Aplicar-lhe a régua do painel (0,01 mm) punha a app a escrever dois
 * valores sem aviso nenhum a explicá-los — o mesmo desencontro, ao contrário.
 * Por isso o caso que este teste mais guarda ali é o que NÃO pode mudar.
 *
 *   node scripts/verificar-pitch.mjs
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
const ctx = await browser.newContext({ viewport: { width: 1400, height: 950 }, serviceWorkers: "block" });

let falhas = 0;
const conferir = (ok, texto) => { console.log((ok ? "  ✓ " : "  ✗ ") + texto); if (!ok) falhas++; };

const pagina = await ctx.newPage();
const erros = [];
pagina.on("pageerror", (e) => erros.push(e.message));
await pagina.goto(`http://127.0.0.1:${porta}/index.html`, { waitUntil: "networkidle" });
await pagina.waitForFunction(() => document.querySelectorAll("#l-model option").length > 3,
  null, { timeout: 20000 });
await pagina.waitForTimeout(500);

/** Escolhe um modelo pelo nome, na aba LED, e lê o que a app diz. */
const naAbaLed = (procura) => pagina.evaluate(async (procura) => {
  document.querySelector('.tabs .tab[data-mode="led"]').click();
  const sel = document.getElementById("l-model");
  const op = [...sel.options].find((o) => o.textContent.includes(procura));
  if (!op) return { erro: "modelo não encontrado: " + procura };
  sel.value = op.value;
  sel.dispatchEvent(new Event("change", { bubbles: true }));
  await new Promise((r) => setTimeout(r, 600));
  const aviso = document.getElementById("l-warn");
  return {
    modelo: op.textContent,
    noEcra: (document.getElementById("l-out-pitch") || {}).textContent || "",
    aviso: aviso && aviso.style.display !== "none" ? aviso.textContent : "",
    resumo: (document.getElementById("l-sum") || {}).textContent || ""
  };
}, procura);

// ---- 1. O painel que deu origem a isto ----------------------------------
console.log("\n== Traulux transparente: 3,91 na horizontal, 7,81 na vertical ==");
const traulux = await naAbaLed("Traulux Transparente");
console.log("   modelo:  " + traulux.modelo);
console.log("   no ecrã: " + traulux.noEcra);
conferir(!traulux.erro, traulux.erro || "o modelo está no catálogo");
conferir(!/5,86/.test(traulux.noEcra),
  "o ecrã NÃO escreve 5,86 mm — a média não existe naquele painel");
conferir(/3,91/.test(traulux.noEcra) && /7,81/.test(traulux.noEcra),
  "escreve os dois pitches reais: " + traulux.noEcra);

const linhaPitch = (traulux.resumo.split("\n").find((l) => /^Pixel pitch:/.test(l)) || "");
console.log("   no resumo que se copia: " + linhaPitch);
conferir(!/5,86/.test(linhaPitch) && /3,91/.test(linhaPitch) && /7,81/.test(linhaPitch),
  "e o texto que se copia leva os mesmos dois — é o que vai parar a um email");

console.log("   aviso: " + traulux.aviso.slice(0, 80));
conferir(/assimétrico/i.test(traulux.aviso),
  "o aviso continua a explicar que é assim que o painel é feito");

// ---- 2. Um painel normal não muda nada ----------------------------------
//
// É o que garante que isto não estragou os 36 modelos onde estava bem.
console.log("\n== um painel normal (os dois eixos iguais) ==");
const normal = await naAbaLed("YESTECH MG6S P3.91");
console.log("   no ecrã: " + normal.noEcra);
conferir(/3,91/.test(normal.noEcra) && !/×/.test(normal.noEcra),
  "um pitch só, sem o «×» — num painel normal nada disto se nota");
conferir(!normal.aviso, "e sem aviso nenhum");

// ---- 3. A aba Projeto diz o MESMO ----------------------------------------
//
// O mesmo painel em dois sítios da app: o defeito clássico é ficarem a dizer
// coisas diferentes, e quem lê nunca saber qual das duas acreditar.
console.log("\n== o mesmo painel, na aba Projeto ==");
const noProjeto = await pagina.evaluate(async () => {
  document.querySelector('.tabs .tab[data-mode="projeto"]').click();
  await new Promise((r) => setTimeout(r, 300));
  const seg = document.querySelector('#proj-type-seg .seg-btn[data-projtype="led"]');
  if (seg) seg.click();
  const sel = document.getElementById("proj-led-model");
  const op = [...sel.options].find((o) => o.textContent.includes("Traulux Transparente"));
  if (!op) return { erro: "modelo não está na lista da aba Projeto" };
  sel.value = op.value;
  sel.dispatchEvent(new Event("change", { bubbles: true }));
  await new Promise((r) => setTimeout(r, 800));
  return {
    noEcra: (document.getElementById("proj-out-pitch") || {}).textContent || "",
    resumo: (document.getElementById("proj-sum") || {}).textContent || ""
  };
});
console.log("   no ecrã: " + JSON.stringify(noProjeto.noEcra));
conferir(!noProjeto.erro, noProjeto.erro || "o modelo também está na aba Projeto");
conferir(!/5,86/.test(noProjeto.noEcra) &&
         /3,91/.test(noProjeto.noEcra) && /7,81/.test(noProjeto.noEcra),
  "a aba Projeto diz exactamente o mesmo que a aba LED");

const linhaProj = (noProjeto.resumo.split("\n").find((l) => /^Pixel pitch:/.test(l)) || "");
if (linhaProj) {
  console.log("   no resumo do projeto: " + linhaProj);
  conferir(!/5,86/.test(linhaProj), "e o resumo do projeto também não inventa a média");
}

// ---- 4. A regra vive num sítio só ---------------------------------------
console.log("\n== a regra, sozinha ==");
const regra = await pagina.evaluate(() => ({
  iguais: pitchTexto(3.91, 3.91),
  diferentes: pitchTexto(3.91, 7.81),
  quaseIguais: pitchTexto(3.91, 3.915),   // arredondamento não é divergência
  vazio: pitchTexto(NaN, NaN),
  tolerancia: typeof PITCH_IGUAIS_ATE_MM === "number"
}));
console.log("   " + JSON.stringify(regra));
conferir(regra.iguais === "3,91", "dois eixos iguais → um número só");
conferir(regra.diferentes === "3,91 × 7,81", "dois eixos diferentes → os dois");
conferir(regra.quaseIguais === "3,91",
  "meio milésimo de arredondamento não é um painel assimétrico");
conferir(regra.vazio === "—", "com os campos vazios não inventa um número");
conferir(regra.tolerancia,
  "e a tolerância é a mesma do aviso, para os dois nunca poderem discordar");

// ---- 5. A aba Blending, com a régua DELA ---------------------------------
//
// Aqui o "pixel size" não é a ficha de um painel: sai de uma divisão entre os
// metros e os píxeis de uma imagem projetada, onde uns décimos de diferença
// são o normal de qualquer conta com casas decimais. A pergunta não é "são
// iguais?" mas "a imagem está esticada?", e a resposta é a que o aviso já
// dava: mais de 5%.
//
// Por isso este bloco mede sobretudo O CASO QUE NÃO PODE MUDAR -- uma
// divergência pequena, sem aviso, tem de continuar a mostrar um número só.
// Aplicar aqui a régua do painel (0,01 mm) punha a app a escrever dois
// valores em silêncio, sem aviso nenhum a explicá-los: o mesmo desencontro,
// ao contrário.
console.log("\n== a aba Blending ==");
const noBlending = (largura, altura) => pagina.evaluate(async ([w, h]) => {
  document.querySelector('.tabs .tab[data-mode="blend"]').click();
  await new Promise((r) => setTimeout(r, 250));
  const por = (id, v) => { const el = document.getElementById(id);
    el.value = String(v); el.dispatchEvent(new Event("input", { bubbles: true })); };
  por("b-w", w); por("b-h", h);
  await new Promise((r) => setTimeout(r, 700));
  const aviso = document.getElementById("b-warn");
  return {
    noEcra: (document.getElementById("b-out-pitch") || {}).textContent || "",
    aviso: aviso && aviso.style.display !== "none" ? aviso.textContent : "",
    resumo: (document.getElementById("b-sum") || {}).textContent || ""
  };
}, [largura, altura]);

const normalBlend = await noBlending(12.9, 4.3);
console.log("   16:9-ish (12,9 × 4,3 m): " + normalBlend.noEcra +
  (normalBlend.aviso ? "  [com aviso]" : "  [sem aviso]"));
const temDoisNumeros = (t) => /×/.test(t);
conferir(!(temDoisNumeros(normalBlend.noEcra) && !/esticada/.test(normalBlend.aviso)),
  "sem aviso de imagem esticada, o número é UM só — o ecrã e o aviso não se contradizem");

// E agora uma proporção mal metida de propósito: altura a mais para a
// resolução que sai. Aí o aviso aparece, e os dois números com ele.
const esticado = await noBlending(12.9, 8.6);
console.log("   esticado (12,9 × 8,6 m):  " + esticado.noEcra +
  (esticado.aviso ? "  [com aviso]" : "  [sem aviso]"));
if (/esticada/.test(esticado.aviso)) {
  conferir(temDoisNumeros(esticado.noEcra),
    "com a imagem esticada, mostra os dois: " + esticado.noEcra);
  conferir(/mm na horizontal/.test(esticado.aviso),
    "e o aviso diz quanto fica cada um, em vez de só dizer que não bate");
  const linhaBlend = (esticado.resumo.split("\n").find((l) => /^Pixel size:/.test(l)) || "");
  console.log("   no resumo: " + linhaBlend);
  conferir(temDoisNumeros(linhaBlend),
    "e o texto que se copia leva os dois — é o que vai para a ficha da obra");
} else {
  console.log("   (esta configuração não dispara o aviso; fica só a verificação de cima)");
}

// ---- 6. As duas réguas são MESMO diferentes ------------------------------
console.log("\n== cada aba com a sua régua ==");
const reguas = await pagina.evaluate(() => ({
  // 2,60 vs 2,64 mm: 1,5% -- num painel seriam dois pitches, numa imagem
  // projetada é arredondamento e não se diz nada.
  painel: pitchTexto(2.60, 2.64),
  imagem: pitchTexto(2.60, 2.64, pitchImagemIguais(2.60, 2.64)),
  imagemEsticada: pitchTexto(2.60, 3.40, pitchImagemIguais(2.60, 3.40))
}));
console.log("   " + JSON.stringify(reguas));
conferir(reguas.painel === "2,60 × 2,64",
  "na ficha de um painel, 2,60 e 2,64 são dois pitches diferentes");
conferir(reguas.imagem === "2,60",
  "na imagem projetada, os mesmos 2,60 e 2,64 são a mesma coisa (1,5% é arredondamento)");
conferir(reguas.imagemEsticada === "2,60 × 3,40",
  "mas 2,60 contra 3,40 já é imagem esticada, e diz-se");

conferir(erros.length === 0, erros.length ? "erro de JavaScript: " + erros[0] : "sem erros de JavaScript");

await browser.close();
s.close();
console.log("\n" + (falhas ? falhas + " FALHA(S)"
  : "O pitch que a app escreve é o que existe no painel."));
process.exit(falhas ? 1 : 0);
