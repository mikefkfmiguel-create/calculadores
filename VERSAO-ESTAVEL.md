# Versão estável

**Calculadores v4.21** · commit `b565f93` · dada como estável a 27 de setembro de 2026.

> *"publica e promove as duas"*.

Par: **Preview 3D v3.93** (`07872e7` no repositório `preview`). As duas apps
falam uma com a outra — dar uma como estável sem a outra não quer dizer nada,
e por isso o par escreve-se aqui e é promovido ao mesmo tempo.

## O que "estável" quer dizer aqui

Que é **este** o ponto a que se volta se alguma coisa partir daqui para a
frente. Não quer dizer acabado, nem sem defeitos conhecidos (ver
`PARA-CONTINUAR.md` e `BALANCO.md`) — quer dizer *experimentado por ele e dado
como bom*, com as verificações todas verdes no dia em que se escreveu isto.

## Medido no dia, neste commit

**20 verificações verdes** em `scripts/`:

`abrir-projeto` · `abrir-sem-trancar` · `area-de-visualizacao` ·
`catalogo-led` · `dsm-do-projeto` · `duas-janelas` · `extensoes` ·
`ficha-dome` · `ficheiro-da-app` · `folgas` · `foto-encolhe` ·
`fundo-das-zonas` · `instalar` · `limpeza` · `lista-de-modelos` ·
`modelo-novo` · `pesquisa-de-modelos` · `pitch` ·
`prioridade-eletronicas` · `recado-de-erro`

Duas são novas desde a v4.12: `prioridade-eletronicas` e `lista-de-modelos`.

E `verificar-traducao`: **nada de novo por traduzir** (dívida conhecida: 287
trechos, em `traducao-por-fazer.json`).

No **Worker**: **41 testes verdes** (`worker/testes/`), incluindo os do
`/modelo`, a rota de procura na web que entrou na v4.18.

Do outro lado, no Preview v3.93, **23 verificações verdes**.

Correram no commit que esta página nomeia, não no ramo antes de fundir.

## O que mudou desde a v4.20, que foi a estável anterior

**A lista primeiro, a procura a seguir** (v4.21). Reparo dele, com uma foto do
campo *Modelo de referência*: *"em vez de ter obrigatoriamente de escrever pode
dar a lista de existentes, e a opção de escrever para procura se não estiver na
lista existente por falta de atualização"*. E a seguir, a razão: *"é mais fácil
escolher de uma lista do que escrever quando estamos no terreno e precisamos de
uma resposta rápida"*.

A lista sempre lá esteve — é o `<select>` com o catálogo. O que estava mal era
a **ordem de leitura**: a caixa de pesquisa vinha por cima dela, e lia-se como
se escrever fosse obrigatório. Passou para baixo, e a dizer pelo nome ao que
vem: «Não está na lista? Procurar…». Como a correcção está na função
partilhada, apanhou os **14 campos de modelo** da app — tiles, TVs,
projetores, lentes, DSM, delays e cúpula.

Do outro lado, o Preview andou da v3.90 à v3.93 no mesmo período: o botão
«Montar um ecrã aqui mesmo» passou a montar mesmo, a app passou a dar por
versões novas (e o número da versão é um botão para as ir buscar), e o 🏠
passou a enquadrar as peças em vez do chão. Está tudo no `PARA-CONTINUAR.md`
desse repositório.

## Como se volta a este ponto

```
git checkout b565f93          # ver como estava
git revert <commit>           # desfazer uma coisa só, sem perder o resto
```

A tag `v4.21` **não** está no GitHub: as credenciais da sessão que escreveu
isto deixam empurrar ramos, não tags (HTTP 403). Se ela fizer falta, cria-se
na página de *releases* do repositório, apontada a `b565f93`.

## Quando isto deixa de valer

Na próxima versão que ele experimente e dê como boa. Então este ficheiro
reescreve-se — não se acrescenta ao fundo. Uma lista de versões estáveis
antigas não serve para nada; o histórico completo está no
`PARA-CONTINUAR.md`.
