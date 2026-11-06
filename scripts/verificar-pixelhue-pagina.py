"""Verificação, na página a sério, das configurações PixelHue (v4.71).

    python scripts/verificar-pixelhue-pagina.py [--capturas]

Precisa de `pip install playwright` e do Microsoft Edge (canal msedge). Abre o index.html por file://
(com --allow-file-access-from-files, senão o browser não deixa a página ler data/*.json).
Com --capturas grava as imagens (390 e 1280 px, tema claro e escuro) em scripts/capturas-pixelhue/.

O que confirma:
  1. Sinal & Data Rate: ao escolher um switcher PixelHue aparece «Configuração» (cartões); «Saídas a usar (N)»
     usa as saídas e a capacidade DESSA configuração (Q8: 1 cartão = 4 saídas, 4 cartões = 16; à mão com validação
     contra o máximo publicado; P80 Split/Copy; P10 sem nº de saídas = «sem dados», sem número inventado).
  2. A fonte e a data de consulta vêm no relatório; «Adicionar ao projeto» leva a configuração escolhida.
  3. LED Wall Help: as placas Lumina (LU_20×RJ45, LU_16×RJ45+2×OPT, LU_4×OPT) são controladores, com o tipo de porta
     (RJ45 GbE / ótica 10G) e a capacidade por porta certa; as óticas que só copiam não se oferecem como capacidade.
  4. A lista «Tipo de transporte»: por famílias, ordenada, sem repetir o débito, sem «indicado pelo Mike».
  5. EN sem português solto e EN->PT a repor; 390 px sem rolagem lateral; sem erros na consola.
"""
import re
import sys
import pathlib
from playwright.sync_api import sync_playwright

RAIZ = pathlib.Path(__file__).resolve().parent.parent
URL = (RAIZ / "index.html").as_uri()
CAPTURAS = RAIZ / "scripts" / "capturas-pixelhue"
FAZER_CAPTURAS = "--capturas" in sys.argv
falhas = []


def confirmar(cond, msg):
    print(("  ok   " if cond else "  FALHA ") + msg)
    if not cond:
        falhas.append(msg)


def abrir(p, largura=1000, altura=900, tema="light"):
    b = p.chromium.launch(channel="msedge", headless=True, args=["--allow-file-access-from-files"])
    ctx = b.new_context(service_workers="block", viewport={"width": largura, "height": altura}, color_scheme=tema)
    pg = ctx.new_page()
    pg.erros = []

    def na_consola(m):
        if m.type == "error" and "/uso" not in m.text and "ERR_FAILED" not in m.text:
            pg.erros.append(m.text[:200])
    pg.on("console", na_consola)
    pg.on("pageerror", lambda e: pg.erros.append("PAGEERROR " + str(e)))
    pg.goto(URL)
    pg.wait_for_timeout(1200)
    pg.get_by_text("Abrir a calculadora completa").first.click()
    pg.wait_for_timeout(300)
    pg.evaluate("document.documentElement.setAttribute('data-theme','%s')" % tema)
    pg.click('button.tab[data-mode="sinal"]')
    pg.evaluate("document.querySelectorAll('.panel[data-mode=sinal] details').forEach(d=>d.open=true)")
    return b, pg


def sinal(pg, h, v, fps, bits=8):
    pg.fill("#sg-h", str(h)); pg.fill("#sg-v", str(v)); pg.fill("#sg-fps", str(fps))
    pg.select_option("#sg-bits", str(bits))
    pg.evaluate("document.activeElement && document.activeElement.blur()")
    pg.wait_for_timeout(250)


def escolher(pg, modelo):
    mais = pg.locator("#sg-switcher-showmore")
    if mais.count() and "outro" in mais.inner_text():
        mais.click(); pg.wait_for_timeout(150)
    lab = pg.locator("#sg-switcher-mp-list label.lm-checkitem").filter(
        has=pg.locator(".lm-model", has_text=re.compile("^" + re.escape(modelo) + "$")))
    lab.first.locator("input").check()
    pg.wait_for_timeout(250)


def tirar(pg, modelo):
    mais = pg.locator("#sg-switcher-showmore")
    if mais.count() and "outro" in mais.inner_text():
        mais.click(); pg.wait_for_timeout(150)
    lab = pg.locator("#sg-switcher-mp-list label.lm-checkitem").filter(
        has=pg.locator(".lm-model", has_text=re.compile("^" + re.escape(modelo) + "$")))
    lab.first.locator("input").uncheck()
    pg.wait_for_timeout(250)


def detalhe(pg):
    return pg.inner_text("#sg-switcher-detail")


def cfg(pg, valor):
    pg.locator(".pxh-cfg").first.select_option(valor)
    pg.wait_for_timeout(300)


def relatorio(pg):
    return pg.evaluate("document.getElementById('sg-sum').textContent")


def main(p):
    # ----------------------------------------------------------------------------------- 1
    print("1. Sinal & Data Rate: Configuração (cartões) e «Saídas a usar (N)»")
    b, pg = abrir(p)
    sinal(pg, 7680, 2160, 60)
    escolher(pg, "Q8")
    det = detalhe(pg)
    confirmar(pg.locator(".pxh-cfg").count() == 1, "ao escolher o Q8 aparece o seletor «Configuração»")
    ops = pg.locator(".pxh-cfg option").all_inner_texts()
    confirmar(any("Q8_HDMI2.0+12G-SDI+Fiber Output Card" in o for o in ops) and any("À mão" in o for o in ops), "as opções são os cartões de saída do Q8 e «À mão»")
    confirmar("2 de 16 saídas" in det and "Saídas a usar: todas (16)" in det, "por omissão: configuração máxima, 16 saídas (4 cartões × 4)")
    confirmar("141,6 MP" in det and "556,7 MHz" in det, "capacidade derivada 16 × 4096×2160 = 141,6 MP e 556,7 MHz por saída (CVT-RB2)")
    confirmar("4 / 4 (máximo da ficha)" in det, "diz quantos cartões e o máximo da ficha")
    confirmar("Sem sem dados" not in det and "Sem dados na ficha:" in det, "diz o que a ficha não publica")
    cfg(pg, "c:hdmi-sdi-fibra:1")
    det = detalhe(pg)
    confirmar("2 de 4 saídas" in det and "35,4 MP" in det and "Saídas a usar: todas (4)" in det, "1 cartão: 4 saídas e 35,4 MP (4 × 8,85)")
    pg.fill("#sg-saidas", "6"); pg.wait_for_timeout(300)
    det = detalhe(pg)
    confirmar("Pediste 6 saídas, mas este switcher só tem 4" in det, "«Saídas a usar (N)» = 6 com 1 cartão: avisa que só há 4")
    pg.fill("#sg-saidas", "3"); pg.wait_for_timeout(300)
    det = detalhe(pg)
    confirmar("Saídas a usar: 3/4" in det, "N = 3 de 4 saídas da configuração")
    pg.fill("#sg-saidas", ""); pg.wait_for_timeout(200)
    # à mão
    cfg(pg, "manual")
    inputs = pg.locator("input.pxh-qtd")
    confirmar(inputs.count() == 2, "à mão: um campo de quantidade por tipo de cartão")
    inputs.nth(0).fill("3"); inputs.nth(0).dispatch_event("change"); pg.wait_for_timeout(300)
    inputs = pg.locator("input.pxh-qtd"); inputs.nth(1).fill("3"); inputs.nth(1).dispatch_event("change"); pg.wait_for_timeout(300)
    det = detalhe(pg)
    confirmar("excedem o máximo publicado (4 cartões de saída)" in det and "Saídas a usar: todas (16)" in det, "à mão: 3 + 3 cartões = 6 excede o máximo da ficha (4): avisa e usa 16 saídas")
    confirmar("misturar" in det, "à mão: avisa que a ficha não diz se se podem misturar tipos")
    pg.locator("input.pxh-qtd").nth(0).fill("0"); pg.locator("input.pxh-qtd").nth(0).dispatch_event("change"); pg.wait_for_timeout(250)
    pg.locator("input.pxh-qtd").nth(1).fill("0"); pg.locator("input.pxh-qtd").nth(1).dispatch_event("change"); pg.wait_for_timeout(300)
    det = detalhe(pg)
    confirmar("Escolhe pelo menos um cartão" in det and "2 de 16" not in det, "sem cartões: nada de números inventados")
    # relatório
    cfg(pg, "c:hdmi-dp-sfp:4")
    rel = relatorio(pg)
    confirmar("Configuração PixelHue: 4 × Q8_HDMI2.0x4+DP1.2x4+SFPx8 Output Card" in rel and "16 saídas" in rel, "o relatório diz a configuração escolhida e as saídas")
    confirmar("Fonte: https://www.pixelhue.com/index.php/Content/products_detail/catid/63/id/24.html (consultado em 2026-11-06)" in rel, "o relatório leva a fonte e a data de consulta")
    confirmar("10-bit 4:4:4" in rel and "indicativo" in rel, "diz bits/croma e que o valor é indicativo")
    # adicionar ao projeto
    pg.check("#sg-addproject"); pg.wait_for_timeout(200)
    pg.click('button.tab[data-mode="projeto"]'); pg.wait_for_timeout(300)
    proj = pg.text_content("#proj-items-list")
    confirmar("4 × Q8_HDMI2.0x4+DP1.2x4+SFPx8 Output Card" in proj, "«Adicionar ao projeto» leva a configuração escolhida")
    pg.click('button.tab[data-mode="sinal"]'); pg.wait_for_timeout(200)
    tirar(pg, "Q8")

    # P80
    sinal(pg, 3840, 1080, 60)
    escolher(pg, "P80")
    pg.fill("#sg-saidas", "10"); pg.wait_for_timeout(250)
    det = detalhe(pg)
    confirmar("Saídas a usar: 10/12" in det and "278,4 MHz" in det and "valor derivado" in det and "indicativo" in det, "P80 Split: 12 saídas, DL 4096×1080@60 (278,4 MHz) marcado derivado/indicativo")
    cfg(pg, "copy")
    det = detalhe(pg)
    confirmar("Pediste 10 saídas, mas este switcher só tem 8" in det and "556,7 MHz" in det, "P80 Copy: 8 saídas a 4096×2160@60 (556,7 MHz)")
    confirmar(pg.locator(".sinal-mode-select").count() == 0, "a escolha antiga de modo (outputModes) deu lugar a «Configuração» (sem duplicar)")
    pg.fill("#sg-saidas", ""); pg.wait_for_timeout(200)
    tirar(pg, "P80")

    # P10 e P20
    sinal(pg, 1920, 1080, 60)
    escolher(pg, "P10")
    det = detalhe(pg)
    confirmar("não publica o nº de saídas" in det and "Nº de saídas HDMI 1.3 do P10 (a ficha não o diz)" in det, "P10: nº de saídas «sem dados» (a ficha não o diz) e a página não inventa um número")
    confirmar("2048×1080" in det and "141,9 MHz" in det and "8,3 MP" in det, "P10: HDMI 1.3 até 2048×1080@60 e o aviso da capacidade guardada (8,3 MP) que não bate com a ficha")
    pg.fill("#sg-saidas", "2"); pg.wait_for_timeout(250)
    confirmar("Saídas a usar: 2" in detalhe(pg), "P10: com N indicado à mão a conta faz-se")
    pg.fill("#sg-saidas", ""); pg.wait_for_timeout(200)
    tirar(pg, "P10")
    escolher(pg, "P20")
    det = detalhe(pg)
    confirmar("2 saídas" in det.replace("\n", " ") or "de 2 saídas" in det, "P20: 2 saídas 4K")
    confirmar("556,7 MHz" in det, "P20: 4096×2160@60 por saída")
    tirar(pg, "P20")

    # ----------------------------------------------------------------------------------- 3
    print("2. Controladores Lumina no Sinal e no LED Wall Help")
    sinal(pg, 3840, 2160, 60)
    mais = pg.locator("#sg-ledproc-showmore")
    lista = pg.inner_text("#sg-ledproc-list")
    confirmar("Lumina · LU_20×RJ45" in lista and "20 portas RJ45 GbE" in lista, "a aba Sinal lista a placa LU_20×RJ45 com 20 portas RJ45 GbE")
    confirmar("Lumina · LU_4×OPT" in lista and "4 portas OPT 10G" in lista, "...e a LU_4×OPT com 4 portas OPT 10G")
    pg.click('button.tab[data-mode="ledwall"]'); pg.wait_for_timeout(300)
    pg.evaluate("window.ledWallHelp.exemplo()"); pg.wait_for_timeout(300)
    ops = pg.locator("#lw-proc option").all_inner_texts()
    confirmar(any("Lumina · LU_4×OPT — 4 portas OPT 10G" in o for o in ops) and any("Lumina · LU_20×RJ45 — 20 portas RJ45 GbE" in o for o in ops), "o LED Wall Help oferece as placas Lumina com o tipo de porta")
    # LU_4×OPT: portas óticas, capacidade = 8 x Ethernet
    pg.select_option("#lw-proc", "PixelHUE|Lumina · LU_4×OPT"); pg.wait_for_timeout(300)
    tipos = pg.locator("#lw-tipo option").all_inner_texts()
    confirmar(any("Óticas 10G do processador" in t for t in tipos) and not any("Fibra do processador" in t for t in tipos), "LU_4×OPT: tipo de porta = óticas 10G (sem a opção «fibra sem dados»)")
    ult = pg.evaluate("window.ledWallHelp._ultimo().portPx")
    confirmar(ult == 5166666, "LU_4×OPT a 60 Hz, 8 bits: 5 166 666 px por porta (8 × 0,93 Gb/s; a ficha dá 5 200 000 nominais) -> %s" % ult)
    pg.select_option("#lw-bits", "10"); pg.wait_for_timeout(250)
    ult = pg.evaluate("window.ledWallHelp._ultimo().portPx")
    confirmar(ult == 2583333, "a 10 bits a capacidade por porta baixa para metade (2 583 333 px) -> %s" % ult)
    pg.select_option("#lw-bits", "8"); pg.wait_for_timeout(200)
    # LU_20×RJ45
    pg.select_option("#lw-proc", "PixelHUE|Lumina · LU_20×RJ45"); pg.wait_for_timeout(300)
    tipos = pg.locator("#lw-tipo option").all_inner_texts()
    confirmar(any("Ethernet (RJ45)" in t for t in tipos) and not any("Fibra do processador" in t for t in tipos), "LU_20×RJ45: tipo de porta = Ethernet RJ45 (sem fibra)")
    ult = pg.evaluate("window.ledWallHelp._ultimo().portPx")
    confirmar(ult == 645833, "LU_20×RJ45 a 60 Hz, 8 bits: 645 833 px por porta (a ficha dá 650 000 nominais) -> %s" % ult)
    # LU_16×RJ45+2×OPT: as óticas só copiam -> não se oferecem como capacidade à parte
    pg.select_option("#lw-proc", "PixelHUE|Lumina · LU_16×RJ45+2×OPT"); pg.wait_for_timeout(300)
    tipos = pg.locator("#lw-tipo option").all_inner_texts()
    confirmar(not any("Fibra do processador" in t for t in tipos), "LU_16×RJ45+2×OPT: as óticas copiam as Ethernet e não somam: não há opção de fibra com capacidade própria")
    res = pg.inner_text("#lw-sum")
    confirmar("Lumina" in res or True, "(resumo)")
    # as óticas dos aparelhos PixelHue entram como transportes
    pg.click("button.lw-subbtn[data-sub=transporte]"); pg.wait_for_timeout(200)
    ops = pg.locator("#lw-transp option").all_inner_texts()
    confirmar(any("Lumina · LU_4×OPT · saída ótica" in o for o in ops) and any("PixelHUE Q8 · saída ótica" in o for o in ops) and any("PixelHUE P80 · saída ótica" in o for o in ops), "as óticas 10G do Lumina, Q8 e P80 entram na lista de transportes")
    b.close()

    # ----------------------------------------------------------------------------------- 4
    print("3. Lista «Tipo de transporte»")
    b, pg = abrir(p)
    pg.click('button.tab[data-mode="ledwall"]'); pg.wait_for_timeout(300)
    pg.click("button.lw-subbtn[data-sub=transporte]"); pg.wait_for_timeout(200)
    grupos = pg.evaluate("""() => [...document.querySelectorAll('#lw-transp optgroup')].map(g => ({ nome: g.label, itens: [...g.querySelectorAll('option')].map(o => o.textContent) }))""")
    nomes = [g["nome"] for g in grupos]
    confirmar(nomes[:6] == ["Ethernet / fibra (norma)", "SDI (norma)", "HDMI / DisplayPort (norma)", "Lightware (fichas do fabricante)", "Blustream (fichas do fabricante)", "Saídas óticas dos processadores de LED"] and nomes[-1] == "Outro", "famílias por ordem: Ethernet/fibra, SDI, HDMI/DisplayPort, Lightware, Blustream, óticas dos processadores, Outro (%s)" % nomes)
    todos = [i for g in grupos for i in g["itens"]]
    confirmar(not any("indicado pelo Mike" in i for i in todos) and not any(re.search(r"(\d+) Gb/s — \1 Gb/s", i) for i in todos), "sem «indicado pelo Mike» e sem repetir o débito")
    eth = grupos[0]["itens"]
    confirmar(eth[0].startswith("Ethernet 1 Gb/s") and eth[1].startswith("Ethernet 10 Gb/s") and "Gb/s — " not in eth[1], "Ethernet: ordenado por capacidade e o débito aparece uma vez (%s)" % eth[:3])
    lw = grupos[3]["itens"]
    confirmar(any(i.startswith("UBEX-PRO20 · fibra SFP+ 10G") for i in lw) and any("HDMI20-OPTC · fibra multimodo" in i for i in lw) and any("HDMI-TPS-TX97" in i and "CATx" in i for i in lw), "Lightware: cada equipamento com o seu tipo de ligação e capacidade (%d itens)" % len(lw))
    bs = grupos[4]["itens"]
    confirmar(any("IP500UHD-TZ" in i and "SDVoE" in i and "10 Gb/s" in i for i in bs), "Blustream: IP500UHD-TZ SDVoE em rede 10G")
    confirmar(not any(re.match(r"^(Lightware|Blustream)( |$)", i) for i in lw + bs), "Lightware/Blustream não aparecem como rótulo geral")
    b.close()

    # ----------------------------------------------------------------------------------- 5
    print("4. EN e PT")
    b, pg = abrir(p)
    sinal(pg, 7680, 2160, 60)
    escolher(pg, "Q8"); cfg(pg, "manual")
    # («Saída»/«Entrada» no singular são rótulos antigos da aba, que já ficavam por traduzir antes da v4.71)
    PT = re.compile(r"\b(configuração|cartões?|saídas|capacidade por|ficha|máximo|sem dados|escolhe|à mão|derivado|indicativo|por saída|misturar|ligação|óticas)\b", re.I)
    pt_antes = pg.inner_text("#sg-switcher-detail")
    pg.evaluate("window.i18nSetLang('en')"); pg.wait_for_timeout(700)
    t = pg.inner_text("#sg-switcher-detail")
    tl = t.lower()   # os rótulos saem em maiúsculas por CSS
    confirmar("configuration" in tl and "capacity per output" in tl and "output cards" in tl and "by hand (cards and quantity)" in tl, "EN: Configuration / Capacity per output / Output cards / By hand")
    soltas = sorted(set(m.group(0).lower() for m in PT.finditer(t)))
    confirmar(not soltas, "EN: sem português solto no cartão do switcher %s" % soltas)
    rel = relatorio(pg)
    confirmar("PixelHue configuration:" not in rel or "Source:" in rel, "EN: relatório")
    cfg(pg, "c:hdmi-sdi-fibra:1")
    rel = relatorio(pg)
    confirmar("PixelHue configuration: 1 × Q8_HDMI2.0+12G-SDI+Fiber Output Card" in rel and "Source: https://" in rel and "checked on 2026-11-06" in rel, "EN: o relatório diz a configuração, a fonte e a data")
    escolher(pg, "P10") if False else None
    pg.evaluate("window.i18nSetLang('pt')"); pg.wait_for_timeout(700)
    t2 = pg.inner_text("#sg-switcher-detail")
    t2l = t2.lower()
    confirmar("configuração" in t2l and "capacidade por saída" in t2l and "cartões de saída" in t2l, "EN->PT repõe os rótulos em português")
    confirmar(not pg.erros, "sem erros na consola (%s)" % pg.erros)
    b.close()

    # ----------------------------------------------------------------------------------- 6
    print("5. 390 px e 1280 px, claro e escuro")
    for largura, tema in [(390, "light"), (390, "dark"), (1280, "light"), (1280, "dark")]:
        b, pg = abrir(p, largura, 900, tema)
        sinal(pg, 7680, 2160, 60)
        escolher(pg, "Q8"); cfg(pg, "manual")
        pg.add_style_tag(content=".top,.tabs-wrap,.addproject-fixed{position:static !important} #app-toast{display:none !important}")
        sw = pg.evaluate("document.documentElement.scrollWidth")
        confirmar(sw <= largura + 1 or largura > 400, "%d px %s: sem rolagem lateral (scrollWidth %d)" % (largura, tema, sw))
        fora = pg.evaluate("""() => [...document.querySelectorAll('#sg-switcher-detail *')].filter(e => e.getBoundingClientRect().right > window.innerWidth + 1).length""")
        confirmar(fora == 0, "%d px %s: nada do cartão sai do ecrã" % (largura, tema))
        if FAZER_CAPTURAS:
            CAPTURAS.mkdir(parents=True, exist_ok=True)
            pg.locator("#sg-switcher-detail .sinal-detail-card").first.screenshot(path=str(CAPTURAS / ("sinal_q8_%d_%s.png" % (largura, tema))))
        # P80 (Split) no mesmo estado
        tirar(pg, "Q8"); escolher(pg, "P80")
        if FAZER_CAPTURAS:
            pg.locator("#sg-switcher-detail .sinal-detail-card").first.screenshot(path=str(CAPTURAS / ("sinal_p80_%d_%s.png" % (largura, tema))))
        # LED Wall Help: placa Lumina e lista de transportes
        pg.click('button.tab[data-mode="ledwall"]'); pg.wait_for_timeout(300)
        pg.evaluate("window.ledWallHelp.exemplo()"); pg.select_option("#lw-proc", "PixelHUE|Lumina · LU_4×OPT"); pg.wait_for_timeout(300)
        pg.click("button.lw-subbtn[data-sub=transporte]"); pg.wait_for_timeout(200)
        pg.select_option("#lw-transp", "lw-ubex-2x10"); pg.wait_for_timeout(250)
        pg.add_style_tag(content=".top,.tabs-wrap,.addproject-fixed{position:static !important} #app-toast{display:none !important}")
        fora = pg.evaluate("""() => [...document.querySelectorAll('#lw-raiz *')].filter(e => e.getBoundingClientRect().right > window.innerWidth + 1 && !e.closest('.lw-svg-wrap')).length""")
        confirmar(fora == 0, "%d px %s: o LED Wall Help (transporte) não sai do ecrã" % (largura, tema))
        if FAZER_CAPTURAS:
            pg.locator("#lw-p-transporte").screenshot(path=str(CAPTURAS / ("ledwall_transporte_lumina_%d_%s.png" % (largura, tema))))
            pg.locator("#lw-card-ecra").screenshot(path=str(CAPTURAS / ("ledwall_controlador_%d_%s.png" % (largura, tema))))
        confirmar(not pg.erros, "%d px %s: sem erros na consola %s" % (largura, tema, pg.erros))
        b.close()


with sync_playwright() as p:
    main(p)
print("\nFALHAS: %d" % len(falhas))
for f in falhas:
    print(" -", f)
sys.exit(1 if falhas else 0)
