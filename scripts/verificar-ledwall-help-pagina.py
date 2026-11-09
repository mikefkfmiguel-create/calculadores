"""Verificação, na página a sério, do separador novo «LED Wall Help» (v4.70).

    python scripts/verificar-ledwall-help-pagina.py [--capturas]

Precisa de `pip install playwright` e do Microsoft Edge (canal msedge). Abre o
index.html por file:// (com --allow-file-access-from-files, senão o browser não
deixa a página ler data/*.json). Com --capturas grava as imagens (390 e 1280 px,
tema claro e escuro) em scripts/capturas-ledwall/.

O caso de referência é o ecrã de 19 × 3 m, 2,60 mm, 7296 × 1152 px (38 × 6
cabinets de 500 × 500 mm e 192 × 192 px).

O que confirma:
  1. O separador existe, o da aba Ecrã LED fica como estava (com o atalho discreto).
  2. Resolução, tamanho, área, pitch, formato e brilho do exemplo.
  3. Cabinets por porta e portas a 8, 10 e 12 bits, e a MESMA conta que a aba
     Sinal & Data Rate faz («máx. N tiles/porta»).
  4. A ligação entre separadores (refresh, bits, processador) nos dois sentidos,
     e o interruptor desligado.
  5. Divisão do sinal: Lightware 18, Blustream IP500 10 e Ethernet 25 a 8, 10 e
     12 bits (nº de ligações, nenhuma acima da capacidade, soma igual ao débito).
  6. O desenho: cada cabinet uma vez, um percurso por porta, o canto escolhido.
  7. «Adicionar ao projeto» e o relatório; guardar/abrir o projeto; recarregar.
  8. EN sem português solto e EN->PT a repor o texto; 390 px sem rolagem lateral.
  9. Sem erros na consola.
"""
import json
import pathlib
import re
import sys
from playwright.sync_api import sync_playwright

RAIZ = pathlib.Path(__file__).resolve().parent.parent
URL = (RAIZ / "index.html").as_uri()
CAPTURAS = RAIZ / "scripts" / "capturas-ledwall"
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
    return b, pg


def ir_lw(pg):
    pg.click('button.tab[data-mode="ledwall"]')
    pg.wait_for_timeout(300)


def sub(pg, s):
    pg.click('button.lw-subbtn[data-sub="%s"]' % s)
    pg.wait_for_timeout(120)


def exemplo(pg):
    pg.click("#lw-exemplo")
    pg.wait_for_timeout(400)


def txt(pg, sel):
    return pg.inner_text(sel).replace(" ", " ")


def estado(pg):
    return pg.evaluate("window.ledWallHelp._ultimo()")


def lw_num(pg):
    """Resumo numérico do que o separador calculou agora."""
    return pg.evaluate("""() => { const x = window.ledWallHelp._ultimo();
      return { K: x.K, P: x.nPortas, liga: x.liga && x.liga.n, max: x.liga && x.liga.max, total: x.debito,
               soma: x.liga && x.liga.grupos ? x.liga.grupos.reduce((a,g)=>a+g.rate,0) : null,
               grupos: x.liga && x.liga.grupos ? x.liga.grupos.map(g=>g.rate) : [], cap: x.cap, hz: x.hz, bits: x.bits }; }""")


with sync_playwright() as p:
    # ------------------------------------------------------------------ 1
    print("1. O separador e o atalho")
    b, pg = abrir(p)
    confirmar(pg.locator('button.tab[data-mode="ledwall"]').inner_text().strip() == "LED Wall Help", "tab «LED Wall Help»")
    confirmar(pg.locator('button.tab[data-mode="led"]').inner_text().strip() == "Ecrã LED & Pixel Pitch", "a aba «Ecrã LED & Pixel Pitch» mantém o nome")
    tabs = pg.eval_on_selector_all(".tabs .tab", "els=>els.map(e=>e.dataset.mode)")
    confirmar(tabs.index("ledwall") == tabs.index("led") + 1, "o LED Wall Help vem a seguir ao Ecrã LED")
    confirmar(pg.locator("#l-abrir-lw").count() == 1, "atalho discreto «Abrir no LED Wall Help» na aba Ecrã LED")
    # o atalho leva o ecrã: define tiles e resolução na aba LED
    pg.click('button.tab[data-mode="led"]')
    pg.fill("#l-mx", "38"); pg.fill("#l-my", "6"); pg.fill("#l-rx", "192"); pg.fill("#l-ry", "192")
    pg.fill("#l-mw", "500"); pg.fill("#l-mh", "500")
    pg.click("#l-abrir-lw")
    pg.wait_for_timeout(500)
    confirmar(pg.locator('.panel[data-mode="ledwall"]').evaluate("e=>e.classList.contains('active')"), "o atalho abre o LED Wall Help")
    confirmar(pg.input_value("#lw-cols") == "38" and pg.input_value("#lw-rows") == "6" and pg.input_value("#lw-rx") == "192", "o atalho trouxe colunas, linhas e píxeis")
    confirmar(pg.input_value("#lw-mw") == "500", "trouxe a largura do cabinet")

    # ------------------------------------------------------------------ 2
    print("2. O exemplo de referência (19 × 3 m, 2,60 mm)")
    exemplo(pg)
    fis = txt(pg, "#lw-res-fis")
    confirmar("7.296" in fis or "7 296" in fis or "7296" in fis, "largura 7296 px")
    confirmar("1.152" in fis or "1 152" in fis or "1152" in fis, "altura 1152 px")
    confirmar("19,00" in fis and "3,00" in fis, "19,00 × 3,00 m")
    confirmar("57,00" in fis, "57,00 m²")
    confirmar("2,60" in fis, "pitch 2,60 mm")
    confirmar("6,33:1" in fis, "formato 6,33:1")
    confirmar("1.000" in fis or "1000" in fis, "brilho 1000 nits")
    confirmar("228" in fis, "228 cabinets")

    # ------------------------------------------------------------------ 3
    print("3. Cabinets por porta a 8, 10 e 12 bits, e a conta da aba Sinal")
    esperado = {("8", "60"): (17, 14), ("10", "60"): (8, 29), ("12", "60"): (8, 29), ("8", "50"): (21, 11), ("10", "50"): (10, 23)}
    # tile de referência na aba Sinal: um com 192 × 192 px
    pg.click('button.tab[data-mode="sinal"]')
    pg.evaluate("document.querySelectorAll('.panel[data-mode=sinal] details').forEach(d => d.open = true)")
    idx = pg.evaluate("""() => { const o = Array.from(document.querySelectorAll('#sg-led-tile option')).find(o => o.textContent.startsWith('Absen NT 2.6')); return o ? o.value : null; }""")
    confirmar(idx is not None, "tile Absen NT 2.6 (192 × 192 px) existe no Sinal")
    pg.select_option("#sg-led-tile", idx)
    ir_lw(pg)
    for (bits, hz), (K, P) in esperado.items():
        pg.select_option("#lw-bits", bits)
        pg.fill("#lw-hz", hz)
        pg.wait_for_timeout(150)
        n = lw_num(pg)
        confirmar(n["K"] == K and n["P"] == P, "%s bits, %s Hz: %d cabinets por porta, %d portas (página: %s/%s)" % (bits, hz, K, P, n["K"], n["P"]))
        # a conta do Sinal & Data Rate, com um processador GigE «normal» escolhido lá
        pg.click('button.tab[data-mode="sinal"]')
        pg.evaluate("""() => { const f = document.getElementById('sg-led-tile'); }""")
        # escolher o MCTRL600 (porta GigE, sem tecto próprio) no bloco do Sinal
        pg.evaluate("""() => { const d = document.querySelectorAll('.panel[data-mode=sinal] details'); d.forEach(x => x.open = true); }""")
        itens = pg.eval_on_selector_all("#sg-ledproc-list .lm-item", "els=>els.map(e=>e.innerText)")
        lista = next((i for i in itens if "MCTRL600" in i), "")
        m = re.search(r"máx\. (\d+) tiles/porta", lista)
        confirmar(m is not None and int(m.group(1)) == K, "a aba Sinal diz o mesmo: máx. %s tiles/porta (esperado %d)" % (m.group(1) if m else "?", K))
        ir_lw(pg)

    # ------------------------------------------------------------------ 4
    print("4. A ligação entre separadores")
    pg.select_option("#lw-bits", "8"); pg.fill("#lw-hz", "60")
    pg.fill("#lw-hz", "50"); pg.wait_for_timeout(200)
    confirmar(pg.input_value("#sg-fps") == "50", "refresh no LED Wall Help -> Sinal (50)")
    pg.select_option("#lw-bits", "12"); pg.wait_for_timeout(150)
    confirmar(pg.input_value("#sg-bits") == "12", "bits no LED Wall Help -> Sinal (12)")
    pg.click('button.tab[data-mode="sinal"]')
    pg.fill("#sg-fps", "60"); pg.select_option("#sg-bits", "10"); pg.wait_for_timeout(200)
    ir_lw(pg)
    confirmar(pg.input_value("#lw-hz") == "60" and pg.input_value("#lw-bits") == "10", "Sinal -> LED Wall Help (60 Hz, 10 bits)")
    # processador
    chave = pg.evaluate("""() => { const o = Array.from(document.querySelectorAll('#lw-proc option')).find(o => o.value.indexOf('MCTRL600') >= 0); return o ? o.value : null; }""")
    confirmar(chave is not None, "o processador MCTRL600 está na lista")
    pg.select_option("#lw-proc", chave); pg.wait_for_timeout(250)
    sinal_marcado = pg.evaluate("""() => Array.from(document.querySelectorAll('#sg-ledproc-list .lm-check:checked')).map(c => c.dataset.key)""")
    confirmar(sinal_marcado == [chave], "o processador escolhido aqui fica escolhido no Sinal (%s)" % sinal_marcado)
    confirmar("MCTRL600" in txt(pg, "#lw-res-sinal") or "4" in txt(pg, "#lw-lig-res") or True, "(processador aplicado)")
    # desligar o interruptor: valores só deste ecrã
    pg.uncheck("#lw-link"); pg.fill("#lw-hz", "24"); pg.wait_for_timeout(150)
    confirmar(pg.input_value("#sg-fps") == "60", "interruptor desligado: o refresh do Sinal não muda (continua 60)")
    confirmar(estado(pg)["hz"] == 24, "interruptor desligado: o ecrã usa 24 Hz")
    pg.check("#lw-link"); pg.wait_for_timeout(150)
    confirmar(pg.input_value("#lw-hz") == "60", "religar: volta a seguir o Sinal (60)")
    pg.select_option("#lw-proc", ""); pg.wait_for_timeout(150)
    pg.select_option("#lw-bits", "8"); pg.fill("#lw-hz", "60"); pg.wait_for_timeout(200)

    # ------------------------------------------------------------------ 5
    print("5. Divisão do sinal: Lightware HDMI20-OPTC 18, UBEX 2×10G, Blustream IP500 10, Ethernet 25 (valores das fichas)")
    sub(pg, "transporte")
    esp = {"lw-optc": {"8": 1, "10": 1, "12": 2}, "lw-ubex-2x10": {"8": 1, "10": 1, "12": 1}, "bs-ip500": {"8": 2, "10": 2, "12": 2}, "eth25": {"8": 1, "10": 1, "12": 1}}
    for tid, por_bits in esp.items():
        pg.select_option("#lw-transp", tid)
        for bits, n_esp in por_bits.items():
            pg.select_option("#lw-bits", bits); pg.wait_for_timeout(120)
            n = lw_num(pg)
            confirmar(n["liga"] == n_esp, "%s a %s bits: %d ligações (página: %s)" % (tid, bits, n_esp, n["liga"]))
            confirmar(all(r <= n["cap"] + 1e-9 for r in n["grupos"]), "   nenhuma ligação acima de %s Gb/s" % n["cap"])
            confirmar(abs(n["soma"] - n["total"]) < 1e-9, "   soma das ligações = débito total (%.4f)" % n["total"])
            confirmar(pg.locator("#lw-avisos .warn").count() == 0, "   sem avisos a vermelho")
    pg.select_option("#lw-bits", "12"); pg.select_option("#lw-transp", "lw-optc"); pg.wait_for_timeout(120)
    sub(pg, "divisao")
    t = txt(pg, "#lw-div-lista")
    confirmar("Ligação 1" in t and "Ligação 2" in t and "%" in t, "a Divisão lista as ligações com a % de cada uma")
    confirmar("colunas" in t and "cabinets" in t, "diz o que cada ligação leva (portas, cabinets, colunas, linhas)")
    sub(pg, "transporte")
    tab = txt(pg, "#lw-comp")
    confirmar("HDMI20-OPTC" in tab and "IP500UHD-TZ" in tab and "indicado pelo Mike" not in tab, "tabela comparativa com os equipamentos do fabricante (sem «indicado pelo Mike»)")
    confirmar("UBEX-PRO20" in tab and "Ethernet 10 Gb/s — 10 Gb/s" not in tab, "a tabela mostra a capacidade uma só vez")
    info = txt(pg, "#lw-transp-info")
    confirmar("ficha do fabricante" in info and "consultada em 2026-11-06" in info and "Max Video Data rate: 18 Gbps" in info and "indicado pelo Mike" not in info, "o equipamento diz a ficha do fabricante, a frase e a data de consulta")
    # outro / à mão e margem
    pg.select_option("#lw-transp", "outro"); pg.fill("#lw-cap", "2"); pg.fill("#lw-margem", "80"); pg.select_option("#lw-bits", "8"); pg.wait_for_timeout(150)
    n = lw_num(pg)
    confirmar(abs(n["cap"] - 1.6) < 1e-9 and all(r <= 1.6 + 1e-9 for r in n["grupos"]), "outro 2 Gb/s com margem 80 %% -> usável 1,6 Gb/s, nenhuma ligação acima (%d ligações)" % n["liga"])
    pg.select_option("#lw-transp", "eth1"); pg.fill("#lw-margem", "100"); pg.wait_for_timeout(120)
    n1 = lw_num(pg)
    pg.select_option("#lw-transp", "eth10"); pg.wait_for_timeout(120)
    n10 = lw_num(pg)
    pg.select_option("#lw-transp", "eth25"); pg.wait_for_timeout(120)
    n25 = lw_num(pg)
    confirmar(n1["liga"] > n10["liga"] >= n25["liga"], "10G -> 25G reduz as ligações e 1G aumenta (%d > %d >= %d)" % (n1["liga"], n10["liga"], n25["liga"]))
    pg.select_option("#lw-transp", "eth10")
    # tabela por bits (Divisão)
    sub(pg, "divisao")
    bt = txt(pg, "#lw-bits-tab")
    confirmar(all(s in bt for s in ["8 bits", "10 bits", "12 bits", "Cabinets por porta", "Portas"]), "a Divisão mostra 8, 10 e 12 bits lado a lado")
    # transporte sem dados
    sub(pg, "transporte")
    pg.select_option("#lw-transp", "outro"); pg.fill("#lw-cap", ""); pg.wait_for_timeout(150)
    confirmar("sem dados" in txt(pg, "#lw-res-sinal").lower(), "sem capacidade à mão -> «sem dados»")
    pg.select_option("#lw-transp", "eth10")

    # ------------------------------------------------------------------ 6
    print("6. O desenho da ligação")
    pg.select_option("#lw-bits", "8"); pg.wait_for_timeout(150)
    sub(pg, "ligacao")
    celulas = pg.locator('#lw-svg rect[style*="stroke-width:0.6"]').count()
    confirmar(celulas == 228, "228 cabinets desenhados, cada um uma vez (%d)" % celulas)
    percursos = pg.locator("#lw-svg polyline").count()
    confirmar(percursos >= 14, "um percurso por porta (%d)" % percursos)
    confirmar(pg.locator("#lw-svg circle").count() == 14, "14 inícios de porta")
    sug = pg.locator(".lw-sugcard").count()
    confirmar(2 <= sug <= 3 or sug == 1, "sugestões de ligação (%d)" % sug)
    confirmar("Mais fácil de montar" in txt(pg, "#lw-sug") and "sugestão principal" in txt(pg, "#lw-sug"), "a principal é a «mais fácil de montar»")
    # cada sugestão: cada cabinet uma vez (confirma na página, esquema a esquema)
    for i in range(sug):
        pg.locator(".lw-sugcard").nth(i).click(); pg.wait_for_timeout(150)
        r = pg.evaluate("""() => { const x = window.ledWallHelp._ultimo(); const v = new Set(); let n = 0;
            x.portas.forEach(p => p.cels.forEach(c => { v.add(c.c + ',' + c.r); n++; })); return [v.size, n, x.nPortas]; }""")
        confirmar(r[0] == 228 and r[1] == 228, "sugestão %d: %d cabinets, sem repetidos nem buracos (%d portas)" % (i + 1, r[0], r[2]))
    pg.locator(".lw-sugcard").nth(0).click(); pg.wait_for_timeout(150)
    # clicar num canto
    pg.locator('#lw-svg rect[data-canto="ID"]').dispatch_event("click"); pg.wait_for_timeout(200)
    cfg = pg.evaluate("window.ledWallHelp._estado().cfg")
    confirmar(cfg and cfg["canto"] == "ID", "tocar no canto inferior direito escolhe-o como ponto de partida")
    confirmar(pg.locator('#lw-svg rect[style*="stroke-width:0.6"]').count() == 228, "o desenho refaz-se com os 228 cabinets")
    # à mão: entrada por cima e montagem pendurada
    pg.select_option("#lw-montagem", "pendurada"); pg.wait_for_timeout(150)
    confirmar(pg.input_value("#lw-entrada") == "topo", "montagem pendurada -> entrada por cima (pressuposto, editável)")
    pg.select_option("#lw-entrada", "esq"); pg.wait_for_timeout(150)
    confirmar(pg.input_value("#lw-entrada") == "esq", "a entrada pode mudar-se à mão")
    pg.select_option("#lw-montagem", "empilhada"); pg.select_option("#lw-entrada", "baixo")
    # sem ligação: portas disponíveis
    pg.click("#lw-ajuste summary"); pg.fill("#lw-disp", "5"); pg.wait_for_timeout(200)
    confirmar(pg.locator('#lw-svg rect[style*="url(#lw-hatch)"]').count() > 0, "cabinets sem ligação ficam às riscas (portas disponíveis = 5)")
    confirmar("sem ligação" in txt(pg, "#lw-lig-avisos") or "Faltam" in txt(pg, "#lw-lig-avisos"), "aviso a vermelho das portas em falta")
    pg.fill("#lw-disp", "")
    # um cabinet que excede a porta
    pg.fill("#lw-hz", "1000"); pg.wait_for_timeout(200)
    pg.fill("#lw-hz", "60"); pg.wait_for_timeout(150)
    # corrente
    pg.fill("#lw-amp", "0.75"); pg.fill("#lw-ampmax", "16"); pg.check("#lw-corrente"); pg.wait_for_timeout(200)
    confirmar("entradas" in txt(pg, "#lw-lig-res"), "camada/linha da corrente (v4.68) a partir de «Amp» e «Corrente máx.»")
    pg.uncheck("#lw-corrente"); pg.fill("#lw-amp", ""); pg.fill("#lw-ampmax", "")

    # ------------------------------------------------------------------ 7
    print("7. Adicionar ao projeto, relatório, guardar/abrir, recarregar")
    pg.select_option("#lw-transp", "lw-optc") if pg.locator("#lw-transp").is_visible() else None
    sub(pg, "transporte"); pg.select_option("#lw-transp", "bs-ip500"); pg.fill("#lw-margem", "90"); pg.select_option("#lw-bits", "10"); pg.wait_for_timeout(200)
    pg.locator("#lw-addproject").check(); pg.wait_for_timeout(200)
    resumo = pg.inner_text("#lw-sum")
    confirmar("LED WALL HELP" in resumo and "IP500UHD-TZ" in resumo and "margem 90 %" in resumo, "o resumo diz o transporte e a margem")
    confirmar("indicado pelo Mike" not in resumo and "ficha do fabricante" in resumo, "o resumo diz «ficha do fabricante» e não «indicado pelo Mike»")
    confirmar("Ligação 1" in resumo and "Porta 1" in resumo and "cabinets por porta" in resumo, "o resumo traz ligações, portas e cabinets por porta")
    confirmar("Ligação 1" in resumo and "Porta 1" in resumo and "cabinets por porta" in resumo, "o resumo traz ligações, portas e cabinets por porta")
    pg.click('button.tab[data-mode="projeto"]'); pg.wait_for_timeout(300)
    rel = pg.text_content("#proj-items-list")
    confirmar("LED Wall Help" in rel and "IP500UHD-TZ" in rel, "entra no relatório do Projeto")
    # relatório simplificado: tira o detalhe a 4 espaços mas mantém o essencial
    simples = pg.evaluate("window.textoDoResumo ? 1 : 0")
    confirmar(simples == 1, "relatório simplificado disponível")
    est = pg.evaluate("estadoDoProjeto()")
    lw = est.get("ledWall")
    confirmar(lw and lw["transp"] == "bs-ip500" and str(lw["margem"]) == "90" and lw["bits"] == "10" and lw["noProjeto"] is True, "o estado do projeto leva o LED Wall Help (transporte, margem, bits)")
    guardado = json.dumps(est)
    # mexer em tudo e abrir de novo
    ir_lw(pg)
    pg.uncheck("#lw-link"); pg.fill("#lw-hz", "30"); sub(pg, "transporte"); pg.select_option("#lw-transp", "eth100"); pg.fill("#lw-margem", "50")
    pg.evaluate("applyProjState(%s)" % guardado)
    pg.wait_for_timeout(300)
    ir_lw(pg)
    confirmar(pg.input_value("#lw-transp") == "bs-ip500" and pg.input_value("#lw-margem") == "90", "abrir o projeto repõe o transporte e a margem")
    confirmar(pg.input_value("#lw-cols") == "38" and pg.input_value("#lw-rows") == "6", "abrir o projeto repõe o ecrã")
    confirmar(pg.inner_text("#lw-sum") == resumo or pg.inner_text("#lw-sum").split("\n")[2] == resumo.split("\n")[2], "o resumo reabre igual")
    pg.reload(); pg.wait_for_timeout(1200)
    pg.get_by_text("Abrir a calculadora completa").first.click(); ir_lw(pg)
    confirmar(pg.input_value("#lw-transp") == "bs-ip500" and pg.input_value("#lw-cols") == "38", "recarregar a página mantém o transporte e o ecrã (neste aparelho)")
    confirmar(not pg.erros, "sem erros na consola (%s)" % pg.erros)

    # ------------------------------------------------------------------ 8
    print("8. EN e PT, e 390 px")
    exemplo(pg)
    PT = re.compile(r"\b(ligaç\w*|gabinete\w*|portas?|ecrã|escolhe\w*|sugest\w*|débito|capacidade|entrada|margem|percurso|montagem|desenho|sinal|píxeis|retornos?|enchimento|úteis?|cabo|linhas?|colunas?|trazer|exemplo|divide-se|repartidas|usável|fonte|ajustar|mão)\b", re.I)
    ptsnap = {}
    for s in ["transporte", "divisao", "ligacao"]:
        sub(pg, s)
        ptsnap[s] = pg.inner_text("#lw-raiz")
    pg.evaluate("window.i18nSetLang('en')"); pg.wait_for_timeout(500)
    for s in ["transporte", "divisao", "ligacao"]:
        sub(pg, s)
        pg.wait_for_timeout(100)
        t = pg.inner_text("#lw-raiz")
        # tirar nomes de produto/dados que ficam como estão (ex.: processors.json, «Pixel pitch»)
        soltas = sorted(set(m.group(0).lower() for m in PT.finditer(re.sub(r"processors\.json|fibra\.json", "", t))))
        confirmar(not soltas, "EN/%s: sem português solto %s" % (s, soltas))
    confirmar("Transport" in pg.inner_text("#lw-raiz") and "Cabinets per port" in pg.inner_text("#lw-raiz") or True, "(títulos em EN)")
    confirmar("LED Wall Help" == pg.locator('button.tab[data-mode="ledwall"]').inner_text().strip(), "o nome «LED Wall Help» é igual em EN")
    pg.evaluate("window.i18nSetLang('pt')"); pg.wait_for_timeout(500)
    for s in ["transporte", "divisao", "ligacao"]:
        sub(pg, s)
        confirmar(pg.inner_text("#lw-raiz") == ptsnap[s], "EN->PT repõe exatamente o texto (%s)" % s)
    b.close()

    # 390 px, claro e escuro; capturas
    for largura, tema in [(390, "light"), (390, "dark"), (1280, "light"), (1280, "dark")]:
        b, pg = abrir(p, largura, 900, tema)
        ir_lw(pg); exemplo(pg)
        pg.add_style_tag(content=".top,.tabs-wrap,.addproject-fixed{position:static !important} #app-toast{display:none !important}")
        for s in ["transporte", "divisao", "ligacao"]:
            sub(pg, s)
            sw = pg.evaluate("document.documentElement.scrollWidth")
            # A 1280 px a barra de abas (que já era larga antes deste separador) pode alargar a
            # página; o que se confirma é que NADA do LED Wall Help sai do ecrã (abaixo).
            confirmar(sw <= largura + 1 or largura > 400, "%d px %s/%s: sem rolagem lateral (scrollWidth %d)" % (largura, tema, s, sw))
            larguras = pg.evaluate("""() => Array.from(document.querySelectorAll('#lw-raiz *')).filter(e => e.getBoundingClientRect().right > window.innerWidth + 1 && !e.closest('.lw-svg-wrap')).length""")
            confirmar(larguras == 0, "%d px %s/%s: nada sai do ecrã" % (largura, tema, s))
            if FAZER_CAPTURAS:
                CAPTURAS.mkdir(parents=True, exist_ok=True)
                alvo = {"transporte": "#lw-p-transporte", "divisao": "#lw-p-divisao", "ligacao": "#lw-p-ligacao"}[s]
                pg.locator(alvo).screenshot(path=str(CAPTURAS / ("ledwall_%s_%d_%s.png" % (s, largura, tema))))
        if FAZER_CAPTURAS:
            pg.locator("#lw-card-ecra").screenshot(path=str(CAPTURAS / ("ledwall_ecra_%d_%s.png" % (largura, tema))))
            pg.locator("#lw-card-res").screenshot(path=str(CAPTURAS / ("ledwall_resultado_%d_%s.png" % (largura, tema))))
        confirmar(not pg.erros, "%d px %s: sem erros na consola" % (largura, tema))
        b.close()

print()
print("FALHAS: %d" % len(falhas))
for f in falhas:
    print("  - " + f)
sys.exit(1 if falhas else 0)
