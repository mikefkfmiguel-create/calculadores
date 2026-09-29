/**
 * VÁRIOS ECRÃS DE PROJEÇÃO NO MESMO PROJETO.
 *
 * Pedido dele: *"preciso poder adicionar mais ecrãs de projeção e projetores
 * neste projeto"*.
 *
 * A regra que está escrita na ajuda desta aba — *"um projeto só tem um tipo de
 * ecrã de cada vez"* — continua verdadeira para o ecrã que se está a EDITAR.
 * O que muda é que os anteriores deixam de se perder: guardam-se, o relatório
 * sai com todos, viajam no ficheiro do projeto e chegam ao 3D, que os desenha
 * lado a lado desde a v4.00 do Preview.
 *
 * Três coisas medidas aqui:
 *
 *   1. guardar um ecrã põe-no no relatório, sem apagar o que está nos campos;
 *   2. os ecrãs guardados viajam na ponte do projetor, cada um com as suas
 *      máquinas e o seu rácio;
 *   3. "Limpar projeto" limpa-os — são trabalho deste projeto, não do próximo.
 *
 *   node scripts/verificar-varios-ecras.mjs
 */

import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { Buffer } from "node:buffer";
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
const ctx = await browser.newContext({ viewport: { width: 1400, height: 950 }, serviceWorkers: "block", acceptDownloads: true });

let falhas = 0;
const conferir = (ok, texto) => { console.log((ok ? "  ✓ " : "  ✗ ") + texto); if (!ok) falhas++; };

const pagina = await ctx.newPage();
const erros = [];
pagina.on("pageerror", (e) => erros.push(e.message));

await pagina.goto(`http://127.0.0.1:${porta}/index.html`, { waitUntil: "networkidle" });
await pagina.evaluate(() => {
  localStorage.clear();
  localStorage.setItem("mikeapps-sincronizacao-v1", JSON.stringify("ligada"));
});
await pagina.reload({ waitUntil: "networkidle" });
await pagina.waitForTimeout(900);
await pagina.evaluate(() => { const b = document.getElementById("btMenuCompleta"); if (b) b.click(); });
await pagina.waitForTimeout(400);

// A ponte tem de existir antes: é nela que os ecrãs guardados viajam, e é a
// aba Distância de Projeção que a escreve.
await pagina.evaluate(() => {
  const t = document.querySelector('.tabs .tab[data-mode="projecao"]'); if (t) t.click();
});
await pagina.waitForTimeout(700);
await pagina.evaluate(async () => {
  const add = document.getElementById("p-addproject");
  if (add && !add.checked) add.click();
  await new Promise((r) => setTimeout(r, 1200));
});

await pagina.evaluate(() => {
  const t = document.querySelector('.tabs .tab[data-mode="projeto"]'); if (t) t.click();
});
await pagina.waitForTimeout(700);

const põe = (id, v) => pagina.evaluate((a) => {
  const e = document.getElementById(a[0]); if (!e) return;
  e.value = String(a[1]);
  e.dispatchEvent(new Event("input", { bubbles: true }));
  e.dispatchEvent(new Event("change", { bubbles: true }));
}, [id, v]);
const abrirAba = async (modo) => {
  await pagina.evaluate((m) => {
    const t = document.querySelector('.tabs .tab[data-mode="' + m + '"]'); if (t) t.click();
  }, modo);
  await pagina.waitForTimeout(700);
};
const seg = (c, a, v) => pagina.evaluate((x) => {
  const b = document.querySelector("#" + x[0] + ' .seg-btn[data-' + x[1] + '="' + x[2] + '"]');
  if (b) b.click();
}, [c, a, v]);

await seg("proj-type-seg", "projtype", "projecao");
await pagina.waitForTimeout(500);
await seg("proj-sizemode-seg", "sizemode", "height");
await pagina.waitForTimeout(400);

async function porEcra(w, h, dist) {
  await põe("proj-proj-w", w); await põe("proj-proj-h", h); await põe("proj-proj-dist", dist);
  await pagina.waitForTimeout(800);
}
const guardar = () => pagina.evaluate(async () => {
  document.getElementById("proj-guardar-ecra").click();
  await new Promise((r) => setTimeout(r, 900));
});
const medir = () => pagina.evaluate(() => {
  const t = document.getElementById("proj-sum").textContent;
  const bruto = localStorage.getItem("mikeapps-projetor-v1");
  const j = bruto ? JSON.parse(bruto) : null;
  return {
    seccao: /MAIS ECRÃS DE PROJEÇÃO/.test(t),
    linhas: (t.match(/\[Ecrã \d\][^\n]*/g) || []),
    naLista: document.querySelectorAll("#proj-ecras-lista button").length,
    naPonte: (j && Array.isArray(j.projecoesExtra)) ? j.projecoesExtra.length : null,
    ecras: (j && j.projecoesExtra) || [],
    campoW: document.getElementById("proj-proj-w").value
  };
});

console.log("\n== guardar um ecrã e começar outro ==");

await porEcra(6, 3.4, 9);
await guardar();
const um = await medir();
conferir(um.seccao && um.linhas.length === 1,
  "o ecrã guardado entra no relatório (" + (um.linhas[0] || "nada") + ")");
conferir(um.campoW === "6",
  "e os campos NÃO se apagam — o rácio e a distância repetem-se de uma tela para a outra (" + um.campoW + " m)");
conferir(um.naLista === 2, "com botões para editar e remover (" + um.naLista + ")");
conferir(um.naPonte === 1, "e viaja na ponte do projetor (" + um.naPonte + ")");

await porEcra(12, 6.8, 14);
await guardar();
await porEcra(4, 2.25, 6);
const tres = await medir();
conferir(tres.linhas.length === 2,
  "dois guardados mais o que está nos campos, e o relatório diz os dois (" +
  tres.linhas.length + ")");
conferir(tres.naPonte === 2, "os dois na ponte (" + tres.naPonte + ")");

console.log("\n== o que vai na ponte é uma projeção inteira ==");

const e1 = tres.ecras[0] || {};
conferir(e1.racio > 0 && e1.distancia > 0,
  "cada ecrã leva rácio e distância (" + e1.racio + ":1 a " + e1.distancia + " m)");
conferir(Math.abs(e1.racio - 9 / 6) < 0.01,
  "e o rácio é o que a lente tem de cobrir: distância ÷ largura (" + e1.racio + ")");
conferir(Array.isArray(e1.maquinas),
  "com a lista de máquinas, mesmo quando é uma só (" + (e1.maquinas || []).length + " além da primeira)");
conferir(e1.curva === null && e1.ligada === true,
  "na forma que o Preview desenha desde a v4.00");
// "Blend 1x1" não é um blend: é uma máquina só, e dizer o contrário na ficha
// técnica mandava alguém levar equipamento a mais para a obra.
conferir(!/Blend 1x1/.test(tres.linhas.join(" ")),
  "e um blend de uma máquina só não se chama blend");

console.log("\n== e sobrevivem ao ficheiro do projeto ==");

// A promessa que interessa: um evento com três telas tem de REABRIR com as
// três. Guarda-se o projeto, limpam-se os ecrãs à mão, e abre-se outra vez.
const [descarga] = await Promise.all([
  pagina.waitForEvent("download", { timeout: 15000 }),
  pagina.evaluate(() => document.getElementById("proj-save").click())
]);
const ficheiro = await readFile(await descarga.path(), "utf8");
const guardado = JSON.parse(ficheiro);
conferir(Array.isArray(guardado.ecrasProjecao) && guardado.ecrasProjecao.length === 2,
  "o ficheiro do projeto leva os dois ecrãs (" +
  (guardado.ecrasProjecao || []).length + ")");
conferir(guardado.ecrasProjecao && guardado.ecrasProjecao[0] &&
         guardado.ecrasProjecao[0].carga && guardado.ecrasProjecao[0].campos,
  "cada um com os campos (para voltar a mexer-lhe) e a carga (para o 3D)");

// Um de cada vez, voltando a procurar o botão: a lista redesenha-se a cada
// remoção, e clicar em dois botões da lista ANTIGA é clicar num que já não
// existe. (Foi o que o teste fez à primeira, e ficou um por remover.)
for (let i = 0; i < 2; i++) {
  await pagina.evaluate(async () => {
    const b = Array.from(document.querySelectorAll("#proj-ecras-lista button"))
      .find((x) => x.textContent === "remover");
    if (b) b.click();
    await new Promise((r) => setTimeout(r, 900));
  });
}
const vazio = await medir();
conferir(vazio.linhas.length === 0, "removidos à mão, o relatório fica sem eles (" + vazio.linhas.length + ")");

await pagina.setInputFiles("#proj-open-file", {
  name: "projeto.cal", mimeType: "application/json", buffer: Buffer.from(ficheiro, "utf8")
});
await pagina.waitForTimeout(2500);
const reaberto = await medir();
conferir(reaberto.linhas.length === 2,
  "abrir o ficheiro traz os dois de volta (" + reaberto.linhas.length + ")");
conferir(reaberto.naPonte === 2,
  "e volta a mandá-los para o 3D sem ninguém ter de carregar em mais nada (" + reaberto.naPonte + ")");

console.log("\n== editar um ecrã não baralha a ordem dos outros ==");

// Pedido dele: *"devia poder adicionar mais que um ecrã de projeção sem ser
// com o guardar, que parece estar a dar asneira"*.
//
// A asneira era esta: "editar" TROCAVA o ecrã que estava nos campos com o que
// se ia editar, e os dois mudavam de lugar na lista. Com três ecrãs, cada
// clique baralhava a ordem, e quem estava a somar telas via-as a saltar.
//
// Agora cada um tem o seu lugar: o que sai dos campos volta ao lugar dele, e
// o escolhido vem para os campos. Nada troca de posição.
await porEcra(20, 11.25, 24);
await guardar();                       // Ecrã 4
await pagina.waitForTimeout(700);
const ordemAntes = await pagina.evaluate(() =>
  Array.from(document.querySelectorAll("#proj-ecras-lista span")).map((s) => s.textContent.trim()));

await pagina.evaluate(async () => {
  const b = Array.from(document.querySelectorAll("#proj-ecras-lista button"))
    .filter((x) => x.textContent === "editar")[0];
  if (b) b.click();
  await new Promise((r) => setTimeout(r, 1200));
});
const ordemDepois = await pagina.evaluate(() =>
  Array.from(document.querySelectorAll("#proj-ecras-lista span")).map((s) => s.textContent.trim()));

// A lista pode CRESCER: quando os campos tinham um ecrã que ainda não estava
// nela, editar outro tem de o arrumar, e arrumá-lo é acrescentá-lo. O que não
// pode é perder-se nenhum nem trocarem de posição — foi o teste que começou
// por medir a coisa errada aqui.
conferir(ordemDepois.length >= ordemAntes.length,
  "editar não perde ecrãs (" + ordemAntes.length + " → " + ordemDepois.length + ")");
conferir(ordemAntes.every((x, i) => x.split("·")[1] === ordemDepois[i].split("·")[1]),
  "E NENHUM DOS QUE LÁ ESTAVAM TROCA DE LUGAR — era isto que baralhava a lista a cada clique");
conferir(/nos campos/.test(ordemDepois.join(" ")),
  "e a lista diz qual deles está nos campos, para se saber onde se está a mexer");

const depoisDeEditar = await pagina.evaluate(async () => {
  document.getElementById("proj-guardar-ecra").click();
  await new Promise((r) => setTimeout(r, 1100));
  return document.querySelectorAll("#proj-ecras-lista button").length / 2;
});
conferir(depoisDeEditar === ordemDepois.length,
  "e acrescentar a seguir a editar não duplica o que já lá estava (" +
  depoisDeEditar + " ecrãs)");

console.log("\n== um ecrã sem altura não inventa projetores ==");

// Reparo dele: *"continua a fazer asneira"*, com a Altura do ecrã a 0.
//
// Medido: a ficha escrevia "Ecrã: 36,00 x 0,00 m (—)" e logo a seguir
// "Nº de projetores: Infinity x 1 = —". A largura de cada projetor sai da
// ALTURA da fila (altura x formato); com altura 0 dá 0, e Math.ceil(36 / 0)
// é Infinity. Daí para baixo a ficha enchia-se de travessões, o "Guardar
// este ecrã" não guardava nada, e nada dizia o que faltava.
await seg("proj-blendmode-seg", "blendmode", "blend");
await pagina.waitForTimeout(600);
await põe("proj-proj-w", 36);
await põe("proj-proj-h", 0);
await põe("proj-proj-dist", 68);
await pagina.waitForTimeout(1200);
const semAltura = await pagina.evaluate(() => {
  const t = document.getElementById("proj-sum").textContent;
  return { texto: t, temInfinito: /Infinity/.test(t), diz: /falta a altura/.test(t),
           restoCorre: /Pixel usage total|Processamento/.test(t) };
});
conferir(!semAltura.temInfinito,
  "a ficha não diz 'Infinity projetores' — uma divisão por zero não se deixa correr");
conferir(semAltura.diz, "diz o que falta, pelo nome: a altura do ecrã");
conferir(semAltura.restoCorre,
  "e o resto do projeto continua a contar — um campo por preencher não apaga o resto");

const nadaParaGuardar = await pagina.evaluate(async () => {
  const antes = document.querySelectorAll("#proj-ecras-lista button").length;
  document.getElementById("proj-guardar-ecra").click();
  await new Promise((r) => setTimeout(r, 900));
  return { antes, depois: document.querySelectorAll("#proj-ecras-lista button").length };
});
conferir(nadaParaGuardar.depois === nadaParaGuardar.antes,
  "e não se guarda um ecrã que não existe (" + nadaParaGuardar.depois + " botões)");

// repor um ecrã a sério para o que vem a seguir
await põe("proj-proj-h", 8);
await pagina.waitForTimeout(900);
await seg("proj-blendmode-seg", "blendmode", "single");
await pagina.waitForTimeout(600);

console.log("\n== o que o Blending manda para o projeto ==");

// Reparo dele: *"a distância de projeção não está a viajar da aba de blend para
// o projeto"*. E não estava: a syncBlendToProject() levava o ecrã, o modelo e a
// resolução, e deixava a DISTÂNCIA para trás. A aba Projeto ficava nos 4,0 m
// por omissão -- que não é escolha de ninguém -- e com esse número escolhia
// outras lentes e outra luminosidade. A syncProjecaoToProject(), ao lado,
// sempre a levou: era descuido, não decisão.
await abrirAba("blend");
await pagina.waitForTimeout(700);
await põe("b-w", 30);
await põe("b-h", 8);
await põe("b-knowndist", 17.5);
await pagina.waitForTimeout(900);
await pagina.evaluate(async () => {
  const a = document.getElementById("b-addproject");
  if (a && !a.checked) a.click();
  await new Promise((r) => setTimeout(r, 1600));
});
await abrirAba("projeto");
await pagina.waitForTimeout(1200);
const doBlend = await pagina.evaluate(() => ({
  w: (document.getElementById("proj-proj-w") || {}).value,
  h: (document.getElementById("proj-proj-h") || {}).value,
  dist: (document.getElementById("proj-proj-dist") || {}).value,
  modo: (document.querySelector("#proj-blendmode-seg .seg-btn.active") || {}).dataset
    ? document.querySelector("#proj-blendmode-seg .seg-btn.active").dataset.blendmode : "?"
}));
conferir(doBlend.w === "30" && doBlend.h === "8",
  "o ecrã do blend chega ao projeto (" + doBlend.w + " x " + doBlend.h + " m)");
conferir(doBlend.modo === "blend", "e o modo também");
conferir(Number(doBlend.dist) === 17.5,
  "E A DISTÂNCIA TAMBÉM — era ela que ficava para trás, nos 4,0 m por omissão (" +
  doBlend.dist + " m)");

conferir(erros.length === 0, erros.length ? "erro de JavaScript: " + erros[0] : "sem erros de JavaScript");

await browser.close();
s.close();
console.log(falhas ? `\n${falhas} a corrigir.` : "\nVários ecrãs de projeção no mesmo projeto.");
process.exit(falhas ? 1 : 0);
