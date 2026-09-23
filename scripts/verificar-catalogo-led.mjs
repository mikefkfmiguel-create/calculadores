/**
 * O CATÁLOGO DE TILES, PASSADO TODO PELO MESMO ECRÃ.
 *
 * Porque é que existe: o mike escolheu um painel da lista, a app disse-lhe
 * "Pitch horizontal (3,91 mm) e vertical (7,81 mm) não coincidem — confirma os
 * valores do módulo", e ele perguntou *"E isto será???"*. Era o Traulux
 * transparente, e os valores estavam certos: o fabricante escreve que é "con
 * un pixel pitch asimétrico 3.9-7.8" que se consegue a transparência. O aviso
 * é que estava errado.
 *
 * A pergunta a seguir foi a que vale a pena automatizar: *"podes correr toda a
 * lista com uma configuração de ecrã de 8 x 4.5 para ver se existem mais
 * gralhas destas"*. Um número mal copiado numa entrada do catálogo não se vê a
 * olho -- vê-se quando se põem as 38 lado a lado a fazer o MESMO ecrã.
 *
 * Isto não recalcula nada por fora: escolhe cada modelo na app a sério, mete o
 * tamanho em metros, e lê o que ela escreve. Uma conta minha em paralelo
 * validava a minha conta, não a da app.
 *
 *   node scripts/verificar-catalogo-led.mjs
 *
 * FALHA (código 1) só no que é mesmo defeito: pitch não quadrado sem estar
 * declarado como assimétrico, grelha que fica abaixo do ecrã pedido, rótulo a
 * discordar dos campos, peso ou consumo fora do plausível, erro de JavaScript.
 * O que é falta de informação (sem nits, sem fonte) fica escrito e não falha --
 * é trabalho de recolha, não avaria.
 */

import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = fileURLToPath(new URL("..", import.meta.url));

// O ecrã que se pede a todos: 8,00 × 4,50 m, o mais perto de 16:9 em medidas
// redondas de sala. Um tile que não parta bem nestas medidas mostra-o já aqui.
const ALVO_L = 8, ALVO_A = 4.5;

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

// ------------------------------------------------------------------- correr

const { s, porta } = await servidor();
const { chromium } = await carregarPlaywright();
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM || "/opt/pw-browsers/chromium"
});
// SEM SERVICE WORKER: com ele a app apanha versão nova e recarrega a página a
// meio da medição -- dava "Execution context was destroyed" e, antes disso, um
// querySelector a devolver null sem razão aparente. Não é defeito da app; é o
// teste a competir com a atualização automática.
const ctx = await browser.newContext({ viewport: { width: 1500, height: 1000 }, serviceWorkers: "block" });
const pagina = await ctx.newPage();
const errosDaPagina = [];
pagina.on("pageerror", (e) => errosDaPagina.push(e.message));

await pagina.goto(`http://127.0.0.1:${porta}/index.html`, { waitUntil: "networkidle" });
await pagina.waitForFunction(() => document.querySelectorAll("#l-model option").length > 3, null, { timeout: 20000 });
// As abas podem estar escondidas atrás do menu: clica-se no elemento, que
// dispara o mesmo listener, em vez de simular um rato.
await pagina.evaluate(() => document.querySelector('.tabs .tab[data-mode="led"]').click());
await pagina.waitForFunction(() =>
  !!document.querySelector('#l-sizemode-seg .seg-btn[data-sizemode="meters"]'), null, { timeout: 15000 });
await pagina.evaluate(() => document.querySelector('#l-sizemode-seg .seg-btn[data-sizemode="meters"]').click());
await pagina.waitForTimeout(300);

async function pedirOAlvo() {
  await pagina.evaluate(({ l, a }) => {
    for (const [id, v] of [["l-target-w", String(l)], ["l-target-h", String(a)]]) {
      const el = document.getElementById(id);
      el.value = v;
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    }
  }, { l: ALVO_L, a: ALVO_A });
  await pagina.waitForTimeout(300);
}

const modelos = await pagina.evaluate(() =>
  [...document.querySelectorAll("#l-model option")]
    .map((o) => o.value).filter((v) => v !== "custom" && v !== ""));

// Escolher um modelo é o que enche os campos do módulo; sem isso tudo o que
// vem a seguir lê zeros sem nada a dizer porquê.
await pagina.evaluate((v) => {
  const sel = document.getElementById("l-model");
  sel.value = v; sel.dispatchEvent(new Event("change", { bubbles: true }));
}, modelos[0]);
await pagina.waitForTimeout(300);
await pedirOAlvo();

const prontos = await pagina.evaluate(() => ({
  mx: document.getElementById("l-mx").value,
  tiles: (document.getElementById("l-out-tiles") || {}).textContent
}));
if (!prontos.mx || !prontos.tiles) {
  console.log("A preparação não pegou — a app não chegou a calcular nada:", JSON.stringify(prontos));
  await browser.close(); s.close(); process.exit(2);
}

const ficha = JSON.parse(await readFile(join(RAIZ, "data", "led-tiles.json"), "utf8"));
const linhas = [];
for (const v of modelos) {
  await pagina.evaluate((valor) => {
    const sel = document.getElementById("l-model");
    sel.value = valor; sel.dispatchEvent(new Event("change", { bubbles: true }));
  }, v);
  await pagina.waitForTimeout(130);
  // Escolher um modelo repõe os campos do módulo — volta a pedir-se o alvo.
  await pedirOAlvo();
  const lido = await pagina.evaluate(() => {
    const t = (id) => ((document.getElementById(id) || {}).textContent || "").trim();
    const c = (id) => ((document.getElementById(id) || {}).value || "").trim();
    const w = document.getElementById("l-warn");
    return {
      mw: c("l-mw"), mh: c("l-mh"), rx: c("l-rx"), ry: c("l-ry"),
      mx: c("l-mx"), my: c("l-my"),
      tiles: t("l-out-tiles"), peso: t("l-out-weight"), amp: t("l-out-amp"),
      aviso: (w && w.style.display !== "none") ? w.textContent.trim() : "",
      avisoCalmo: !!(w && w.classList.contains("calmo"))
    };
  });
  linhas.push({ ...lido, ficha: ficha[parseInt(v, 10)] });
}

await browser.close();
s.close();

// ---------------------------------------------------------------- o relatório

const n = (x) => parseFloat(String(x).replace(",", ".")) || 0;
const col = (x, w) => String(x).padEnd(w);
const defeitos = [], recolha = [];

console.log(`ECRÃ PEDIDO A TODOS: ${ALVO_L.toFixed(2)} × ${ALVO_A.toFixed(2)} m   (16:9 = 1,778)\n`);
console.log(col("modelo", 40) + col("tiles", 7) + col("grelha", 8) + col("fica", 16) +
            col("rácio", 9) + col("peso", 11) + col("amp", 10) + "pitch");
console.log("-".repeat(112));

for (const L of linhas) {
  const t = L.ficha;
  const nome = (t && t.modelo) || "(sem nome)";
  const mw = n(L.mw), mh = n(L.mh), rx = n(L.rx), ry = n(L.ry);
  const largura = n(L.mx) * mw / 1000, altura = n(L.my) * mh / 1000;
  const racio = altura > 0 ? largura / altura : 0;
  const px = rx > 0 ? mw / rx : 0, py = ry > 0 ? mh / ry : 0;
  const quadrado = Math.abs(px - py) <= 0.01;

  console.log(col(nome.slice(0, 39), 40) + col(L.tiles || "—", 7) +
    col(L.mx + "×" + L.my, 8) +
    col(largura.toFixed(2) + "×" + altura.toFixed(2) + " m", 16) +
    col(racio.toFixed(3) + (Math.abs(racio - 16 / 9) < 0.002 ? " ✓" : ""), 9) +
    col(L.peso || "—", 11) + col(L.amp || "—", 10) +
    (quadrado ? px.toFixed(2) : px.toFixed(2) + "/" + py.toFixed(2)));

  const defeito = (o, q) => defeitos.push({ nome, o, q });
  const falta = (o, q) => recolha.push({ nome, o, q });

  // 1. PITCH NÃO QUADRADO -- e qual seria o número certo.
  //
  // Dizer "estes dois não coincidem" deixa o trabalho todo para quem lê. Com
  // quatro números e uma regra (pitch igual nos dois eixos), há exactamente
  // quatro maneiras de arrumar isto mexendo num campo só, e a conta dá-as. A
  // que sair REDONDA é quase sempre a que estava certa antes da gralha; se
  // nenhuma sair redonda, há mais do que um número errado -- e isso é uma
  // informação diferente, que vale a pena ter escrita.
  //
  // Duas declarações tiram uma entrada da lista de defeitos, e são coisas
  // diferentes: `pitchAssimetrico` é "está certo assim, o fabricante confirma";
  // `pitchPorConfirmar` é "sabemos que está torto e ainda não temos ficha para
  // o resolver". A segunda NÃO é uma maneira de calar o teste -- obriga a uma
  // nota que diga o que falta, e continua a aparecer em cada corrida. Sem isso,
  // ou o teste nascia vermelho e ninguém lhe ligava, ou o problema saía dos
  // dados para uma conversa que se perde.
  if (!quadrado) {
    const assumido = !!(t && t.pitchAssimetrico);
    const porConfirmar = !!(t && t.pitchPorConfirmar);
    if (porConfirmar && !(t.nota && /por confirmar/i.test(t.nota))) {
      defeito("pitch", "marcado pitchPorConfirmar mas a nota não diz o que falta confirmar");
    }
    (assumido || porConfirmar ? falta : defeito)("pitch",
      "H " + px.toFixed(3) + " ≠ V " + py.toFixed(3) + " mm" +
      (assumido ? "   — declarado assimétrico nos dados, é assim que o painel é feito" : "") +
      (porConfirmar ? "   — POR CONFIRMAR com o fabricante, ver a nota na entrada" : ""));
    if (!assumido) {
      // As hipóteses de ajuste vão para a mesma lista que o pitch: a quem está
      // por confirmar servem de pistas, não de acusação.
      const registar = porConfirmar ? falta : defeito;
      const inteiro = (v) => Math.abs(v - Math.round(v)) < 0.01;
      // Cada hipótese aterra no pitch do eixo que NÃO se mexe, e não é sempre
      // o mesmo: mexer no rx ou na largura deixa o vertical de pé; mexer no ry
      // ou na altura deixa o horizontal.
      const hipoteses = [
        { campo: "resolução horizontal (rx)", de: rx, para: mw / py, un: "px", fica: py },
        { campo: "resolução vertical (ry)",   de: ry, para: mh / px, un: "px", fica: px },
        { campo: "largura do módulo (mw)",    de: mw, para: rx * py, un: "mm", fica: py },
        { campo: "altura do módulo (mh)",     de: mh, para: ry * px, un: "mm", fica: px }
      ].map((h) => ({ ...h, limpo: inteiro(h.para) }));
      for (const h of hipoteses) {
        registar("  ajuste", (h.limpo ? "✔ " : "· ") + h.campo + ": " + h.de + " → " +
          h.para.toFixed(h.limpo ? 0 : 2) + " " + h.un +
          "   (fica P" + h.fica.toFixed(3) + " nos dois eixos)" +
          (h.limpo ? "" : "  — não dá número redondo"));
      }
      if (!hipoteses.some((h) => h.limpo)) {
        registar("  ajuste", "nenhum ajuste de um campo só dá números redondos — há mais " +
          "do que um número errado, ou o painel é mesmo assim e falta declará-lo " +
          "com pitchAssimetrico. Sem ficha do fabricante não se decide.");
      }
    }
  }

  // 2. O AVISO DA APP tem de concordar com os dados. Um painel declarado
  //    assimétrico não pode aparecer pintado de vermelho, e um pitch torto sem
  //    declaração não pode passar calado.
  if (!quadrado && t && t.pitchAssimetrico && !L.avisoCalmo) {
    defeito("aviso", "declarado assimétrico mas a app mostra-o como problema: «" + L.aviso + "»");
  }
  if (!quadrado && !(t && t.pitchAssimetrico) && (!L.aviso || L.avisoCalmo)) {
    defeito("aviso", "pitch torto e a app não avisa (ou avisa em tom de facto)");
  }

  // 3. A GRELHA TEM DE COBRIR o ecrã pedido, nunca ficar abaixo.
  if (largura + 1e-9 < ALVO_L || altura + 1e-9 < ALVO_A) {
    defeito("grelha", "fica " + largura.toFixed(2) + "×" + altura.toFixed(2) +
      " m, menos do que os " + ALVO_L + "×" + ALVO_A + " pedidos");
  }

  // 4. O RÓTULO é texto escrito à mão ao lado de números que a app usa a
  //    sério — é aí que uma gralha passa despercebida mais tempo.
  if (t && t.label) {
    const lab = t.label;
    if (/\d+\s*×\s*\d+\s*mm/.test(lab) && !lab.replace(/\s/g, "").includes(t.mw + "×" + t.mh))
      defeito("rótulo", "o texto não diz " + t.mw + "×" + t.mh + " mm: «" + lab + "»");
    if (/px/.test(lab) && !lab.replace(/\s/g, "").includes(t.rx + "×" + t.ry + "px"))
      defeito("rótulo", "o texto não diz " + t.rx + "×" + t.ry + " px: «" + lab + "»");
    const kg = lab.match(/(?:^|[\s,])([\d]+(?:[.,][\d]+)?)\s*kg/);
    if (kg && t.weight != null && Math.abs(parseFloat(kg[1].replace(",", ".")) - t.weight) > 0.051)
      defeito("rótulo", "peso: o texto diz " + kg[1] + " kg, o campo tem " + t.weight);
    const a = lab.match(/(?:^|[\s≈])([\d]+(?:[.,][\d]+)?)\s*A(?![a-z])/);
    if (a && t.amp != null && Math.abs(parseFloat(a[1].replace(",", ".")) - t.amp) > 0.011)
      defeito("rótulo", "amperagem: o texto diz " + a[1] + " A, o campo tem " + t.amp);
    const wv = lab.match(/\((\d+)\s*W\s*@\s*(\d+)\s*V\)/);
    if (wv && t.amp > 0) {
      const aDoTexto = parseFloat(wv[1]) / parseFloat(wv[2]);
      if (Math.abs(aDoTexto - t.amp) > Math.max(0.03, t.amp * 0.06))
        defeito("rótulo", wv[1] + "W a " + wv[2] + "V são " + aDoTexto.toFixed(2) +
          " A, mas o campo tem " + t.amp + " A");
    }
  }

  // 5. PESO E CONSUMO POR m², para apanhar um zero a mais ou a menos. Os
  //    limites são largos de propósito: o catálogo real anda entre 16 e 56
  //    kg/m², e não é trabalho deste teste ter opinião sobre painéis.
  const m2 = (mw / 1000) * (mh / 1000);
  if (m2 > 0 && t && t.weight > 0) {
    const kgM2 = t.weight / m2;
    if (kgM2 < 10 || kgM2 > 70)
      defeito("peso", t.weight + " kg num módulo de " + m2.toFixed(2) + " m² = " + kgM2.toFixed(1) + " kg/m²");
  }
  if (m2 > 0 && t && t.amp > 0) {
    const aM2 = t.amp / m2;
    if (aM2 < 0.5 || aM2 > 12)
      defeito("consumo", t.amp + " A num módulo de " + m2.toFixed(2) + " m² = " + aM2.toFixed(2) + " A/m²");
  }

  // 5b. QUANDO A NOTA CITA UM kg/m² DO FABRICANTE, o campo tem de bater com
  //     ele. Isto apanha a confusão de unidades — o peso por metro quadrado
  //     copiado para um campo que é por MÓDULO — que é invisível às faixas
  //     largas acima: os 15 kg/m² do Traulux transparente ficaram anos a
  //     passar por 15 kg de módulo, e num cabinet de meio metro quadrado isso
  //     é o dobro do peso real. Reportado por ele: "acho que está a dar o
  //     dobro, pois o peso é por metro quadrado" — e a ficha do fabricante,
  //     que já estava citada em `fonte`, dava-lhe razão.
  //
  //     Não tem opinião sobre painéis: só confere a entrada contra o número
  //     que a própria entrada diz ter ido buscar. Quem documentar um kg/m² no
  //     futuro leva a mesma protecção de graça.
  if (m2 > 0 && t && t.weight > 0 && t.nota) {
    const citado = t.nota.match(/(\d+(?:[.,]\d+)?)\s*kg\/m²/);
    if (citado) {
      const alvo = parseFloat(citado[1].replace(",", "."));
      const real = t.weight / m2;
      if (Math.abs(real - alvo) > 0.05 * alvo)
        defeito("peso", "a nota cita " + citado[1] + " kg/m² do fabricante, mas " + t.weight +
          " kg num módulo de " + m2.toFixed(2) + " m² dá " + real.toFixed(1) + " kg/m²" +
          " (o valor por módulo seria " + (alvo * m2).toFixed(2) + " kg)");
    }
  }
  if (t && t.nitsMin != null && t.nitsMax != null && t.nitsMin > t.nitsMax)
    defeito("nits", "mínimo " + t.nitsMin + " maior que o máximo " + t.nitsMax);

  // 6. O QUE FALTA RECOLHER. Não falha: um campo a null está declarado como
  //    não sabido, e a app mostra "—" em vez de inventar um zero. É trabalho
  //    por fazer, não avaria.
  if (!t || t.weight == null) falta("em falta", "sem peso — o total sai «—» em vez de um número");
  if (!t || t.amp == null) falta("em falta", "sem amperagem — o total sai «—» em vez de um número");
  if (!t || !t.fonte) falta("fonte", "sem fonte" + (t && /AVK/i.test(t.label || "") ? " (stock AVK, origem dita no rótulo)" : ""));
  if (!t || (t.nitsMin == null && t.nitsMax == null)) falta("nits", "sem brilho declarado");
}

const escrever = (titulo, lista) => {
  console.log("\n" + titulo);
  let ultimo = "";
  for (const a of lista) {
    if (a.nome !== ultimo) { console.log("  " + a.nome); ultimo = a.nome; }
    console.log("      [" + a.o + "] " + a.q);
  }
};

console.log("\n" + "=".repeat(112));
if (errosDaPagina.length) {
  console.log("ERROS DE JAVASCRIPT: " + errosDaPagina.join(" | "));
}
if (recolha.length) escrever(recolha.length + " coisa(s) por recolher (não falham):", recolha);
if (defeitos.length) escrever(defeitos.length + " DEFEITO(S):", defeitos);

const falhou = defeitos.length > 0 || errosDaPagina.length > 0;
console.log("\n" + (falhou
  ? "O catálogo tem defeitos — ver acima."
  : `Os ${linhas.length} modelos fazem o ecrã pedido e os números batem certo.`));
process.exit(falhou ? 1 : 0);
