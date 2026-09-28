/**
 * O DSM É DO PROJETO — NÃO ANDA COLADO À APP.
 *
 * Reportado a olhar para a exportação de um projeto onde nunca tinha posto
 * nenhum: *"Dsm???"*. E ao medir, a causa não era um cálculo: era um
 * desencontro de regras dentro da mesma app.
 *
 * A calculadora ABRE LIMPA de propósito — não repõe as zonas guardadas, para
 * nenhum valor de arranque se confundir com o do projeto que se vai fazer
 * (é a `lzRestoreFromStorage()` que o `index.html` deixa comentada, e só o
 * `ecra-complexo.html` chama). Só que o DSM vivia numa chave à parte,
 * `calculadores-dsm-v1`, lida SEM passar por essa porta. Resultado: as zonas
 * abriam vazias e o DSM abria com o do dia anterior — e ia, caladinho, no
 * payload para o 3D e em cada projeto exportado.
 *
 * O pior nem é aparecer: é aparecer num sítio onde ninguém o pôs, num
 * material que se manda ao cliente. Uma peça a mais numa lista de carga é um
 * telefonema no dia da montagem.
 *
 * Este teste mede as três coisas que fecham isso:
 *
 *   1. a app abre limpa, DSM incluído (era aqui que falhava);
 *   2. abrir um projeto traz o DSM DESSE projeto — e um projeto sem DSM
 *      APAGA o que estava, em vez de o deixar ficar por inércia;
 *   3. o ecra-complexo.html, que é a bancada de trabalho e repõe as zonas,
 *      continua a repor também o DSM. Corrigir o arranque da calculadora não
 *      pode limpar a mesa a quem está a trabalhar na outra página.
 *
 *   node scripts/verificar-dsm-do-projeto.mjs
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
const ctx = await browser.newContext({ viewport: { width: 1400, height: 950 },
                                       serviceWorkers: "block", acceptDownloads: true });

let falhas = 0;
const conferir = (ok, texto) => { console.log((ok ? "  ✓ " : "  ✗ ") + texto); if (!ok) falhas++; };

const pagina = await ctx.newPage();
const erros = [];
pagina.on("pageerror", (e) => erros.push(e.message));

const abrirApp = async () => {
  await pagina.goto(`http://127.0.0.1:${porta}/index.html`, { waitUntil: "networkidle" });
  await pagina.waitForFunction(() => document.querySelectorAll("#l-model option").length > 3,
    null, { timeout: 20000 });
  await pagina.waitForTimeout(500);
};

/** O que a app tem à frente, e o que ela manda para o 3D. */
const estadoDoDsm = () => pagina.evaluate(() => {
  let paraOPreview = null;
  try {
    const bruto = localStorage.getItem("mikeapps-projeto-v1");
    if (bruto) paraOPreview = (JSON.parse(bruto) || {}).dsm;
  } catch (e) {}
  return {
    noEcraComplexo: (document.getElementById("lz-dsm-n") || {}).value,
    naAbaProjeto: (document.getElementById("proj-dsm-count") || {}).value,
    guardado: localStorage.getItem("calculadores-dsm-v1"),
    paraOPreview: paraOPreview
  };
});

// ---- 1. Um projeto com DSM, como quem trabalhou ontem -------------------
console.log("\n== ontem: um projeto com 4 DSM ==");
await abrirApp();
await pagina.evaluate(() => {
  const n = document.getElementById("lz-dsm-n");
  n.value = "4";
  n.dispatchEvent(new Event("input", { bubbles: true }));
});
await pagina.waitForTimeout(600);
console.log("   " + JSON.stringify(await estadoDoDsm()));

// ---- 2. Hoje: a app abre limpa. O DSM também? ---------------------------
//
// É AQUI QUE ISTO FALHAVA. As zonas abriam vazias, o DSM abria com o de
// ontem -- e seguia para o 3D e para cada projeto exportado.
console.log("\n== hoje: a app abre ==");
await abrirApp();
const aoAbrir = await estadoDoDsm();
console.log("   " + JSON.stringify(aoAbrir));
conferir(!(parseInt(aoAbrir.noEcraComplexo, 10) > 0),
  "a app abre SEM DSM nenhum — como abre sem zonas (era aqui que aparecia o de ontem)");

// E agora o caminho por onde ele o viu: carregar em "Ver em 3D"/"Sincronizar".
// A escrita automática está desligada por omissão, por isso o DSM de ontem
// ficava à espera, calado, até alguém mandar o projeto para o 3D -- e então
// ia junto. O ecrã do 3D é o sítio onde aparece uma peça que ninguém pôs.
// Com uma zona a sério, como num projeto de verdade: sem zona nenhuma o
// payload nem chega a existir, e o teste não veria o que interessa.
await pagina.evaluate(() => {
  window.lzAddZone("ecrã principal", {
    modelValue: "custom", tipo: "led", posMode: "center", sizeMode: "tiles",
    mw: "500", mh: "500", rx: "192", ry: "192", weight: "6.3", amp: "0.65",
    visible: true, mx: "12", my: "6", posX: "0", posY: "0"
  }, false);
});
await pagina.waitForTimeout(800);
await pagina.evaluate(() => {
  if (typeof window.lzForcarParaPreview === "function") window.lzForcarParaPreview();
  else document.getElementById("btSincronizarPreview").click();
});
await pagina.waitForTimeout(700);
const depoisDeSincronizar = await estadoDoDsm();
console.log("   depois de mandar para o 3D: " + JSON.stringify(depoisDeSincronizar.paraOPreview));
conferir(!depoisDeSincronizar.paraOPreview || !(depoisDeSincronizar.paraOPreview.n > 0),
  "e mandar para o 3D não leva o DSM de ontem à boleia — era assim que ele aparecia lá");

// ---- 3. Abrir um projeto traz o DSM DESSE projeto -----------------------
console.log("\n== abrir um projeto que TEM 2 DSM ==");
const comDsm = await pagina.evaluate(async () => {
  const estado = { _app: "calculadores-projeto", _v: 1, nome: "Com DSM",
                   projtype: "led", dsmCount: "2", dsmRes: "1920x1080" };
  const dt = new DataTransfer();
  dt.items.add(new File([JSON.stringify(estado)], "com-dsm.cal", { type: "application/json" }));
  const input = document.getElementById("proj-open-file");
  input.files = dt.files;
  input.dispatchEvent(new Event("change", { bubbles: true }));
  await new Promise((r) => setTimeout(r, 900));
  return true;
});
const depoisDeAbrir = await estadoDoDsm();
console.log("   " + JSON.stringify(depoisDeAbrir));
conferir(comDsm && depoisDeAbrir.naAbaProjeto === "2",
  "a aba Projeto fica com os 2 DSM do ficheiro");
conferir(parseInt(depoisDeAbrir.noEcraComplexo, 10) === 2,
  "e o Ecrã Complexo passa a ter esses 2 — o DSM segue o projeto que está aberto");

// ---- 4. E um projeto SEM DSM apaga o que lá estava ----------------------
//
// O caso que dá o "Dsm???": deixar ficar por inércia é o mesmo defeito, só
// que com o projeto anterior em vez do dia anterior.
console.log("\n== e agora abrir um projeto SEM DSM nenhum ==");
await pagina.evaluate(async () => {
  const estado = { _app: "calculadores-projeto", _v: 1, nome: "Sem DSM",
                   projtype: "led", dsmCount: "0" };
  const dt = new DataTransfer();
  dt.items.add(new File([JSON.stringify(estado)], "sem-dsm.cal", { type: "application/json" }));
  const input = document.getElementById("proj-open-file");
  input.files = dt.files;
  input.dispatchEvent(new Event("change", { bubbles: true }));
  await new Promise((r) => setTimeout(r, 900));
});
const semDsm = await estadoDoDsm();
console.log("   " + JSON.stringify(semDsm));
conferir(parseInt(semDsm.noEcraComplexo, 10) === 0,
  "um projeto sem DSM APAGA os do projeto anterior (não os herda em silêncio)");
conferir(!semDsm.paraOPreview || !(semDsm.paraOPreview.n > 0),
  "e o 3D também deixa de os receber");

// ---- 5. A bancada de trabalho não se limpa ------------------------------
//
// O ecra-complexo.html repõe as zonas guardadas ao abrir -- é a página onde
// se constrói o conjunto. Arranjar o arranque da calculadora não pode passar
// a limpar a mesa a quem está a meio de um trabalho ali.
console.log("\n== a janela solta continua a repor o que lá estava ==");
await pagina.goto(`http://127.0.0.1:${porta}/ecra-complexo.html`, { waitUntil: "networkidle" });
await pagina.waitForFunction(() => typeof window.lzAddZone === "function", null, { timeout: 20000 });
await pagina.evaluate(() => {
  const n = document.getElementById("lz-dsm-n");
  n.value = "3";
  n.dispatchEvent(new Event("input", { bubbles: true }));
});
await pagina.waitForTimeout(600);
await pagina.reload({ waitUntil: "networkidle" });
await pagina.waitForFunction(() => typeof window.lzAddZone === "function", null, { timeout: 20000 });
await pagina.waitForTimeout(800);
const naBancada = await pagina.evaluate(() => (document.getElementById("lz-dsm-n") || {}).value);
console.log("   depois de recarregar a janela solta: " + naBancada);
conferir(parseInt(naBancada, 10) === 3,
  "quem está a trabalhar na janela solta reencontra o DSM onde o deixou");

console.log("\n== a altura do ecrã ao chão vai para o 3D ==");
// Reparo dele, com uma foto do 3D: *"está a nascer assim quando vem da
// calculadora e nela não tenho onde dizer a que altura do chão está o ecrã"*.
// E não tinha: este alçado só sabe posições RELATIVAS entre zonas, não tem
// chão, e do outro lado só sobrava a altura do palco (1 m por omissão).
//
// O campo existe NAS DUAS janelas — a aba Ecrã Complexo e a janela solta.
// Faltar numa delas era corrigir metade do defeito: quem trabalhasse na
// outra continuava a mandar o projeto sem altura nenhuma.
const naJanelaSolta = await pagina.evaluate(() => !!document.getElementById("lz-base-chao"));
conferir(naJanelaSolta, "a janela solta tem o campo «Base do ecrã acima do chão»");

await pagina.goto(`http://127.0.0.1:${porta}/index.html`, { waitUntil: "networkidle" });
await pagina.evaluate(() => localStorage.setItem("mikeapps-sincronizacao-v1", JSON.stringify("ligada")));
await pagina.reload({ waitUntil: "networkidle" });
await pagina.waitForTimeout(1500);

const altura = await pagina.evaluate(async () => {
  document.getElementById("btMenuCompleta")?.click();
  await new Promise((r) => setTimeout(r, 400));
  document.querySelector('.tabs .tab[data-mode="zonas"]').click();
  await new Promise((r) => setTimeout(r, 700));
  const campo = document.getElementById("lz-base-chao");
  if (!campo) return { semCampo: true };
  document.getElementById("lz-add").click();
  await new Promise((r) => setTimeout(r, 900));
  const ler = () => {
    try { return (JSON.parse(localStorage.getItem("mikeapps-projeto-v1")) || {}).alturaDoChao; }
    catch (e) { return "(ponte ilegível)"; }
  };
  const por = async (v) => {
    campo.value = String(v);
    campo.dispatchEvent(new Event("input", { bubbles: true }));
    await new Promise((r) => setTimeout(r, 800));
    return ler();
  };
  return { semCampo: false, a24: await por(2.4), a0: await por(0),
           guardado: localStorage.getItem("calculadores-base-chao-v1") };
});
conferir(!altura.semCampo, "e a aba Ecrã Complexo também");
conferir(altura.a24 === 2.4, "2,4 m escritos chegam ao 3D como 2,4 (medido: " + altura.a24 + ")");
// Zero tem de viajar como zero: é o ecrã pousado no chão, não é "não sei".
// Com um `||` pelo caminho virava null, e o ecrã saltava para cima do palco.
conferir(altura.a0 === 0, "e o ZERO viaja como zero — é o ecrã no chão, não é «não sei»");
conferir(altura.guardado === "0", "a escolha fica guardada para a próxima vez");

// O MESMO NÚMERO, VISTO DE VÁRIOS SÍTIOS (v4.33). Reparo dele, com uma foto
// da aba Ecrã LED: o campo só existia na Ecrã Complexo, e quem trabalhasse
// na do LED mandava o ecrã para o 3D com o valor da outra -- 1 m por
// omissão -- sem ter onde o ver nem onde o mudar. A altura ia na mesma; era
// invisível, que é a pior maneira de um número estar certo.
const partilhado = await pagina.evaluate(async () => {
  const n = document.querySelectorAll(".lz-campo-base-chao").length;
  document.querySelector('.tabs .tab[data-mode="led"]').click();
  await new Promise((r) => setTimeout(r, 700));
  const noLed = document.getElementById("l-base-chao");
  if (!noLed) return { n, semCampoNoLed: true };
  noLed.value = "2.8";
  noLed.dispatchEvent(new Event("input", { bubbles: true }));
  await new Promise((r) => setTimeout(r, 900));
  const ler = () => {
    try { return (JSON.parse(localStorage.getItem("mikeapps-projeto-v1")) || {}).alturaDoChao; }
    catch (e) { return null; }
  };
  const depoisDoLed = { complexo: document.getElementById("lz-base-chao").value, ponte: ler() };
  // E ao contrário.
  const noComplexo = document.getElementById("lz-base-chao");
  noComplexo.value = "0";
  noComplexo.dispatchEvent(new Event("input", { bubbles: true }));
  await new Promise((r) => setTimeout(r, 900));
  return { n, semCampoNoLed: false, depoisDoLed,
           depoisDoComplexo: { led: noLed.value, ponte: ler() } };
});
conferir(!partilhado.semCampoNoLed, "a aba Ecrã LED também tem o campo da altura");
conferir(partilhado.n >= 2, "as caixas partilham a mesma classe (" + partilhado.n + ")");
conferir(partilhado.depoisDoLed.complexo === "2.8" && partilhado.depoisDoLed.ponte === 2.8,
  "escrever na do LED muda a da Ecrã Complexo e vai para o 3D (2,8)");
conferir(partilhado.depoisDoComplexo.led === "0" && partilhado.depoisDoComplexo.ponte === 0,
  "e ao contrário também — é um número só, visto de dois sítios");

conferir(erros.length === 0, erros.length ? "erro de JavaScript: " + erros[0] : "sem erros de JavaScript");

await browser.close();
s.close();
console.log("\n" + (falhas ? falhas + " FALHA(S)"
  : "O DSM é do projeto: não aparece onde ninguém o pôs, nem desaparece de onde foi posto."));
process.exit(falhas ? 1 : 0);
