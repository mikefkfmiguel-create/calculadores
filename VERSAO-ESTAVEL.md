# Versão estável

**Calculadores v4.30** · commit `490a73d` · dada como estável a 27 de setembro de 2026.

> *"publica e promove as duas"*.

Par: **Preview 3D v3.93** (`07872e7` no repositório `preview`). As duas apps
falam uma com a outra — dar uma como estável sem a outra não quer dizer nada,
e por isso o par escreve-se aqui e é promovido ao mesmo tempo. Desta vez só
um dos lados andou: o Preview está na mesma v3.93 da promoção anterior, e é
promovido de novo por ser o par testado com esta.

## O que "estável" quer dizer aqui

Que é **este** o ponto a que se volta se alguma coisa partir daqui para a
frente. Não quer dizer acabado, nem sem defeitos conhecidos (ver
`PARA-CONTINUAR.md` e `BALANCO.md`) — quer dizer *experimentado por ele e dado
como bom*, com as verificações todas verdes no dia em que se escreveu isto.

## Medido no dia, neste commit

**22 verificações verdes** em `scripts/`, zero falhas:

`abrir-projeto` · `abrir-sem-trancar` · `area-de-visualizacao` ·
`catalogo-led` · `dsm-do-projeto` · `duas-janelas` · `extensoes` · `fibra` ·
`ficha-dome` · `ficheiro-da-app` · `folgas` · `foto-encolhe` ·
`fundo-das-zonas` · `instalar` · `limpeza` · `lista-de-modelos` ·
`modelo-novo` · `pesquisa-de-modelos` · `pitch` ·
`prioridade-eletronicas` · `recado-de-erro` · `traducao`

A nova desde a v4.21 é a `fibra`, com sete secções.

E `verificar-traducao`: **nada de novo por traduzir** (dívida conhecida: 287
trechos, em `traducao-por-fazer.json`).

No **Worker**: **41 testes verdes** (`worker/testes/`), incluindo os do
`/modelo`, a rota de procura na web que entrou na v4.18.

Do outro lado, no Preview v3.93, **23 verificações verdes**.

Correram no commit que esta página nomeia, não no ramo antes de fundir.

## O que mudou desde a v4.21, que foi a estável anterior

Uma aba nova inteira — **Fibra & SFP** —, em sete versões. Começou num pedido
de pesquisa em background e acabou numa calculadora a sério.

A regra que valeu para tudo: **nada entra sem fonte**. Onde um número não foi
recolhido fica `null` e a app diz que não sabe, em vez de mostrar um valor
plausível. E, desde a v4.26, *a ficha do fabricante manda e a norma é o chão*
— a norma diz o mínimo que um módulo cumpre, não o máximo que faz.

- **v4.22** — a aba: que ótica leva que débito até onde, com o selo da
  confiança de cada valor (Norma / Ficha / A confirmar) e a fonte em cada
  linha;
- **v4.23** — monomodo contra multimodo, nas duas metades que são mesmo duas
  coisas (o núcleo da fibra e a fonte de luz do SFP, que é o que explica o
  preço), mais o custo em banda de 12 sinais de vídeo, áudio e luz;
- **v4.24** — o engano que mais custa: um SFP monomodo de 1310 numa OM3. A
  ligação às vezes sobe numa tirada curta e cai depois, que é a pior maneira
  de uma coisa estar errada. Dizendo-se qual é a fibra que já lá está, a app
  marca a vermelho o que não serve para ela;
- **v4.25** — 14 aparelhos do catálogo ganharam campo `optica`, tirado das
  notas que já lá estavam e com a fonte de cada um. Quem não tem fonte
  mostra-o: badge **Sem fonte**;
- **v4.26** — o 1000BASE-LX tem 5 km na norma e 10 km na ficha da Cisco.
  Planear pela norma era deitar fora metade do alcance comprado;
- **v4.27** — **a fibra conta-se esticada, não em rolo**. Reparo dele: *"a
  distância possível é medida com a fibra nessa distância e não em rolo, pois
  aí a conta falha"*. Falha das duas maneiras, e a segunda é a que apanha de
  surpresa: a perda é aos metros de fibra, mas o **alcance** também — a OM3
  pára aos 300 m a 10 Gbps por dispersão modal, e 500 m enrolados
  desencontram os modos tal e qual como 500 m esticados. Campo novo para o
  que fica na bobine, e a soma escrita à vista;
- **v4.28** — os oito fabricantes pedidos, com o que se conseguiu ler na
  ficha de cada um. Cinco em primeira mão (Luminex, Netgear, Kramer, Extron,
  Gefen) e três com a razão escrita à vista por não terem dado (NovaStar,
  Cisco, Lightware). Mais três cartões de terreno vindos da Luminex:
  identificar a fibra pela cor, a regra do cruzamento Tx/Rx, e as regras de
  compatibilidade dos cages.

- **v4.29** — os **extensores de fibra marca a marca**. A recolha da v4.28
  trouxe um modelo por marca, como amostra; esta traz as gamas, e são **18
  aparelhos**. Entra a gama FOX3 da Extron (incluindo matrizes óticas
  modulares até 840×840), mais três Gefen (com o 8K a 48 Gbps sobre MPO/MTP,
  que não é LC nem SC e não se improvisa em obra), o kit 675R/T da Kramer, e
  a **Lightware**, que na v4.28 tinha ficado por fazer: o site estava em
  baixo no `lightware.com`, e responde no `www.lightware.com`. É a melhor
  ficha das nove — publica a distância **fibra a fibra** (150 m em OM1 até
  1100 m em OM4) e o **orçamento ótico do aparelho**, 8 dB. Com esse número
  a conta das perdas desta app deixa de ser indicativa;
- **v4.30** — a **PixelHue**, e o número que faltava ao lado do LED: uma
  porta ótica de 10G carrega o mesmo que **oito portas Ethernet**. Quatro
  placas da série Lumina, e dois avisos que evitam enganos — na placa de
  16+2 as óticas copiam o cobre e não acrescentam carga, e a placa ST 2110
  nomeia as normas de 25G (25GBASE-LR e -SR) que ainda faltam à tabela das
  óticas, o que chega para saber o que pedir.

A lista dos fabricantes passou também a separar **três famílias** em vez de
uma lista corrida: rede (Luminex, Netgear, Cisco), extensores (Kramer,
Extron, Gefen, Lightware) e LED (NovaStar, PixelHue). Um extensor não se
liga a um switch e um SFP solto não estende vídeo — não eram comparáveis, e
a lista dava a entender que eram.

Do outro lado, o Preview não andou neste período: está na v3.93, que foi a
última coisa que ele deu como boa.

## Como se volta a este ponto

```
git checkout 490a73d          # ver como estava
git revert <commit>           # desfazer uma coisa só, sem perder o resto
```

A tag `v4.30` **não** está no GitHub: as credenciais da sessão que escreveu
isto deixam empurrar ramos, não tags (HTTP 403). Se ela fizer falta, cria-se
na página de *releases* do repositório, apontada a `490a73d`.

## Quando isto deixa de valer

Na próxima versão que ele experimente e dê como boa. Então este ficheiro
reescreve-se — não se acrescenta ao fundo. Uma lista de versões estáveis
antigas não serve para nada; o histórico completo está no
`PARA-CONTINUAR.md`.
