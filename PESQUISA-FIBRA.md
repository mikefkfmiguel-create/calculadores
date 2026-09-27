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
