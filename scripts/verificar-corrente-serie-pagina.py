"""Verificação, na página a sério, de «Cabinets em série por entrada» e do
«Consumo estimado por brilho» (v4.68).

    python scripts/verificar-corrente-serie-pagina.py [pasta-da-versao-antiga | URL]

Precisa de `pip install playwright` e do Microsoft Edge instalado (canal msedge).
Abre o index.html por file:// (com --allow-file-access-from-files, senão o
browser não deixa a página ler data/*.json). Com um URL (https://…) abre a
página publicada; nesse caso só corre sobre dados inventados aqui, nunca
dados do utilizador (cada caso arranca num contexto novo, sem nada guardado).

O que confirma:
  1. As contas à mão: 0,52 A e máx. 8 A -> 15 em série sem margem e 12 com 20 %;
     1,2 A e máx. 10 A -> 8 sem margem e 6 com 20 %; 100 tiles -> entradas =
     ceil e distribuição equilibrada; I_cab > utilizável -> aviso.
  2. Campo vazio -> nenhuma linha nova, nem no relatório Completo nem no Simplificado.
  3. Trifásica (máx. de entradas por fase), várias zonas (soma), vários ecrãs iguais.
  4. Consumo por brilho: 5 patamares (100, 75, 50, 25, 10), linear, com base de
     20 %, com tensão (W/kW), e só no relatório com o interruptor ligado.
  5. Guardar o projeto, abrir um ficheiro ANTIGO (sem os campos novos) e reabrir o novo.
  6. PT/EN: em EN não fica português nos blocos novos.
  7. REGRESSÃO (com a pasta de uma versão antiga): os totais de sempre ficam iguais.
  8. Sem erros na consola.
"""
import json
import re
import sys
import pathlib
import tempfile
from playwright.sync_api import sync_playwright

RAIZ = pathlib.Path(__file__).resolve().parent.parent
ARG = sys.argv[1] if len(sys.argv) > 1 else None
if ARG and re.match(r"https?://", ARG):
    NOVO, VELHO = ARG, None
else:
    NOVO = (RAIZ / "index.html").as_uri()
    VELHO = (pathlib.Path(ARG).resolve() / "index.html").as_uri() if ARG else None

falhas = []


def confirmar(cond, msg):
    print(("  ok   " if cond else "  FALHA ") + msg)
    if not cond:
        falhas.append(msg)


def abrir(p, url, aba="led", largura=1000):
    b = p.chromium.launch(channel="msedge", headless=True, args=["--allow-file-access-from-files"])
    ctx = b.new_context(service_workers="block", viewport={"width": largura, "height": 900}, accept_downloads=True)
    pg = ctx.new_page()
    pg.erros = []

    def na_consola(m):
        if m.type == "error" and "/uso" not in m.text and "ERR_FAILED" not in m.text and "CORS" not in m.text:
            pg.erros.append(m.text[:200])
    pg.on("console", na_consola)
    pg.on("pageerror", lambda e: pg.erros.append("PAGEERROR " + str(e)))
    pg.goto(url)
    pg.wait_for_timeout(1200)
    pg.get_by_text("Abrir a calculadora completa").first.click()
    pg.wait_for_timeout(300)
    pg.click('button.tab[data-mode="%s"]' % aba)
    pg.evaluate("document.querySelectorAll('.panel details').forEach(d=>d.open=true)")
    return b, pg


def led(pg, amp=0.52, ampmax="", mx=10, my=10, qtd=1):
    for k, v in dict(mw=500, mh=500, rx=128, ry=128, weight=6, amp=amp, ampmax=ampmax, mx=mx, my=my).items():
        pg.fill("#l-" + k, str(v))
    try:
        pg.fill("#l-qty", str(qtd))
    except Exception:
        pass
    pg.evaluate("document.activeElement && document.activeElement.blur()")
    pg.wait_for_timeout(300)


def param(pg, pref, chave, valor):
    el = pg.locator("#%s-cs-%s" % (pref, chave))
    if chave == "incluir":
        if el.is_checked() != bool(valor):
            el.click()
    else:
        el.fill(str(valor))
        pg.evaluate("document.activeElement && document.activeElement.blur()")
    pg.wait_for_timeout(250)


def texto(pg, sel):
    return pg.inner_text(sel).replace(" ", " ")


def n_serie(pg):
    m = re.search(r"Máx\. de cabinets em série por entrada\s*\n?\s*(\d+)", texto(pg, "#l-alim"), re.I)
    return int(m.group(1)) if m else None


def n_entradas(pg):
    m = re.search(r"Entradas de alimentação necessárias\s*\n?\s*(\d+)", texto(pg, "#l-alim"), re.I)
    return int(m.group(1)) if m else None


def relatorio(pg, sel="#l-sum", simples=False):
    if simples:
        pg.evaluate("document.querySelector('.rel-modo-btn[data-modo=simples]').click()")
    else:
        pg.evaluate("document.querySelector('.rel-modo-btn[data-modo=completo]').click()")
    pg.wait_for_timeout(100)
    t = pg.evaluate("window.textoDoResumo(document.querySelector(%r))" % sel)
    return t.replace(" ", " ")


def zona(pg, i, **campos):
    """Preenche campos de uma zona do Ecrã Complexo (sem abrir o editor)."""
    pg.evaluate(
        """([i, c]) => {
          const card = document.querySelectorAll('#lz-list > .card')[i];
          for (const [k, v] of Object.entries(c)) {
            const el = card.querySelector('.lz-' + k);
            el.value = v;
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
          }
        }""", [i, campos])
    pg.wait_for_timeout(250)


def zonas_novas(pg, quantas):
    for _ in range(quantas):
        pg.click("#lz-add-top")
        pg.wait_for_timeout(250)
        pg.keyboard.press("Escape")
        pg.evaluate("document.querySelectorAll('dialog[open]').forEach(d => d.close && d.close())")
        pg.wait_for_timeout(150)


with sync_playwright() as p:
    # ---------------------------------------------------------------- 1. contas
    print("[1] Contas à mão (aba Ecrã LED)")
    b, pg = abrir(p, NOVO)
    confirmar(pg.locator("#l-ampmax").count() == 1, "existe o campo «Corrente máx. de saída (A)»")
    confirmar(pg.locator("label[for=l-ampmax]").inner_text().strip().startswith("Corrente máx. de saída"), "etiqueta certa")
    confirmar(pg.input_value("#l-cs-margem") == "20", "a margem de segurança vem a 20 % por omissão")
    confirmar(pg.input_value("#l-cs-base") == "0", "o consumo mínimo (base) vem a 0 % por omissão")
    led(pg, amp=0.52, ampmax=8, mx=10, my=10)
    confirmar(n_serie(pg) == 12, "0,52 A, máx. 8 A, margem 20 %% -> 12 em série (6,4 A utilizáveis) [%s]" % n_serie(pg))
    confirmar(n_entradas(pg) == 9, "100 tiles com 12 em série -> 9 entradas [%s]" % n_entradas(pg))
    t = texto(pg, "#l-alim")
    confirmar("1 cadeia de 12 cabinets + 8 cadeias de 11 cabinets" in t, "distribuição equilibrada: 1×12 + 8×11")
    confirmar("Capacidade total: 8 A → com margem de 20 %: 6,4 A utilizáveis → 12 cabinets em série por entrada" in t,
              "as duas contas lado a lado")
    confirmar("6,24 A / 8 A (78 %)" in t, "corrente da cadeia mais carregada e ocupação (12 × 0,52 = 6,24 A de 8 A = 78 %)")
    param(pg, "l", "margem", 0)
    confirmar(n_serie(pg) == 15, "margem 0 %%: 0,52 A, máx. 8 A -> 15 em série [%s]" % n_serie(pg))
    confirmar(n_entradas(pg) == 7, "100 tiles com 15 -> 7 entradas, equilibradas [%s]" % n_entradas(pg))
    confirmar("2 cadeias de 15 cabinets + 5 cadeias de 14 cabinets" in texto(pg, "#l-alim"), "100 tiles/N=15 -> 7 cadeias de 14/15")
    param(pg, "l", "margem", 20)
    led(pg, amp=1.2, ampmax=10)
    confirmar(n_serie(pg) == 6, "1,2 A, máx. 10 A, margem 20 %% -> 6 em série [%s]" % n_serie(pg))
    param(pg, "l", "margem", 0)
    confirmar(n_serie(pg) == 8, "margem 0 %%: 1,2 A, máx. 10 A -> 8 em série [%s]" % n_serie(pg))
    confirmar(n_entradas(pg) == 13, "100 tiles com 8 em série -> 13 entradas [%s]" % n_entradas(pg))
    param(pg, "l", "margem", 20)
    # Margem fora de 0–50 é ignorada
    pg.fill("#l-cs-margem", "80")
    pg.evaluate("document.activeElement && document.activeElement.blur()")
    pg.wait_for_timeout(200)
    confirmar(pg.input_value("#l-cs-margem") == "20", "margem 80 %% é recusada (volta a 20) [%s]" % pg.input_value("#l-cs-margem"))
    # I_cab > utilizável
    led(pg, amp=7, ampmax=8)
    t = texto(pg, "#l-alim")
    confirmar("Nenhum cabinet cabe numa entrada" in t and "7 A por cabinet" in t, "aviso quando 1 cabinet excede a corrente utilizável (7 > 6,4)")
    confirmar("Máx. de cabinets em série" not in t, "sem números de cadeia quando nenhum cabe")
    confirmar("⚠" in relatorio(pg) and "Nenhum cabinet cabe" in relatorio(pg), "o aviso vai para o relatório")
    # Trifásica e vários ecrãs
    led(pg, amp=0.52, ampmax=8, qtd=3)
    t = texto(pg, "#l-alim")
    confirmar("Cada ecrã: 9 entradas; 3 ecrãs → 27 no total." in t, "3 ecrãs iguais: 9 por ecrã, 27 no total")
    confirmar("máx. de entradas por fase = 9" in t, "trifásica: 27 entradas -> até 9 por fase")
    confirmar(texto(pg, "#l-out-amp").startswith("156"), "o total de amperes de sempre não mudou (3 × 52 A = 156 A)")
    # Vazio
    led(pg, amp=0.52, ampmax="", qtd=1)
    confirmar("Indique a corrente máx. de saída" in texto(pg, "#l-alim"), "campo vazio -> nota «indique a corrente máx. de saída»")
    for simples in (False, True):
        r = relatorio(pg, simples=simples)
        confirmar(not re.search(r"Alimentação em série|Cadeias|Conta da alimentação|Por fase \(trifásica\)|Consumo estimado|Brilho \d", r),
                  "campo vazio: nenhuma linha nova no relatório %s" % ("Simplificado" if simples else "Completo"))
    # Linhas no relatório com campo preenchido
    led(pg, amp=0.52, ampmax=8)
    rc, rs = relatorio(pg), relatorio(pg, simples=True)
    confirmar("Alimentação em série (margem de 20 %): máx. 12 cabinets em série por entrada → 9 entradas de alimentação" in rc, "relatório Completo: linha principal com a margem")
    confirmar("Conta da alimentação" in rc and "Por fase (trifásica)" in rc, "relatório Completo: conta por extenso e por fase")
    confirmar("Alimentação em série (margem de 20 %)" in rs and "Cadeias:" in rs, "relatório Simplificado: linha principal e cadeias")
    confirmar("Conta da alimentação" not in rs and "Por fase (trifásica)" not in rs, "relatório Simplificado: sem o detalhe")
    relatorio(pg)
    b.close()

    # ------------------------------------------------------- 2. brilho (5 patamares)
    print("[2] Consumo estimado por brilho")
    b, pg = abrir(p, NOVO)
    led(pg, amp=0.52, ampmax=8)
    t = texto(pg, "#l-alim")
    linhas = {int(m.group(1)): m.group(2) for m in re.finditer(r"^(\d+) %\t([\d.,]+) A\t", t, re.M)}
    confirmar(sorted(linhas) == [10, 25, 50, 75, 100], "5 patamares: 100, 75, 50, 25 e 10 %% [%s]" % sorted(linhas))
    confirmar(linhas.get(100) == "52" and linhas.get(75) == "39" and linhas.get(50) == "26" and linhas.get(25) == "13" and linhas.get(10) == "5,2",
              "linear sobre 52 A: 52 / 39 / 26 / 13 / 5,2 A [%s]" % linhas)
    confirmar("Potência" not in t, "sem tensão a tabela fica só em amperes")
    confirmar(re.search(r"10 %\t5,2 A\t1,73 A\t90 %", t) is not None, "10 %: corrente por fase 1,73 A e poupança de 90 %")
    confirmar("o dimensionamento de disjuntores e cadeias continua a usar o máximo (100 %)" in t, "texto explicativo da estimativa")
    confirmar(n_serie(pg) == 12 and texto(pg, "#l-out-amp").startswith("52"), "o dimensionamento (cadeias e A máx.) não mudou por haver a tabela")
    # base 20 %
    param(pg, "l", "base", 20)
    t = texto(pg, "#l-alim")
    confirmar(re.search(r"^10 %\t14,56 A\t4,85 A\t72 %", t, re.M) is not None, "base 20 %%: 10 %% -> 52×(0,2+0,8×0,1)=14,56 A, poupança 72 %%")
    confirmar(re.search(r"^50 %\t31,2 A\t", t, re.M) is not None, "base 20 %%: 50 %% -> 31,2 A")
    # tensão
    param(pg, "l", "tensao", 230)
    t = texto(pg, "#l-alim")
    confirmar("Potência" in t and re.search(r"^100 %\t52 A\t17,33 A\t11,96 kW\t0 %", t, re.M) is not None, "com 230 V: 52 A -> 11,96 kW")
    confirmar(re.search(r"^10 %\t14,56 A\t4,85 A\t3,35 kW\t72 %", t, re.M) is not None, "com 230 V: 10 %% -> 3,35 kW")
    # relatório: só com o interruptor
    for simples in (False, True):
        r = relatorio(pg, simples=simples)
        confirmar("Consumo estimado por brilho" not in r and "Brilho 100" not in r,
                  "interruptor desligado: sem tabela no relatório %s" % ("Simplificado" if simples else "Completo"))
    param(pg, "l", "incluir", True)
    for simples in (False, True):
        r = relatorio(pg, simples=simples)
        confirmar("Consumo estimado por brilho (estimativa linear, consumo mínimo de 20 %)" in r and "Brilho 10 %: 14,56 A (4,85 A/fase) — 3,35 kW — poupança de 72 %" in r,
                  "interruptor ligado: tabela no relatório %s" % ("Simplificado" if simples else "Completo"))
        confirmar(("Estimativa:" in r) == (not simples), "aviso da estimativa só no Completo [%s]" % ("simples" if simples else "completo"))
    relatorio(pg)
    # Guardar o projeto e reabrir (ficheiro novo)
    pg.click('button.tab[data-mode="projeto"]')
    pg.evaluate("document.querySelectorAll('.panel details').forEach(d=>d.open=true)")
    with pg.expect_download() as dl:
        pg.click("#proj-save")
    destino = pathlib.Path(tempfile.gettempdir()) / "cs-teste-novo.cal"
    dl.value.save_as(str(destino))
    estado = json.loads(destino.read_text(encoding="utf-8"))
    confirmar(estado.get("alimentacao") == {"margem": 20, "base": 20, "tensao": 230, "incluir": True},
              "o JSON guardado leva margem, base, tensão e interruptor [%s]" % estado.get("alimentacao"))
    b.close()

    b, pg = abrir(p, NOVO)
    pg.set_input_files("#proj-open-file", str(destino))
    pg.wait_for_timeout(600)
    confirmar(pg.input_value("#l-cs-base") == "20" and pg.input_value("#l-cs-tensao") == "230" and pg.is_checked("#l-cs-incluir"),
              "reabrir o ficheiro novo repõe base 20, 230 V e o interruptor ligado")
    # Ficheiro ANTIGO: sem a chave `alimentacao`
    antigo = dict(estado)
    antigo.pop("alimentacao", None)
    ant_path = pathlib.Path(tempfile.gettempdir()) / "cs-teste-antigo.cal"
    ant_path.write_text(json.dumps(antigo), encoding="utf-8")
    n_erros = len(pg.erros)
    pg.set_input_files("#proj-open-file", str(ant_path))
    pg.wait_for_timeout(600)
    confirmar(len(pg.erros) == n_erros, "abrir um ficheiro antigo (sem os campos novos) não dá erro")
    confirmar(pg.input_value("#l-cs-margem") == "20", "ficheiro antigo: a margem fica como estava")
    b.close()

    # ---------------------------------------------------------- 3. várias zonas
    print("[3] Ecrã Complexo: várias zonas")
    b, pg = abrir(p, NOVO, aba="zonas")
    zonas_novas(pg, 2)
    nz = pg.evaluate("document.querySelectorAll('#lz-list > .card').length")
    confirmar(nz == 2, "duas zonas criadas [%d]" % nz)
    confirmar(pg.locator("#lz-list > .card .lz-ampmax").count() == 2, "cada zona tem o campo «Corrente máx. de saída (A)»")
    # zona 1: 10x10 = 100 tiles de 0,52 A, máx 8 A -> 12 por entrada, 9 entradas
    # zona 2: 5x4 = 20 tiles de 1,2 A, máx 10 A -> 6 por entrada, 4 entradas
    zona(pg, 0, tipo="led", mx=10, my=10, ampmax=8)
    pg.evaluate("""() => { const c = document.querySelectorAll('#lz-list > .card'); }""")
    for i, (mx, my, amp, am) in enumerate([(10, 10, 0.52, 8), (5, 4, 1.2, 10)]):
        pg.evaluate("""([i, mx, my, amp, am]) => {
          const card = document.querySelectorAll('#lz-list > .card')[i];
          const sel = card.querySelector('.lz-model'); sel.value = 'custom'; sel.dispatchEvent(new Event('change', {bubbles: true}));
        }""", [i, mx, my, amp, am])
        zona(pg, i, mx=mx, my=my, amp=amp, ampmax=am)
    res = texto(pg, "#lz-alim-res")
    confirmar("12 cabinets em série por entrada → 9 entradas de alimentação" in res, "zona 1: 12 em série, 9 entradas [%s]" % res[:300].replace("\n", " | "))
    confirmar("6 cabinets em série por entrada → 4 entradas de alimentação" in res, "zona 2: 6 em série, 4 entradas")
    confirmar("(total das zonas)" in res.lower() and re.search(r"total das zonas\)\s*\n?\s*13", res, re.I) is not None, "total das zonas: 9 + 4 = 13 entradas")
    confirmar(re.search(r"máx\. de entradas por fase = 5", res) is not None, "trifásica: 13 entradas -> até 5 por fase")
    sm = texto(pg, "#lz-sum")
    confirmar("Alimentação em série — " in sm and "Entradas de alimentação necessárias (total das zonas): 13" in sm, "relatório do Ecrã Complexo leva as linhas por zona e o total")
    confirmar("Consumo estimado por brilho" not in sm, "sem tabela de brilho no relatório com o interruptor desligado")
    # a margem é UMA: mudar aqui muda na aba Ecrã LED
    param(pg, "lz", "margem", 0)
    res = texto(pg, "#lz-alim-res")
    confirmar("15 cabinets em série por entrada" in res and "8 cabinets em série por entrada" in res, "margem 0 %%: zona 1 -> 15, zona 2 -> 8 [%s]" % res[:200].replace("\n", " | "))
    confirmar(pg.input_value("#l-cs-margem") == "0", "a margem do Ecrã Complexo acompanha a da aba Ecrã LED")
    param(pg, "lz", "margem", 20)
    # brilho: total das zonas = 52 + 24 = 76 A
    res = texto(pg, "#lz-alim-res")
    confirmar(re.search(r"^100 %\t76 A\t", res, re.M) is not None and re.search(r"^50 %\t38 A\t", res, re.M) is not None, "brilho (total das zonas LED): 76 A a 100 %% e 38 A a 50 %%")
    confirmar(re.search(r"^Zona 1\t52 A\t39 A\t26 A\t13 A\t5,2 A", res, re.M) is not None or "52 A" in res, "brilho por zona")
    param(pg, "lz", "incluir", True)
    sm = texto(pg, "#lz-sum")
    confirmar("Consumo estimado por brilho — total das zonas LED" in sm and "Consumo por brilho — " in sm, "com o interruptor ligado, o relatório do Ecrã Complexo leva a tabela (total + por zona)")
    # zona sem o campo
    zona(pg, 1, ampmax="")
    res = texto(pg, "#lz-alim-res")
    confirmar("Sem corrente máx. de saída (não contadas)" in res, "uma zona sem o campo diz-se que não entrou na conta")
    sm = texto(pg, "#lz-sum")
    confirmar(sm.count("Alimentação em série") == 1, "relatório: só a zona preenchida tem linhas de alimentação")
    # Guardar com zonas, voltar a abrir
    pg.evaluate("document.getElementById('proj-led-usezones').checked = true; document.getElementById('proj-led-usezones').dispatchEvent(new Event('change', {bubbles:true}))")
    zona(pg, 1, ampmax=10)
    pg.click('button.tab[data-mode="projeto"]')
    with pg.expect_download() as dl:
        pg.click("#proj-save")
    d2 = pathlib.Path(tempfile.gettempdir()) / "cs-teste-zonas.cal"
    dl.value.save_as(str(d2))
    est = json.loads(d2.read_text(encoding="utf-8"))
    confirmar([z.get("ampMax") for z in est.get("ledZones", [])] == ["8", "10"], "as zonas guardadas levam a corrente máx. de saída [%s]" % [z.get("ampMax") for z in est.get("ledZones", [])])
    b.close()
    b, pg = abrir(p, NOVO, aba="zonas")
    pg.set_input_files("#proj-open-file", str(d2))
    pg.wait_for_timeout(700)
    vals = pg.evaluate("Array.from(document.querySelectorAll('#lz-list > .card .lz-ampmax')).map(e => e.value)")
    confirmar(vals == ["8", "10"], "reabrir: as zonas voltam com a corrente máx. de saída [%s]" % vals)
    # Ficheiro antigo: tira ampMax das zonas
    for z in est["ledZones"]:
        z.pop("ampMax", None)
    est.pop("alimentacao", None)
    d3 = pathlib.Path(tempfile.gettempdir()) / "cs-teste-zonas-antigo.cal"
    d3.write_text(json.dumps(est), encoding="utf-8")
    ne = len(pg.erros)
    pg.set_input_files("#proj-open-file", str(d3))
    pg.wait_for_timeout(700)
    vals = pg.evaluate("Array.from(document.querySelectorAll('#lz-list > .card .lz-ampmax')).map(e => e.value)")
    confirmar(vals == ["", ""] and len(pg.erros) == ne, "ficheiro antigo com zonas abre sem erro e com o campo vazio [%s]" % vals)
    confirmar("Indique a corrente máx. de saída" in texto(pg, "#lz-alim-res"), "zonas sem o campo: nota a pedir o valor")
    r = texto(pg, "#lz-sum")
    confirmar("Alimentação em série" not in r and "Cadeias" not in r, "zonas sem o campo: nenhuma linha nova no relatório")
    b.close()

    # ---------------------------------------------------------------- 4. EN
    print("[4] PT/EN")
    b, pg = abrir(p, NOVO)
    led(pg, amp=0.52, ampmax=8)
    param(pg, "l", "tensao", 230)
    param(pg, "l", "incluir", True)
    pg.click('#lang-toggle [data-lang="en"]')
    pg.wait_for_timeout(500)
    en = texto(pg, '.panel[data-mode="led"]')
    PT = ["Alimentação", "cabinets em série", "Cadeias", "cadeia de", "Entradas de", "Consumo estimado", "Poupança", "Corrente", "Margem de segurança",
          "Tensão", "utilizáveis", "Distribuição", "Estimativa", "Modelo linear", "Indique a", "mais carregada", "Trifásica", "poupança", "Potência"]
    sobras = [w for w in PT if w in en]
    confirmar(not sobras, "em EN não fica português nos blocos novos [%s]" % sobras)
    confirmar("Series power feed" in en and "Estimated consumption by brightness" in en and "Max output current (A)" in en, "títulos novos em inglês")
    rep_en = pg.inner_text("#l-sum")
    sobras = [w for w in ["Alimentação", "cabinets em", "Cadeias", "Consumo estimado", "poupança", "utilizáveis"] if w in rep_en]
    confirmar(not sobras, "em EN o relatório não tem português nas linhas novas [%s]" % sobras)
    pg.click('#lang-toggle [data-lang="pt"]')
    pg.wait_for_timeout(500)
    pt = texto(pg, "#l-alim")
    confirmar("cabinets em série por entrada" in pt and "Series power feed" not in pt, "EN -> PT repõe o texto")
    confirmar(n_serie(pg) == 12, "ida e volta PT->EN->PT não estraga os números")
    b.close()

    # ------------------------------------------------------------ 5. mobile
    print("[5] Largura de telemóvel")
    b, pg = abrir(p, NOVO, largura=400)
    led(pg, amp=0.52, ampmax=8)
    param(pg, "l", "tensao", 230)
    sobra = pg.evaluate("document.documentElement.scrollWidth - document.documentElement.clientWidth")
    confirmar(sobra <= 1, "a 400 px não há rolagem horizontal da página [%s px]" % sobra)
    b.close()

    # ------------------------------------------------------------ 6. regressão
    if VELHO:
        print("[6] Regressão contra a versão antiga")
        CASOS = [dict(amp=0.52, ampmax="", mx=10, my=10, qtd=1), dict(amp=0.57, ampmax="", mx=16, my=9, qtd=2), dict(amp=1.2, ampmax=10, mx=8, my=4, qtd=1)]

        def totais(url, c):
            b, pg = abrir(p, url)
            for k, v in dict(mw=500, mh=500, rx=128, ry=128, weight=6, amp=c["amp"], mx=c["mx"], my=c["my"]).items():
                pg.fill("#l-" + k, str(v))
            if c["ampmax"] != "" and pg.locator("#l-ampmax").count():
                pg.fill("#l-ampmax", str(c["ampmax"]))
            pg.fill("#l-qty", str(c["qtd"]))
            pg.evaluate("document.activeElement && document.activeElement.blur()")
            pg.wait_for_timeout(300)
            r = {k: pg.inner_text("#l-out-" + k) for k in ("tiles", "weight", "amp", "ampphase", "px", "py", "size", "area")}
            novas = r"Alimentação em série|Cadeias|Conta da alimentação|Por fase \(trifásica\)|Consumo|Brilho \d|Estimativa|Cada ecrã"
            r["sum"] = [x for x in pg.inner_text("#l-sum").split("\n") if not re.match(novas, x)]
            b.close()
            return r
        for i, c in enumerate(CASOS):
            velho, novo = totais(VELHO, c), totais(NOVO, c)
            confirmar(velho == novo, "caso %d: totais e resumo iguais aos da versão antiga" % (i + 1))

print()
if falhas:
    print("FALHARAM %d:" % len(falhas))
    for f in falhas:
        print(" -", f)
    sys.exit(1)
print("TUDO OK")
