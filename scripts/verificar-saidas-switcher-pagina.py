"""Verificação, na página a sério, de «Saídas a usar (N)» (aba Sinal & Data Rate).

    python scripts/verificar-saidas-switcher-pagina.py [pasta-da-versao-antiga]

Precisa de `pip install playwright` e do Microsoft Edge instalado (canal msedge).
Abre o index.html por file:// (com --allow-file-access-from-files, senão o
browser não deixa a página ler data/*.json).

O que confirma:
  1. REGRESSÃO — sem N, tudo o que a aba já mostrava fica igual. Se for dada a
     pasta de uma versão antiga (ex: `git archive origin/main | tar -x -C velho`),
     compara lista de switchers, cartões (Entrada/Saída/Capacidade) e relatório
     com essa versão, cenário a cenário.
  2. Contas feitas à mão (ver CASOS) contra o que a página escreve.
  3. Sem erros na consola (a chamada ao Worker /uso por file:// é ignorada).
  4. A 400 px de largura não há rolagem horizontal.
  5. Tradução: em EN não fica português na secção nova, e EN->PT repõe o texto.
"""
import re
import sys
import pathlib
from playwright.sync_api import sync_playwright

RAIZ = pathlib.Path(__file__).resolve().parent.parent
NOVO = (RAIZ / "index.html").as_uri()
VELHO = (pathlib.Path(sys.argv[1]).resolve() / "index.html").as_uri() if len(sys.argv) > 1 else None

falhas = []


def confirmar(cond, msg):
    print(("  ok   " if cond else "  FALHA ") + msg)
    if not cond:
        falhas.append(msg)


def abrir(p, url, largura=1000, altura=900):
    b = p.chromium.launch(channel="msedge", headless=True, args=["--allow-file-access-from-files"])
    ctx = b.new_context(service_workers="block", viewport={"width": largura, "height": altura})
    pg = ctx.new_page()
    pg.erros = []

    def na_consola(m):
        if m.type == "error" and "/uso" not in m.text and "ERR_FAILED" not in m.text:
            pg.erros.append(m.text[:200])
    pg.on("console", na_consola)
    pg.on("pageerror", lambda e: pg.erros.append("PAGEERROR " + str(e)))
    pg.goto(url)
    pg.wait_for_timeout(1200)
    pg.get_by_text("Abrir a calculadora completa").first.click()
    pg.wait_for_timeout(300)
    pg.click('button.tab[data-mode="sinal"]')
    pg.evaluate("document.querySelectorAll('.panel[data-mode=sinal] details').forEach(d=>d.open=true)")
    return b, pg


def sinal(pg, h, v, fps, bits=8):
    pg.fill("#sg-h", str(h))
    pg.fill("#sg-v", str(v))
    pg.fill("#sg-fps", str(fps))
    pg.select_option("#sg-bits", str(bits))
    # Tirar o foco do campo: o «change» que dispara ao sair dele refaz os cartões
    # e, se o clique seguinte for num botão dos cartões, o clique perdia-se.
    pg.evaluate("document.activeElement && document.activeElement.blur()")
    pg.wait_for_timeout(250)


def escolher(pg, modelo):
    """Marca um switcher pelo nome exacto do modelo (abre a lista completa se estiver fechada)."""
    mais = pg.locator("#sg-switcher-showmore")
    if mais.count() and "outro" in mais.inner_text():
        mais.click()
        pg.wait_for_timeout(150)
    lab = pg.locator("#sg-switcher-mp-list label.lm-checkitem").filter(
        has=pg.locator(".lm-model", has_text=re.compile("^" + re.escape(modelo) + "$")))
    lab.first.locator("input").check()
    pg.wait_for_timeout(250)


def cartoes(pg):
    """Só as linhas antigas dos cartões (Entrada/Saída/Capacidade), sem a caixa nova."""
    return pg.evaluate("""() => [...document.querySelectorAll('#sg-switcher-detail .sinal-detail-card')].map(c =>
        c.querySelector('h3').innerText + ' | ' + [...c.querySelectorAll(':scope > .sinal-detail-row')].map(r => r.innerText.replace(/\\s+/g,' ')).join(' | '))""")


def relatorio_antigo(pg):
    """O relatório sem o bloco novo «Saídas a usar» (que só o novo tem)."""
    t = pg.inner_text("#sg-sum") if False else pg.evaluate("document.getElementById('sg-sum').textContent")
    return re.sub(r"Saídas a usar.*?(?=Processo de LED escolhido:)", "", t, flags=re.S)


def lista(pg):
    return pg.inner_text("#sg-switcher-mp-list")


# ---------------------------------------------------------------- regressão
CENARIOS = [
    ("3840x1080@60, nada escolhido", (3840, 1080, 60), []),
    ("3840x1080@60, E2", (3840, 1080, 60), ["E2"]),
    ("3840x1080@60, E2 + S3-4K", (3840, 1080, 60), ["E2", "S3-4K"]),
    ("7680x2160@60, E2 Gen2 + P80", (7680, 2160, 60), ["E2 Gen2", "P80"]),
    ("5760x1080@50, Spyder X20 + P20-DS", (5760, 1080, 50), ["Spyder X20", "P20-DS"]),
]


def regressao(p):
    print("\n[1] Regressão: sem N tudo igual ao que era")
    if not VELHO:
        print("  (sem pasta da versão antiga — a comparação foi saltada)")
        return
    for nome, (h, v, fps), escolhas in CENARIOS:
        res = []
        for url in (VELHO, NOVO):
            b, pg = abrir(p, url)
            sinal(pg, h, v, fps)
            for m in escolhas:
                escolher(pg, m)
            res.append((lista(pg), cartoes(pg), relatorio_antigo(pg)))
            b.close()
        confirmar(res[0][0] == res[1][0], nome + ": lista de switchers igual")
        confirmar(res[0][1] == res[1][1], nome + ": cartões (Entrada/Saída/Capacidade) iguais")
        confirmar(res[0][2] == res[1][2], nome + ": relatório antigo igual")


# ------------------------------------------------------------- contas à mão
def cvt(h, v, fps):
    hp = (1e6 / fps - 460) / v
    vbl = max(int(460 / hp) + 1, 15)
    return fps * (v + vbl) * (h + 80) / 1e6


def par(n):
    import math
    r = math.ceil(n)
    return r if r % 2 == 0 else r + 1


def canvas_max(asp_h, asp_v, n, fps, mhz, cap_mp):
    """Referência feita de outra maneira: varrimento linear de baixo para cima."""
    por_larg = asp_h >= asp_v
    melhor = None
    w = 2
    while w < 80000:
        h = max(2, 2 * int(w * asp_v / asp_h / 2))
        if w * h > cap_mp * 1e6:
            break
        pw, ph = (par(w / n), h) if por_larg else (w, par(h / n))
        if cvt(pw, ph, fps) > mhz + 0.05:
            break
        melhor = (w, h)
        w += 2
    return melhor


def fmt_int(n):
    return f"{n:,}".replace(",", " ") if n >= 10000 else str(n)


def contas(p):
    print("\n[2] Contas à mão, contra a página")
    b, pg = abrir(p, NOVO)
    sinal(pg, 3840, 1080, 60)
    escolher(pg, "E2")
    caixa = pg.inner_text("#sg-switcher-detail")

    # Caso A: Barco E2, 16 saídas (todas), 3840x1080@60.
    #  capacidade PGM 40 MP -> útil 36 MP;  W^2 * 9/32 = 36e6  ->  W = 11313,7  ->  11312 x 3180
    esperado = canvas_max(3840, 1080, 16, 60, 330, 36)
    print("  A) referência E2/16 saídas:", esperado)
    confirmar(esperado == (11312, 3180), "A) conta à mão: 11312x3180 (limite: capacidade)")
    confirmar("11312×3180px" in caixa.replace(" ", "").replace(" ", ""), "A) a página mostra 11312×3180px")
    confirmar("Saídas a usar: todas (16)" in caixa, "A) título «todas (16)»")
    confirmar("limitada pela capacidade" in caixa, "A) limitada pela capacidade")
    confirmar("✔ Cabe" in caixa, "A) o sinal 3840×1080 cabe (1 ligação, 261,3 MHz <= 330)")

    # Caso B: o mesmo E2 com N=2 — agora manda o pixel clock da ligação (330 MHz)
    pg.fill("#sg-saidas", "2")
    pg.wait_for_timeout(250)
    caixa = pg.inner_text("#sg-switcher-detail")
    esperado = canvas_max(3840, 1080, 2, 60, 330, 36)
    print("  B) referência E2/2 saídas:", esperado)
    texto = caixa.replace(" ", "").replace(" ", "")
    confirmar(f"{esperado[0]}×{esperado[1]}px" in texto, f"B) a página mostra {esperado[0]}×{esperado[1]}px")
    confirmar("Saídas a usar: 2/16" in caixa, "B) título «2/16»")
    confirmar("limitada pelo pixel clock" in caixa, "B) limitada pelo pixel clock")
    # independentes (2 ecrãs, 32:9): cada saída com 330 MHz e <= 18 MP (36/2)
    ref_ind = None
    w = 2
    while w < 80000:
        h = max(2, 2 * int(w * 1080 / 3840 / 2))
        if w * h > 18e6 or cvt(w, h, 60) > 330.05:
            break
        ref_ind = (w, h)
        w += 2
    print("  B) referência independentes (2 saídas):", ref_ind)
    confirmar(f"{ref_ind[0]}×{ref_ind[1]}px" in texto, f"B) por saída {ref_ind[0]}×{ref_ind[1]}px")

    # Caso C: 7680x2160@60 em E2 com N=2 não cabe (precisa de 4 ligações: 2 faixas de 3840 = 522 MHz > 330)
    sinal(pg, 7680, 2160, 60)
    caixa = pg.inner_text("#sg-switcher-detail")
    print("  C) 7680x2160@60 em E2, N=2: faixa 3840x2160 =", round(cvt(3840, 2160, 60), 1), "MHz; 4 faixas de 1920 =", round(cvt(1920, 2160, 60), 1), "MHz")
    confirmar(cvt(3840, 2160, 60) > 330 and cvt(2560, 2160, 60) > 330 and cvt(1920, 2160, 60) <= 330, "C) à mão: precisa de 4 ligações")
    confirmar("✘ Não cabe — requer 4 saídas" in caixa, "C) não cabe: requer 4 saídas")
    confirmar("requer pelo menos 4 saídas" in caixa, "C) sugestão: pelo menos 4 saídas")
    confirmar("Canvas contínuo: outros switchers que servem com 2 saídas" in caixa, "C) sugestão: outros switchers com 2 saídas")
    pg.fill("#sg-saidas", "4")
    pg.wait_for_timeout(250)
    caixa = pg.inner_text("#sg-switcher-detail")
    confirmar("Canvas contínuo — 4 saídas juntas num só ecrã" in caixa and "✔ Cabe — utiliza 4/4 saídas" in caixa, "C) com N=4 já cabe (utiliza 4/4)")

    # Caso D: N maior do que as saídas
    pg.fill("#sg-saidas", "40")
    pg.wait_for_timeout(250)
    caixa = pg.inner_text("#sg-switcher-detail")
    confirmar("Pediste 40 saídas, mas este switcher só tem 16" in caixa, "D) aviso: pediste 40, só tem 16")
    confirmar("Saídas a usar: 16/16" in caixa, "D) contas feitas com 16")

    # Caso E: valores inválidos
    for mau in ["0", "-3", "2.5"]:
        pg.fill("#sg-saidas", mau)
        pg.wait_for_timeout(200)
        hint = pg.inner_text("#sg-saidas-hint")
        confirmar("número inteiro" in hint, f"E) «{mau}» é inválido e avisa")
        confirmar("Saídas a usar: todas (16)" in pg.inner_text("#sg-switcher-detail"), f"E) «{mau}» conta como todas")
    pg.fill("#sg-saidas", "")
    pg.wait_for_timeout(200)
    confirmar("número inteiro" not in pg.inner_text("#sg-saidas-hint"), "E) vazio limpa o aviso")

    # Caso F: dois switchers -> comparação lado a lado
    sinal(pg, 3840, 1080, 60)
    escolher(pg, "S3-4K")
    pg.fill("#sg-saidas", "4")
    pg.wait_for_timeout(250)
    comp = pg.inner_text("#sg-saidas-comparacao")
    cabecas = pg.eval_on_selector_all("#sg-saidas-comparacao thead th", "e => e.map(x => x.innerText)")
    print("  F) comparação:", cabecas)
    confirmar(len(cabecas) == 3 and "Barco E2" in cabecas[1] and "Barco S3-4K" in cabecas[2], "F) uma coluna por switcher")
    # S3-4K: 300 MHz, 20 MP -> útil 18 MP
    ref_s3 = canvas_max(3840, 1080, 4, 60, 300, 18)
    print("  F) referência S3-4K/4 saídas:", ref_s3)
    confirmar(f"{ref_s3[0]}×{ref_s3[1]}px" in comp.replace(" ", "").replace(" ", ""), f"F) S3-4K na comparação: {ref_s3[0]}×{ref_s3[1]}px")

    # Caso G: um switcher que sai da lista (já não cobre) continua visível, com aviso
    sinal(pg, 12000, 6000, 30)   # 72 MP: o S3-4K (18 MP úteis) já não cobre
    det = pg.inner_text("#sg-switcher-detail")
    confirmar("já não cobre o total de píxeis" in det and "Tirar da escolha" in det, "G) S3-4K fica no detalhe, a dizer que já não cobre")
    while pg.get_by_text("Tirar da escolha").count():
        pg.get_by_text("Tirar da escolha").first.click()
        pg.wait_for_timeout(250)
    confirmar("já não cobre" not in pg.inner_text("#sg-switcher-detail"), "G) «Tirar da escolha» remove-os")

    # Caso H: PixelHUE P80 com modos de saída (sem pixel clock -> estimado «~»)
    sinal(pg, 3840, 1080, 60)
    escolher(pg, "P80")
    pg.fill("#sg-saidas", "10")
    pg.wait_for_timeout(250)
    det = pg.inner_text("#sg-switcher-detail")
    confirmar("Saídas a usar: 10/12" in det, "H) P80 modo Split: 10/12")
    confirmar("Sem pixel clock publicado" in det and "~" in det, "H) marcado como estimado (~)")
    pg.locator(".sinal-mode-select").select_option("1")   # modo Copy: 8 saídas
    pg.wait_for_timeout(250)
    det = pg.inner_text("#sg-switcher-detail")
    confirmar("Pediste 10 saídas, mas este switcher só tem 8" in det, "H) modo Copy: limitado a 8")

    # Relatório
    rel = pg.evaluate("document.getElementById('sg-sum').textContent")
    confirmar("Saídas a usar (N = 10):" in rel and "canvas contínuo: máx." in rel, "relatório inclui «Saídas a usar»")
    pg.click(".panel[data-mode=sinal] .rel-modo-btn[data-modo=simples]")
    simples = pg.evaluate("document.querySelector('.panel[data-mode=sinal] .sumbox-simples').textContent")
    confirmar("Saídas a usar (N = 10):" in simples, "relatório simplificado mantém a linha essencial")

    confirmar(not pg.erros, "sem erros na consola: " + str(pg.erros))
    b.close()


def estreito(p):
    print("\n[3] 400 px de largura: sem rolagem horizontal")
    b, pg = abrir(p, NOVO, 400, 900)
    sinal(pg, 3840, 1080, 60)
    escolher(pg, "E2")
    escolher(pg, "S3-4K")
    escolher(pg, "P80")
    pg.fill("#sg-saidas", "4")
    pg.wait_for_timeout(300)
    r = pg.evaluate("({sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, bw: document.body.scrollWidth})")
    print("  ", r)
    confirmar(r["sw"] <= r["cw"] and r["bw"] <= r["cw"], "sem rolagem horizontal da página (3 switchers escolhidos, com comparação)")
    pg.locator("#sg-saidas-comparacao").scroll_into_view_if_needed()
    pg.screenshot(path=str(pathlib.Path(sys.argv[2]) / "estreito.png") if len(sys.argv) > 2 else "estreito.png", full_page=False)
    b.close()


def traducao(p):
    print("\n[4] Tradução PT/EN")
    b, pg = abrir(p, NOVO)
    sinal(pg, 3840, 1080, 60)
    escolher(pg, "E2")
    escolher(pg, "S3-4K")
    escolher(pg, "P80")
    pg.fill("#sg-saidas", "4")
    pg.wait_for_timeout(300)
    sel = "#sg-saidas-comparacao, #sg-switcher-detail, #sg-saidas-hint"
    pt = pg.evaluate("(s) => [...document.querySelectorAll(s)].map(e => e.innerText).join('\\n')", sel)
    # Só o bloco novo do relatório: as notas antigas dos switchers já não voltam
    # iguais de EN para PT na versão de antes, não é desta funcionalidade.
    bloco = ("(function(){var t=document.getElementById('sg-sum').textContent;var m=t.match(/Saídas a usar|Outputs to use/);"
             "var f=t.indexOf('Processo de LED escolhido:');return t.slice(m.index, f>0?f:undefined)})()")
    rel_pt = pg.evaluate(bloco)
    pg.click('#lang-toggle .seg-btn[data-lang="en"]')
    pg.wait_for_timeout(500)
    en = pg.evaluate("(s) => [...document.querySelectorAll(s)].map(e => e.innerText).join('\\n')", sel)
    achados = pg.evaluate("""() => window.i18nPorTraduzir(document.querySelector('.panel[data-mode=sinal]'))
        .filter(a => /Sa[ií]das a usar|saídas|ecrãs|canvas|capacidade|cabe|sinal|switcher/i.test(a.texto) && !/(^|\\s)(Switcher|Modo avan)/.test(a.texto))""")
    # (innerText: o textContent do relatório devolve sempre o PT de origem — ver js/relatorio-simples.js)
    rel_en = pg.evaluate(bloco.replace("textContent", "innerText"))
    confirmar("Outputs to use" in rel_en and not re.search(r"Pediste|requer|utiliza|saídas|canvas contínuo|ecrãs independentes|o sinal cabe|Sugestão|Capacidade|Possibilidade", rel_en),
              "EN: o bloco novo do relatório fica em inglês")
    ficou = [a["texto"][:110] for a in achados]
    print("  EN amostra:", en.split("\n")[0:3])
    restos = [t for t in ficou if re.search(r"Canvas|Ecrãs independentes|Saídas a usar|cabe|Pediste|requer|utiliza|ecrãs, um", t)]
    for t in restos[:8]:
        print("   por traduzir:", t)
    confirmar(not restos, "em EN não fica português na secção nova")
    confirmar("Continuous canvas" in en and "Independent screens" in en and "Outputs to use" in en, "EN: títulos traduzidos")
    pg.click('#lang-toggle .seg-btn[data-lang="pt"]')
    pg.wait_for_timeout(500)
    pt2 = pg.evaluate("(s) => [...document.querySelectorAll(s)].map(e => e.innerText).join('\\n')", sel)
    confirmar(pt2 == pt, "EN -> PT repõe exactamente o texto da secção")
    confirmar(pg.evaluate(bloco) == rel_pt, "EN -> PT repõe o bloco novo do relatório")
    confirmar(not pg.erros, "sem erros na consola: " + str(pg.erros))
    b.close()


def linhas_com_n(p):
    print("\n[5] Com N preenchido, a linha «Saída» e a lista também usam as saídas escolhidas")
    b, pg = abrir(p, NOVO)
    sinal(pg, 7680, 2160, 60)
    escolher(pg, "E2")
    sem_n = cartoes(pg)[0]
    pg.fill("#sg-saidas", "2")
    pg.evaluate("document.activeElement && document.activeElement.blur()")
    pg.wait_for_timeout(300)
    com_n = cartoes(pg)[0]
    print("  ", com_n.encode("ascii", "replace").decode())
    confirmar("de 16 saídas" in sem_n, "sem N: «Saída» conta com as 16 do switcher")
    confirmar("4 de 2 saídas" in com_n and "insuficiente" in com_n, "com N=2: «Saída» diz 4 de 2 e insuficiente")
    confirmar("2 saídas não chegam" in lista(pg), "com N=2: a lista diz que 2 saídas não chegam no E2")
    rel = pg.evaluate("document.getElementById('sg-sum').textContent")
    confirmar("saída: 4 de 2 saídas" in rel and "insuficiente" in rel, "com N=2: o relatório antigo também usa as 2 saídas")
    pg.fill("#sg-saidas", "8")
    pg.evaluate("document.activeElement && document.activeElement.blur()")
    pg.wait_for_timeout(300)
    confirmar("4 de 8 saídas" in cartoes(pg)[0] and "insuficiente" not in cartoes(pg)[0], "com N=8: «Saída» diz 4 de 8 e chega")
    confirmar(not pg.erros, "sem erros na consola: " + str(pg.erros))
    b.close()


with sync_playwright() as p:
    regressao(p)
    contas(p)
    estreito(p)
    traducao(p)
    linhas_com_n(p)

print("\n" + ("TUDO OK" if not falhas else f"{len(falhas)} FALHA(S):\n - " + "\n - ".join(falhas)))
sys.exit(1 if falhas else 0)
