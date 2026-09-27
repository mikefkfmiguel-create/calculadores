# Transporte de sinal sobre fibra — pesquisa

Pedido: *"podes em background fazer uma pesquisa sobre o transporte de sinal
sobre fibra para incluir na calculadora"*.

Isto é **pesquisa, não é código**. Serve para decidir o que vale a pena
calcular e com que números — e nenhum número entra aqui sem fonte, que é a
regra da casa (`CLAUDE.md`: *"nunca inventar dados técnicos — só usar valores
reais, com fonte"*).

> **Aviso sobre o estado desta recolha.** As fontes abaixo são de duas
> qualidades diferentes, e a diferença importa:
>
> - o que vem das **normas** (TIA-568.3, IEEE 802.3, SMPTE) e das **fichas
>   dos fabricantes** é firme;
> - o que vem de páginas de vendedores de ótica e de blogues técnicos é
>   **indicativo**, e está marcado como tal. Antes de qualquer destes
>   números ir para dentro da app, o valor tem de ser confirmado na norma ou
>   na ficha original — como se fez com o catálogo de tiles.
>
> Não li os textos das normas (são pagas); li o que terceiros citam delas.
> Está assinalado onde isso acontece.

---

## 1. O que faz sentido calcular

Das quatro coisas que se perguntam em obra, três são conta e uma é tabela:

1. **«Esta tirada de fibra aguenta?»** — orçamento de perdas (*link budget*).
   É a conta que falta em toda a parte e que se faz com números de norma.
   **É a candidata mais forte.**
2. **«Até onde vai isto?»** — distância máxima por tipo de fibra e débito. É
   tabela, não conta; vale como consulta ao lado da conta de cima.
3. **«Quantos sinais cabem nesta fibra?»** — quantos fluxos de vídeo cabem
   num débito. Conta simples, mas depende de números de vídeo que a app já
   tem (a aba Sinal & Data Rate já calcula data rate de ecrãs LED).
4. **«Que conector/cabo é que isto leva?»** — opticalCON, SMPTE 311M, LC/SC.
   É inventário e vocabulário, não conta.

O resto deste documento recolhe os números para 1, 2 e 3.

---

## 2. Orçamento de perdas — a conta

```
perda total (dB) = comprimento (km) × atenuação (dB/km)
                 + nº de pares de conectores × perda por par
                 + nº de emendas × perda por emenda
```

E depois compara-se com o **orçamento ótico do transceiver** (a diferença
entre a potência que ele emite e a sensibilidade do que recebe, que vem na
ficha do SFP). Se a perda total for maior, não passa.

### 2.0 O `comprimento` da fórmula é de fibra, não de distância

A parcela do comprimento conta **os metros de fibra que estão no caminho**, e
não os metros entre as duas pontas. Uma bobine de 500 m a servir dois pontos
a 50 m um do outro é uma tirada de 500 m: o que ficou enrolado continua no
caminho da luz.

Isto falha das duas maneiras, e a segunda é a que apanha as pessoas:

- **na perda** — 500 m de OM3 a 3,5 dB/km são 1,75 dB, e não os 0,18 dB dos
  50 m que se veem no chão;
- **no alcance** — e esta é a que deita a ligação abaixo. O limite de 300 m
  da OM3 a 10 Gbps não é de perda, é de **dispersão modal**: os modos chegam
  desencontrados no tempo. E 500 m enrolados desencontram-nos exactamente
  como 500 m esticados. Com a bobine por estender, os 10 Gbps não sobem —
  mesmo com as duas pontas encostadas uma à outra.

#### Quanto custa a curva em si

Pouco, num rolo bem enrolado — e é por isso que se pode dizer com todas as
letras que **o problema é o comprimento, não a bobine**. Medido em mandril,
das fichas dos fabricantes:

| Fibra | Condições | λ | Perda |
|---|---|---|---|
| Monomodo G.652.D | 100 voltas, R = 25 mm | 1310 / 1550 nm | ≤ 0,05 dB |
| Monomodo G.652.D | 100 voltas, R = 30 mm | 1625 nm | ≤ 0,05 dB |
| Multimodo OM1 62,5/125 | 100 voltas, R = 37,5 mm | 850 / 1300 nm | ≤ 0,5 dB |

Fontes: fichas Prysmian de agosto de 2024 —
[Enhanced Single-Mode Fibre ITU-T G.652.D](https://www.prysmian.com/sites/www.prysmian.com/files/media/products/Prysmian-Enhanced-Single-Mode-G-652-D-Datasheet.pdf)
e [62.5 µm OM1 Multimode Fibre](https://www.prysmian.com/sites/www.prysmian.com/files/media/products/Prysmian-OM1-Datasheet.pdf).

**Por recolher:** a perda de curvatura de OM3 e de OM4, e o raio mínimo de
curvatura do cabo tático de produção (esse vem da ficha do cabo).

#### O mecanismo, que é ao contrário do que parece

A luz enrolada não reflete *mais* — reflete **menos**, e é por isso que se
perde. Numa fibra esticada o raio bate na parede do núcleo com um ângulo
suficientemente rasante para ser todo devolvido para dentro (reflexão total
interna) e segue. Numa curva esse ângulo abre; a parte do feixe que deixa de
cumprir a condição já não é devolvida e sai para a bainha. Quanto mais
apertada a curva, mais luz sai — daí uma volta larga de bobine quase não
custar, um laço apertado atrás de um rack custar, e nunca se apertar uma
abraçadeira sobre uma fibra.

#### E no fim, mede-se

O número em que se confia não é o desta calculadora: é o que sai de uma fonte
de luz e de um medidor de potência aplicados à tirada **como ela está no
chão, no dia**. A conta serve para saber se vale a pena ir montar; a medição
diz se ficou bom.

### 2.1 Atenuação máxima da fibra (TIA-568.3-D)

| Fibra | 850 nm | 1300 nm | 1310 nm | 1550 nm |
|---|---|---|---|---|
| Multimodo OM3 / OM4 | 3,0 dB/km | 1,5 dB/km | — | — |
| Monomodo OS1 | — | — | 1,0 dB/km | 1,0 dB/km |
| Monomodo OS2 | — | — | 0,4 dB/km | 0,4 dB/km |

Fontes (citações da norma, não a norma em si):
[Trend Networks](https://www.trend-networks.com/fibre-optic-cabling-how-much-loss-is-ok/) ·
[FOA — TIA 568 B.3](https://www.thefoa.org/tech/tia568b3.htm) ·
[FOA — loss estimation](https://www.thefoa.org/tech/loss-est.htm)

> **A confirmar antes de usar:** o valor de 1300 nm para multimodo aparece
> citado como «cerca de 1 dB/km, máximo 1,5 dB/km» — é o tipo de número que
> convém ler na norma antes de entrar na app.

### 2.2 Perdas dos componentes (TIA-568.3-D)

| Componente | Perda máxima |
|---|---|
| Par de conectores | 0,75 dB |
| Emenda (fusão ou mecânica) | 0,3 dB |

Fontes: [FOA — loss estimation](https://www.thefoa.org/tech/loss-est.htm) ·
[Fluke Networks — TIA-568.3-D](https://www.flukenetworks.com/content/new-loss-budget-values-reference-grade-connectors-ansitia-5683-d)

> **Nota importante:** a Fluke escreve que a **TIA-568.3-E** mudou os valores
> para conectores de referência. Se a app for usar estes números, tem de
> dizer **de que edição** são — um orçamento calculado com a régua errada é
> pior do que nenhum.

---

## 3. Distâncias máximas — a tabela

### 3.1 Ethernet (IEEE 802.3)

| Norma | OM1 | OM2 | OM3 | OM4 | Monomodo |
|---|---|---|---|---|---|
| 1000BASE-SX | 220–275 m | 550 m | — | — | — |
| 1000BASE-LX | — | 550 m | — | — | 5 km |
| 10GBASE-SR | — | — | 300 m | 400 m | — |
| 10GBASE-LR | — | — | — | — | 10 km |
| 25GBASE-SR | — | — | 70 m | 100 m | — |
| 100GBASE-SR4 | — | — | 70 m | 100 m | — |

Fontes: [Wikipedia — Gigabit Ethernet](https://en.wikipedia.org/wiki/Gigabit_Ethernet) ·
[Ethernet Alliance — 10GbE em OM4](https://ethernetalliance.org/blog/2012/06/13/10gbe-standardized-to-400-meters-on-om4-fiber/) ·
[TIA FOTC — 10GBASE-LR](https://www.tiafotc.org/ieee-802-3-ethernet-standards-update/singlemode-standards-update/10gbase-lr/) ·
[Cisco — módulos 10GBASE](https://www.cisco.com/c/en/us/products/collateral/interfaces-modules/transceiver-modules/data_sheet_c78-455693.html) ·
[Corning — 40G/100G multimodo](https://www.corning.com/data-center/worldwide/en/home/knowledge-center/40-100G-multimode-fiber-connectivity-data-center.html)

> Há **discrepância entre fontes** no 1000BASE-LX monomodo: umas dizem 5 km
> (a norma), outras 10 km (o que os SFPs do mercado fazem). A app tem de
> escolher uma e dizer qual — e a resposta honesta é a da norma, com nota de
> que há óticas que vão mais longe.
>
> Estas distâncias são **máximos em condições ideais**. O orçamento de
> perdas da secção 2 é que manda: com conectores a mais, uma tirada de 300 m
> em OM3 pode não passar.

### 3.2 SDI sobre fibra

- **SMPTE ST 297** define o sistema ótico para sinais SDI em série
  ([Wikipédia — SDI](https://en.wikipedia.org/wiki/Serial_digital_interface)).
- **12G-SDI** (ST 2082, UHD 2160p60) sobre monomodo: os SFPs do mercado dão
  **10 km** ([Optcore](https://www.optcore.net/product/12g-sdi-video-sfp-1310nm-10km-transceiver/))
  e **20 km** ([Gigalight](https://www.gigalight.com/12g-sdi-sfp-20km.html)).
  A distância é do **SFP**, não da norma.

### 3.3 Câmara — SMPTE 311M / 304M

O cabo híbrido de câmara: **duas fibras monomodo** mais condutores de cobre
para alimentação e controlo, num só cabo, com conector **SMPTE 304M**.

O ponto que interessa para uma calculadora: **quem limita a distância é o
cobre, não a fibra.** A fibra vai além dos 10 km; a queda de tensão nos
condutores de alimentação limita a uns **2–3 km**, conforme a corrente.

Fontes: [Remee — SMPTE 311M](https://remee.com/smpte-cable-311m-hybrid-backbone-of-4k-8k-broadcasting/) ·
[Fosco Connect — conector LEMO/304M](https://www.fiberoptics4sale.com/blogs/wave-optics/what-is-a-lemo-connector) ·
[Production Distro — guia SMPTE](https://productiondistro.com/blog/smpte-fiber-cable-guide/) —
*todas fontes indicativas, de fabricante e de blogue; os 2–3 km precisam de
confirmação numa ficha a sério.*

---

## 4. Quantos sinais cabem — a outra conta

### 4.1 SMPTE ST 2110 (vídeo sem compressão sobre IP)

| Formato | Débito aproximado |
|---|---|
| 1080p59.94, 10 bit, 4:2:2 | 2,5–3 Gbps |
| UHD 2160p50/60, 10 bit, 4:2:2 | 8–12 Gbps |

Regra de dimensionamento que as fontes repetem: **10 GbE por ponto HD, 25 GbE
por ponto UHD, 100 GbE nas espinhas**.

Fontes: [SMPTE — FAQ ST 2110](https://www.smpte.org/smpte-st-2110-faq) ·
[Nevion](https://nevion.com/lexicon/what-is-smpte-st-2110/) ·
[MDL — calculadora de largura de banda ST 2110](https://www.mdlcommunications.com/engineers-toolkit/st-2110-bandwidth-calculator/)

> Os débitos exactos dependem do formato, da profundidade de bit e da
> amostragem — há calculadoras dedicadas a isto (a da MDL, acima). Se a app
> for por aqui, o caminho honesto é **calcular** a partir do formato, e não
> usar uma tabela de aproximações.

### 4.2 Eletrónicas de LED sobre fibra

A app já conhece os processadores NovaStar. O **MX40 Pro** — que já está na
base de dados — tem **4 portas óticas de 10G a 10,3125 Gbps**, duas
principais e duas de reserva, comutáveis entre modo de 20 ou 40 portas.

Fonte: [NovaStar — ficha do MX40 Pro](https://oss.novastar.tech/uploads/2025/10/MX40-Pro-LED-Display-Controller-Specifications-V1.5.0.pdf)

Isto liga-se directamente ao que a app já calcula: o data rate do ecrã, na
aba **Sinal & Data Rate**, já dá os bits por segundo. Dizer quantas fibras de
10G são precisas é a mesma conta que já se faz para as portas Ethernet.

### 4.3 Áudio (Dante / AES67)

Um ponto Dante/AES67 precisa de **1 Gbps**; os fluxos AES67 levam até 8 canais
cada. Em fibra, o 1000BASE-SX chega aos 220–550 m conforme o tipo de
multimodo.

Fontes: [Universal Networks — glossário](https://www.universalnetworks.co.uk/resources/glossary/) ·
[Biamp — AES67 em Tesira](https://support.biamp.com/Tesira/Control/Using_AES67_in_Tesira)

---

## 5. Conectores de terreno — vocabulário

**Neutrik opticalCON**, que é o que se usa em digressão:

| Modelo | Fibras | Modo |
|---|---|---|
| DUO / DUO LITE | 2 | multimodo ou monomodo (PC ou APC) |
| QUAD / QUAD LITE | 4 | multimodo ou monomodo (PC ou APC) |
| MTP | 12 ou 24 | multimodo PC ou monomodo APC |

Fontes: [Neutrik — DUO LITE](https://www.neutrik.com/en/product/opticalcon-duo-lite) ·
[Neutrik — QUAD LITE](https://www.neutrik.com/en/product/opticalcon-quad-lite) ·
[brochura opticalCON](https://www.canford.co.uk/ProductResources/resources/N/Neutrik/OpticalCON/Opticalcon%20Brochure%202017_03%20V19.pdf)

---

## 6. O que eu proporia, e porquê

**Uma aba «Fibra», com duas metades:**

1. **Aguenta?** — tipo de fibra, comprimento, nº de pares de conectores, nº
   de emendas → perda total em dB. Ao lado, o orçamento ótico do transceiver
   (escrito à mão ou escolhido de uma lista curta) e a **margem que sobra**.
   Esta é a parte que tem valor a sério: é a conta que ninguém faz de cabeça
   e cujos números são de norma.
2. **Chega lá?** — a tabela de distâncias da secção 3, filtrada pelo débito
   que se quer. Consulta, não conta.

**Por onde eu NÃO começaria:** por uma tabela de débitos ST 2110. A app já
calcula data rate a partir do formato na aba Sinal; repetir aproximações
tabeladas ao lado de uma conta exacta seria criar duas réguas para a mesma
medida — exactamente o defeito que a v4.20 acabou de corrigir nas
eletrónicas.

**O que falta antes de escrever uma linha de código:**

- confirmar os valores da TIA-568.3 na **edição** certa (D ou E — mudaram);
- decidir se as distâncias são as da **norma** ou as das **óticas do
  mercado**, e dizê-lo na app;
- saber que transceivers/SFPs a AVK tem, para a lista de orçamentos óticos
  ser a do inventário e não uma inventada.

Sem os três, isto fica como está: pesquisa.

---

## 7. Fabricantes com opção de fibra — o que se leu, e onde

Pedido: *"usa como referência Cisco, Netgear, Luminex, NovaStar, Lightware,
Gefen, Kramer, Extron — todos os fabricantes que têm opção fiber. Inclui uma
lista na base de SFP e fibras"*.

Os oito estão na app. O que muda de um para o outro é **o que se conseguiu
ler na ficha do próprio fabricante** — e isso está escrito em cada entrada,
porque uma entrada honesta e vazia vale mais do que uma cheia de números de
revendedor.

### 7.1 Lidos em primeira mão (cinco)

**Luminex** — o melhor material da lista, e de longe. Publica a tabela
completa dos SFPs deles (8 módulos, com código, modo, débito e alcance), as
regras de compatibilidade, a identificação das fibras pela cor, e a regra do
cruzamento Tx/Rx. Serve de referência mesmo a quem não usa GigaCore.
[SFP modules](https://support.luminex.be/portal/en/kb/articles/sfp-modules) ·
[Fiber type and identification](https://support.luminex.be/portal/en/kb/articles/fiber-type-and-identification-10-5-2019-1) ·
[Fiber optic cabling](https://support.luminex.be/portal/en/kb/articles/gigacore-switches-fiber-optic-cabling)

**Netgear** — AXM761 (SR: 550 m em OM4, 300 m em OM3, 33 m em OM1/OM2),
AXM762 (LR: 10 km em monomodo) e **AXM763** (LRM: 220 m em OM1/OM2 de
62,5/125 e 260 m em OM3/OM4). O AXM763 é o achado da recolha: é o módulo que
aproveita fibra multimodo antiga a 10 Gbps, onde um SR normal pára aos 33 m.
Nota: os 550 m em OM4 do AXM761 passam os 400 m da norma — é ficha, não norma.

**Kramer** — 676T/676R: 4K60 4:4:4 + RS-232 sobre fibra multimodo ou
monomodo, até 33 km, com SFP+ trocável (multimodo incluído). Ressalva
importante e dita pela própria Kramer: o link ótico é de 10 Gbps, e o HDMI
acima disso é adaptado por **subamostragem de croma** — não é transporte
transparente dos 18 G.

**Extron** — FOX3 T 201: 4K60 4:4:4 sem perda matemática numa fibra, ou sem
compressão nenhuma em duas; HDMI 2.0 até 18 Gbps; versões MM e SM. A
distância não estava na página do produto e **não foi recolhida**. A série
FOX 3G HD-SDI (3G-SDI numa fibra) está descontinuada mas ainda anda por aí.

**Gefen** (hoje Nice North America) — EXT-UHD600-1SC: os 18,2 Gbps completos
do HDMI 2.0 numa fibra só, 200 m, conector SC, OM3 ou melhor. E a ficha diz
por escrito que **monomodo não é suportado** — o engano dos modos visto do
lado do equipamento, e o género de coisa que só se descobre no dia se não se
ler antes.

### 7.2 Por confirmar (três), e porquê

**NovaStar** — as fichas estão no servidor deles
([CVT4K-S](https://oss.novastar.tech/uploads/2024/10/CVT4K-S-Fiber-Converter-Specifications-V1.0.6.pdf),
[CVT10](https://oss.novastar.tech/uploads/2025/10/CVT10-Fiber-Converter-Specifications-V1.3.5.pdf)),
mas os PDF usam fontes embebidas de que não se consegue extrair texto aqui.
Os números que a app mostra (CVT4K-S: 16 Ethernet Neutrik + 4 óticas LC,
monomodo 1310 nm, 10 km) vieram de resumos, não da ficha em primeira mão, e
estão marcados como tal.

**Cisco** — o CDN deles responde *Access Denied* a este IP, tanto por `curl`
como por browser. Não se recolheu nada de novo. O valor de 10 km do
1000BASE-LX que já está na tabela das óticas veio de uma ficha da Cisco
recolhida antes.

~~**Lightware** — o site estava em baixo no dia.~~ **Resolvido:** o domínio
`lightware.com` sem o `www` responde *"the site is temporarily unavailable"*,
mas o `www.lightware.com` está bom. Ver a secção 7.4.

### 7.3 O que isto acrescentou à app, para além da lista

Três coisas de terreno que vieram da Luminex e que não estavam em lado nenhum:

- **identificar a fibra pela cor** — amarelo com conector LC azul é
  monomodo; laranja, água-marinha, violeta ou verde-lima com conector bege é
  multimodo. No transceiver, a patilha de o tirar tem pega azul se for
  monomodo e preta se for multimodo;
- **as fibras têm de ir cruzadas** — Tx é sempre o lado esquerdo visto de
  frente com a etiqueta para cima, e dois patches seguidos **anulam-se** e
  desfazem o cruzamento. É a razão nº 1 para uma fibra não subir com tudo
  certo no papel;
- **as regras de compatibilidade dos SFPs** — um de 1 Gbps entra num cage de
  10; um de 10 não entra num cage só de 1 (a não ser de duplo débito); e um
  de 10 forçado a 1 até liga, mas com o laser fora da afinação dele.

### 7.4 Os extensores de fibra, marca a marca

A primeira recolha trouxe **um modelo por marca, como amostra** — quatro
extensores ao todo. Reparo dele: *"incluíste os fiber extensores das várias
marcas?"*. Não, não propriamente. Esta secção é a segunda passagem, agora com
as gamas. São **14 aparelhos**.

Antes da lista, a distinção que evita a pior confusão: **estes oito não fazem
todos a mesma coisa.**

| Família | Quem | O que faz |
|---|---|---|
| **Rede** | Luminex, Netgear, Cisco | Switches e SFPs. O sinal já vai em IP; escolhe-se o módulo e o resto é rede. |
| **Extensores** | Kramer, Extron, Gefen, Lightware | Metem vídeo direto na fibra, sem rede pelo meio. O aparelho traz a ótica dele, ou diz que SFP aceita. |
| **No meio** | NovaStar | Converte para fibra o sinal de LED que sai das eletrónicas dela. |

Um extensor não se liga a um switch, e um SFP solto não estende vídeo. É a
primeira pergunta a fazer, e é por isso que está escrita no topo do cartão.

**Kramer** — 675R/T (kit Tx+Rx, 4K60 4:4:4, até 33 km, dois SFP+ multimodo
incluídos) e 676T/676R (o mesmo mais RS-232). Os dois aceitam SFP+ monomodo
certificado pela Kramer para ir mais longe.

**Extron** — a gama ponto-a-ponto FOX3 T/R **101** (só HDMI), **201** (mais
áudio e controlo), **301** e **311** (mais USB), em versões multimodo e
monomodo; e as **matrizes FOX3**, modulares de 8×8 até 840×840, com placas
multimodo ou monomodo trocáveis a quente. É o que distingue a Extron aqui:
não é só extensão ponto-a-ponto, é comutação em fibra à escala de um
edifício. Distâncias não estão nas páginas de produto e **não foram
recolhidas**.

**Gefen** — quatro, e um deles é o único de 8K da lista:

| Modelo | Sinal | Fibra | Distância |
|---|---|---|---|
| GF-HD48G-1MPO | HDMI 2.1, 48 Gbps | OM3 50/125, **MPO/MTP** | 100 m |
| EXT-UHD600-1SC | HDMI 2.0, 18,2 Gbps | OM3+, SC | 200 m |
| EXT-DP-4K600-1SC | DisplayPort 1.2, 21,6 Gbps | OM3+, SC | 200 m |
| EXT-DVI-FM1000 | DVI | multimodo, SC | 1000 m |

Duas coisas a reter: o **MPO/MTP** do 8K não é LC nem SC — é uma fita de
fibras num conector só, e não se improvisa em obra; e os dois `-1SC` dizem
por escrito que **monomodo não é suportado**.

**Lightware** — DP-OPT-TX100/RX100 e TX150/RX150 (este com KVM), extensores
óticos de DisplayPort. É a **melhor ficha das oito marcas**, e por duas
razões que interessam directamente a esta calculadora:

- publica a **distância fibra a fibra**, e não um máximo de catálogo. A
  2560×1600 a 60 Hz e 24 bpp: **150 m em OM1, 350 m em OM2, 800 m em OM3 e
  1100 m em OM4**; com OM3e, 2000 m;
- publica o **orçamento ótico do aparelho** — emissor −6,25 dBm de OMA no
  pior caso, sensibilidade do receptor −14,25 dBm — o que dá **8 dB** para
  gastar em fibra, conectores e emendas. Com este número a conta das perdas
  desta app deixa de ser indicativa e passa a decidir.

É o género de ficha que se devia exigir a toda a gente. Vale a pena dizer-lhes
isso.

### 7.5 PixelHue — o lado do LED, e o número que faltava

Pedido dele, a seguir: *"a PixelHue também"*. Lida em primeira mão em
`proav.pixelhue.com`, e trouxe o dado que faltava a esta app para o lado do
LED: **quanto CARREGA uma fibra**. Ali a pergunta não é quantos metros anda —
é quantos píxeis leva.

| Placa (série Lumina) | Ótica | Carga |
|---|---|---|
| LU_4×OPT Sending Card | 4× 10G; **10 km** em monomodo (SFP+ LR), **300 m** em multimodo (SFP+ SR) | até 20 800 000 px |
| LU_16×RJ45+2×OPT Sending Card | 16 RJ45 + 2 óticas, SMF ou MMF | até 10 400 000 px |
| LU_2×Fiber Input Card | 4× 10G (2 principais + 2 reserva), SFP+ SR ou LR | 4096×2160@30 por conector |
| LU_1×ST2110 Input Card | 2× **25G** (1 + 1 reserva) | 4096×2160@60 |

Três coisas que valem a pena reter:

**Uma porta ótica de 10G carrega o mesmo que oito portas Ethernet.** É a
conta que interessa ao montar, e está dita pela própria PixelHue na ficha da
LU_4×OPT. Deixa de ser preciso adivinhar quantas fibras são precisas para um
ecrã.

**Na LU_16×RJ45+2×OPT, as óticas NÃO acrescentam carga.** A OPT 1 copia as
Ethernet 1 a 8 e a OPT 2 copia as 9 a 16. Serve para levar longe o que já sai
em cobre, não para levar mais — e este é o engano fácil de fazer a olhar para
"16 + 2".

**A placa ST 2110 fecha em parte um buraco conhecido desta app.** A tabela
das óticas avisa que faltam as de longo alcance a 25 e 40 Gbps. A ficha desta
placa nomeia as normas que ela usa — **25GBASE-LR (IEEE 802.3cc)** e
**25GBASE-SR (IEEE 802.3by)** —, o que já chega para saber o que pedir. As
distâncias delas continuam por recolher, e isso continua dito.

Vale ainda notar que a PixelHue e a NovaStar entram na mesma família desta
lista (LED), e é por isso que o texto que separa as famílias passou a
nomeá-las juntas.
