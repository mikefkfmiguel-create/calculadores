# Balanço — o que está construído, e o que está a ceder

Escrito a 15 de setembro de 2026, a pedido: *"nesta altura do projeto todo
podes condensar a nossa conversa toda e fazer uma análise detalhada do que até
aqui construímos"*.

Não é um historial — esse é o `PARA-CONTINUAR.md`. É uma leitura do estado: o
que existe, que forma tem, que defeitos se repetiram e o que os curou, e onde
está a ceder agora. Os números vieram todos de contar os ficheiros e o `git`,
nenhum de memória.

---

## 1. O tamanho da coisa

| | Calculadores | Preview 3D | Worker |
|---|---|---|---|
| Nasceu | 20 ago 2026 | 7 set 2026 | 8 set 2026 |
| Idade | 26 dias | 8 dias | 7 dias |
| Commits em `main` | 623 | 128 | (no repo dos Calculadores) |
| Linhas próprias | ~18 200 | ~13 600 | 681 |

**~32 500 linhas escritas em 26 dias**, mais 54 571 de `three.js` vendorizado
que não são nossas. O ritmo dos Calculadores em agosto foi de 396 commits em
doze dias — trinta e três por dia.

**O que lá está dentro, dos Calculadores:**

- `index.html` — **11 714 linhas**, com a app inteira num único `<script>`
- `js/zonas.js` — 2 554 (o Ecrã Complexo, o motor que mais muda)
- `css/app.css` — 1 845 · `js/i18n.js` — 1 036 · `js/utils.js` — 500
- **14 abas**: Assistente, Projeção, Blending, Dome, Visualização, TVs, LED,
  Ecrã Complexo, Sinal & Data Rate, Media Server, Projeto, Lentes, Grafismo,
  Ajuda

**Do Preview:**

- `js/app.js` — 7 115 · `js/cena.js` — 2 995 · `js/projeto.js` — 604
- mais `dxf.js`, `exportar.js`, `importar.js`, `relatorio.js`, `partilha.js`,
  `assistente.js`

**O catálogo, que é o que dá valor a tudo isto:** 47 projetores, 71 lentes,
38 cabines LED, 88 TVs, 32 switchers, 19 processadores LED, 17 media servers.
Todos com fonte, e marcados "Mercado" ou "Estimado" — a regra do `CLAUDE.md`
de nunca inventar um dado técnico aguentou 750 commits sem uma excepção.

---

## 2. A forma: três peças, e só uma delas tem servidor

```
  Calculadores (PWA estática, GitHub Pages)
        │
        │  8 chaves em localStorage, mesma origem
        │  projeto · projetor · sala · briefing · ecrã
        │  sincronização · aviso · ajustes-do-preview
        ▼
  Preview 3D (PWA estática, GitHub Pages, three.js)

  Worker Cloudflare ── só para o Assistente de Projeto (IA)
```

**A decisão de fundo, e continua certa:** nada disto tem conta, sessão, base
de dados ou backend. O projeto vive no telemóvel de quem o está a fazer, e a
ponte entre as duas apps é `localStorage` da mesma origem. Num pavilhão sem
wifi a app abre e calcula na mesma. Não há nada para ir abaixo.

**O Worker é a única peça com um segredo e um custo**, e existe por uma razão
só: uma app estática não tem onde guardar uma chave de API. Ele fica entre a
app e a Anthropic, e a app **nunca aplica** o que a IA extrai sem uma pessoa
confirmar — o que está certo, porque um modelo lê mal um PDF torto e os
números vão parar a fichas técnicas.

---

## 3. Os quatro defeitos que se repetiram

Isto é a parte que interessa. Ao longo de 750 commits, quase tudo o que
reportaste encaixa em quatro famílias — e cada uma tem uma cura que já foi
aplicada mais do que uma vez.

### 3.1 A app sabe, e esconde

A resposta existia, calculada e correcta, **dentro de um `<details>` que
nasce fechado**. A dica da lente foi o caso de manual: *"A LENTE????"* — ela
estava lá, ao fundo de um painel que ninguém abre.

**Cura:** a resposta aparece onde estás a olhar, ao lado do campo, assim que
houver o que responder. O `dicaDaLente()` passou a escrever junto ao campo,
e a mesma função serve a aba Blending e a aba Lentes.

### 3.2 A mesma conta em dois sítios

Sempre que uma conta foi copiada, as duas cópias acabaram a discordar — nunca
no dia em que foram escritas, sempre semanas depois.

**Curado dentro de cada app**, repetidamente: `estadoDoProjeto()` (a lista de
30 campos vivia solta dentro do clique do "Guardar"), `marcarLentesQueServem()`,
`domeAbaGuardada()`, e as portas do menu, que não reimplementam nada — clicam
no `.tab` que já existia.

**Não curado entre as apps.** Ver 4.4.

### 3.3 Valores assumidos ao arranque

A app abria com um projetor escolhido e 20 000 lm escritos no campo — e daí um
valor de lux calculado a partir de uma máquina que ninguém tinha escolhido. E
o gémeo: as medidas da cabine da casa (500 × 500, 128 × 128 px) escritas nos
campos com a lista em "Personalizado…", a dar um pitch de 3,91 mm sem ninguém
ter escolhido cabine nenhuma.

**Cura:** *"que nunca leve a engano com valores auto de arranque"*. A app abre
limpa (v3.82), e o exemplo entra nos campos **sem disparar eventos** (v3.87) —
enche o formulário e não calcula coisa nenhuma. Zero alterações nas catorze
funções de cálculo, e por isso zero maneiras novas de as partir.

**Sobra uma instância.** Ver 4.2.

### 3.4 O silêncio

A app estar errada, ou velha, ou vazia, **sem o dizer**. O caso mais perigoso
foi o `lzForcarParaPreview()`: com a app a abrir limpa e o sync ligado, o
primeiro recálculo com zero zonas ia **apagar o projeto do Preview**. Apanhado
antes de sair, com a guarda `lzAArrancar`.

E ontem, a mesma doença apontada à própria app: o service worker atualiza-se
sozinho, mas quando falha a app fica velha **em silêncio** — foi o que deu a
v3.88.

---

## 4. Onde está a ceder agora

Sete coisas, medidas hoje. As duas primeiras já eram conhecidas; as outras
cinco saíram desta análise.

### 4.1 `Nº de tiles` mostra `NaN x NaN` — **uma linha** ✅ *resolvido na v3.89*

`index.html:6330` é a **única** linha de resultado do bloco que concatena
números crus:

```js
document.getElementById("proj-out-tiles").textContent = mx + " x " + my + " (" + fmtInt(numTiles) + ")";
```

As oito linhas à volta passam todas por `fmt()`/`fmtInt()` — e esses **já
devolvem `—` para um valor não-finito** (`utils.js:5-12`). A guarda existe,
está escrita, e esta linha é a única que a contorna. Com o formulário vazio,
`mx` e `my` vêm `NaN` e o `NaN x NaN` chega ao ecrã.

### 4.2 Sinal & Data Rate escolhe a cabine da casa por ti ✅ *resolvido na v3.89*

É a **única** lista de cabines sem `Personalizado…`. Sem essa opção o browser
escolhe a primeira à mesma, e o código decide deliberadamente que seja a da
casa (`index.html:8468-8480`). É o último sobrevivente do defeito 3.3 —
corrigido em todo o lado menos aqui, e está comentado no código como "fica por
arrumar".

### 4.2-bis A aba Projeto inventava uma cabine — **o pior de todos** ✅ *resolvido na v3.89*

Saiu ao medir a correcção da 4.1, e é mais grave do que as duas que a
motivaram. `parseInt("custom")` dá `NaN`, e a linha era:

```js
var tile = LED_TILES_DATA[isNaN(tileIdx) ? 0 : tileIdx];
```

Ou seja: com **"Personalizado…"** na lista — que é o que a app mostra à
entrada desde que deixou de escolher modelos por ti — a aba Projeto calculava
tudo a partir da **primeira cabine do catálogo**. Medido a frio, antes da
correcção:

> pitch **3,91 mm** · 2048 × 1152 px · **864,0 kg** · **82,08 A** (27,36 A/fase)

São os números da YESTECH MG6S P3.91, que ninguém tinha escolhido. E o
`ledSumText` nomeava-a por extenso — por isso a cabine errada saía **no resumo
copiado e no PDF**.

Peso e amperagem não são um engano como os outros: são o que decide se a
estrutura aguenta e se o quadro chega. Era o pior sítio onde esta app podia
enganar alguém.

Sem cabine escolhida, os campos ficam a `—` e o resumo fica vazio. O resto do
caminho já estava preparado: o `ledPixels` fica no `0` com que nasce, a lista
de processadores de LED só corre com `ledPixels > 0`, e o resumo já escrevia
"(por preencher)".

### 4.3 O inglês está **partido** nos ecrãs novos ✅ *resolvido na v3.90*

O motor de tradução é substituição de frases: percorre o texto visível e troca
cada trecho em PT que reconhece. Os ecrãs novos — o menu (v3.83), a barra de
exemplo (v3.87), a barra da versão (v3.88) — nunca entraram no dicionário.

Só que o resultado não é ficar em português. É pior: as entradas de palavra
curta ("Distância"→"Distance", "Largura"→"Width", "Todas"→"All") **disparam
dentro de frases portuguesas** e produzem isto, medido com a app em EN:

> "A que **distance** o projetor faz o ecrã que queres"
> "**Width**, altura, resolução e a que **distance** se vê bem"
> "**All** as abas, o projeto e a sincronização com o 3D"

**Medido, com a app em EN:** 14 trechos partidos ou por traduzir no ecrã de
boas-vindas, 4 na barra de exemplo, 2 na barra da versão.

**E a boa notícia, que é mesmo boa:** as catorze calculadoras estão limpas —
**zero** trechos em PT em treze das catorze abas. O dicionário de ~800 entradas
cobre a app toda. O que falhou foi só o que nasceu nos últimos três dias.

**O defeito de fundo não é a falta de tradução — é não haver nada que avise.**
Um ecrã novo nasce meio traduzido e ninguém dá por isso até alguém carregar em
EN.

**Resolvido na v3.90**, e nas duas pontas: os ecrãs novos foram traduzidos, e
o `scripts/verificar-traducao.mjs` passou a apanhar o próximo. A dívida velha
(288 trechos, sobretudo Dome e Assistente) está escrita por extenso em
`scripts/traducao-por-fazer.json`, para a verificação falhar só no que é novo —
uma verificação que grita 319 não trava publicação nenhuma. **Ponto cego
conhecido:** uma palavra portuguesa solta e sem acento passa-lhe ao lado
("Sincronizar" e "Guardar" foram apanhados a olho, não pela rede).

### 4.4 O Assistente nunca foi traduzido

32 trechos em português com a app em EN. É a única aba nessa situação.

### 4.5 O Preview não tem tradução nenhuma

Sem botão PT/EN, sem dicionário, sem uma linha de i18n. A porta "Ver em 3D" do
menu, com a app em inglês, leva a uma app só em português.

### 4.6 O Preview não tem o botão de versão

Está na v3.50 e sem maneira de forçar uma atualização — exactamente o problema
que apanhaste ontem no telemóvel, ainda por curar do outro lado.

### 4.7 `calc-widget.js` é um fork, não um ficheiro partilhado

263 linhas nos Calculadores, 276 no Preview, e **já divergiram**: tamanho do
ícone, uma variável a menos, comentários diferentes. O comentário do Preview
diz "Portado de calc-widget.js dos Calculadores" — ou seja, a duplicação é
consciente e está documentada, mas é duplicação à mesma. É o defeito 3.2 a
atravessar a fronteira dos repositórios, onde a cura nunca chegou.

O mesmo vale para a geometria: `arcoCobertoPelaLente()` nos Calculadores e
`arcoEntre()`/`lenteNoArco()` no Preview são a mesma matemática escrita duas
vezes, com dois vocabulários.

---

## 5. O buraco estrutural: não há um único teste automático

623 + 128 commits, dois service workers, uma ponte de oito chaves entre duas
apps — e **zero testes**. O único workflow que existe é o `deploy-worker.yml`.

Na prática, o que faz de rede é: eu meço com o Chromium antes de publicar, e
**tu apanhas o resto no telemóvel**. Funcionou — a lista de defeitos que
apanhaste é longa e precisa. Mas é uma rede feita de duas pessoas atentas, e
já deixou passar coisas que só se viram em produção: o pré-seleccionado a
escrever 20 000 lm, a regra do "projeto vazio" errada, o `};` engolido que
deixou a app sem arrancar.

As contas desta app — throw ratio, pixel pitch, data rate, cobertura de arco —
são **funções puras com entradas e saídas numéricas**. São o tipo de código
mais fácil de testar que existe, e não têm um único teste. Uma dúzia de casos
com valores conhecidos apanharia amanhã a classe inteira de erro que hoje só
tu apanhas.

---

## 6. A ideia da "versão global para venda": está meio feita, e o resto não é fácil

O `CLAUDE.md` guarda a ideia de separar o motor genérico (throw ratio, pitch,
data rate) do inventário da AVK. Depois deste levantamento, a leitura honesta:

**O que já está do lado certo da linha.** Os dados estão todos em `data/*.json`,
fora do código. O que é da AVK é o conteúdo desses ficheiros mais os crachás
"Mercado"/"Estimado" e a ordenação stock-primeiro. Tirar o inventário é quase
de graça.

**O que não está.** Os motores de cálculo vivem dentro das 11 714 linhas do
`index.html`, não num módulo que se possa levar. A geometria está duplicada com
o Preview. E o inglês, que é a condição para vender lá fora, está bom nas
calculadoras e partido em tudo o que é novo — e sem nada que impeça o próximo
ecrã de nascer igual.

**Portanto:** a separação dos dados é um fim-de-semana; a do código é um
projeto. E o passo que serve as duas coisas — e que serve na mesma se a venda
nunca acontecer — é tirar as funções de cálculo do `index.html` para um módulo
com testes.

---

## 7. O que está mesmo bom, e vale a pena não estragar

- **Os dados são reais e têm fonte.** A regra aguentou 750 commits.
- **Abre sem rede.** Offline-first a sério, dos dois lados.
- **Nada sai do telemóvel.** Sem contas, sem servidor, sem dados a viajar —
  menos o Assistente, e esse é opt-in e passa por um proxy que não guarda nada.
  **Nota, desde a v3.91:** passou a sair uma coisa, e é justo dizê-lo aqui —
  uma vez por dia, um número aleatório desta instalação, a versão e os nomes
  das abas abertas, para se saber quantos aparelhos usam isto. Nada do que se
  escreve nos campos, nenhum projeto, nenhum cliente, sem IP. Está explicado
  na aba Ajuda, com um interruptor que desliga mesmo.
- **Os comentários explicam o *porquê*, não o *quê*.** Boa parte deste balanço
  saiu de os ler. É o que faz o código sobreviver a quem o escreveu.
- **A app diz o que fez.** Toasts, barras, avisos — a cura do defeito 3.4 virou
  hábito da casa.

---

## 8. Ordem sugerida

1. ~~**`NaN x NaN`** e **a lista do Sinal & Data Rate**~~ — feitos na v3.89, e
   com eles a cabine inventada da 4.2-bis, que só apareceu ao medir.
2. ~~**O inglês dos ecrãs novos**~~ — feito na v3.90, com a verificação
   incluída. Fica a dívida velha, contada em `traducao-por-fazer.json`.
3. **O botão de versão no Preview** — o mesmo remédio da v3.88, do outro lado.
4. **Os testes das funções de cálculo** — o investimento que muda a rede. O
   `verificar-traducao.mjs` é o primeiro passo nesta direcção: é a primeira
   verificação automática que este projeto tem.
5. **O Assistente e o i18n do Preview** — maiores, e podem esperar pela
   decisão sobre a versão de venda. O Dome, com 121 trechos, é o maior bloco.
