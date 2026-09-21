# Versão estável

**Calculadores v4.11** · commit `3ea8468` · dada como estável a 21 de setembro de 2026.

> *"resolvido"* — depois de reabrir o casamento de sete ecrãs que tinha
> trancado a app na véspera. E a seguir, à pergunta se passava a v4.11 a
> estável: *"promove"*.

Par: **Preview 3D v3.79** (`63f3f73` no repositório `preview`). As duas apps
falam uma com a outra — dar uma como estável sem a outra não quer dizer nada.

## O que "estável" quer dizer aqui

Que é **este** o ponto a que se volta se alguma coisa partir daqui para a
frente. Não quer dizer acabado, nem sem defeitos conhecidos (ver
`PARA-CONTINUAR.md` e `BALANCO.md`) — quer dizer *experimentado por ele e dado
como bom*, com as verificações todas verdes no dia em que se escreveu isto.

## Medido no dia, neste commit

**16 verificações verdes** em `scripts/`:

`abrir-projeto` · `abrir-sem-trancar` · `area-de-visualizacao` ·
`catalogo-led` · `dsm-do-projeto` · `duas-janelas` · `extensoes` ·
`ficha-dome` · `ficheiro-da-app` · `folgas` · `foto-encolhe` ·
`fundo-das-zonas` · `instalar` · `limpeza` · `pitch` · `recado-de-erro`

E `verificar-traducao`: **nada de novo por traduzir** (dívida conhecida: 287
trechos, em `traducao-por-fazer.json`).

Do outro lado, no Preview v3.79, **13 verificações verdes**: `cena` ·
`contagem` · `excecoes-de-lugares` · `ficheiro-da-app` · `fora-das-paredes` ·
`instalar` · `palco` · `planta-de-volta` · `planta-dxf` · `planta-guardada` ·
`plateia` · `posicao-bidirecional` · `sincronizacao`.

Correram no commit que esta página nomeia, não no ramo antes de fundir.

## O que mudou desde a v4.10, que foi a estável anterior

**Abrir um projeto com várias zonas deixou de trancar a app** (v4.11). Era o
defeito que a v4.10 levava: repor um projeto abria uma caixa "Editar zona" por
cada zona, modais e empilhadas — fechava-se uma e aparecia a seguinte. O
JavaScript estava vivo o tempo todo; presa estava a pessoa. Um ficheiro de
sete ecrãs foi o que o tornou impossível de ignorar.

A cura foi na raiz, não nos dois sítios que falhavam: o argumento que abre o
editor passou a ser preciso pedi-lo por extenso, e a função que abre uma caixa
fecha qualquer outra antes. Nenhum caminho, hoje ou amanhã, consegue empilhar
duas.

## Como se volta a este ponto

```
git checkout 3ea8468          # ver como estava
git revert <commit>           # desfazer uma coisa só, sem perder o resto
```

A tag `v4.11` **não** está no GitHub: as credenciais da sessão que escreveu
isto deixam empurrar ramos, não tags (HTTP 403). Se ela fizer falta, cria-se
na página de *releases* do repositório, apontada a `3ea8468`.

## Quando isto deixa de valer

Na próxima versão que ele experimente e dê como boa. Então este ficheiro
reescreve-se — não se acrescenta ao fundo. Uma lista de versões estáveis
antigas não serve para nada; o histórico completo está no
`PARA-CONTINUAR.md`.
