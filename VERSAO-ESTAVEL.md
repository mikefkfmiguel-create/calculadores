# Versão estável

**Calculadores v4.10** · commit `ef6846f` · dada como estável a 20 de setembro de 2026.

> *"parece bem este por agora, podes dar como estável a versão"*

Par: **Preview 3D v3.79** (`63f3f73` no repositório `preview`). As duas apps
falam uma com a outra — dar uma como estável sem a outra não quer dizer nada.

## O que "estável" quer dizer aqui

Que é **este** o ponto a que se volta se alguma coisa partir daqui para a
frente. Não quer dizer acabado, nem sem defeitos conhecidos (ver
`PARA-CONTINUAR.md` e `BALANCO.md`) — quer dizer *experimentado por ele e dado
como bom*, com as verificações todas verdes no dia em que se escreveu isto.

## Medido no dia, neste commit

**15 verificações verdes** em `scripts/`:

`abrir-projeto` · `area-de-visualizacao` · `catalogo-led` · `dsm-do-projeto` ·
`duas-janelas` · `extensoes` · `ficha-dome` · `ficheiro-da-app` · `folgas` ·
`foto-encolhe` · `fundo-das-zonas` · `instalar` · `limpeza` · `pitch` ·
`recado-de-erro`

E `verificar-traducao`: **nada de novo por traduzir** (dívida conhecida: 287
trechos, em `traducao-por-fazer.json`).

Do outro lado, no Preview v3.79, **13 verificações verdes**: `cena` ·
`contagem` · `excecoes-de-lugares` · `ficheiro-da-app` · `fora-das-paredes` ·
`instalar` · `palco` · `planta-de-volta` · `planta-dxf` · `planta-guardada` ·
`plateia` · `posicao-bidirecional` · `sincronizacao`.

## O que entrou desde a última vez que ele olhou

- **abrir um projeto deixou de morrer calado** (v4.06) — e `reader.onerror`
  passou a existir;
- **as zonas deixaram de gritar colisões que não existem** (v4.07/v4.08): o
  que o 3D lhes fez ao fundo e à rotação chega à folha, e "cruza" tem
  etiqueta curta e explicação;
- **o `.cal` é desta app** (v4.09): ícone próprio, abre com dois cliques, e
  fechar com trabalho por guardar pergunta antes;
- **"⤓ Instalar"** (v4.10), ligado ao link `#instalar` da página de entrada.

## Como se volta a este ponto

```
git checkout ef6846f          # ver como estava
git revert <commit>           # desfazer uma coisa só, sem perder o resto
```

A tag `v4.10` **não** está no GitHub: as credenciais da sessão que escreveu
isto deixam empurrar ramos, não tags (HTTP 403). Se ela fizer falta, cria-se
na página de *releases* do repositório, apontada a `ef6846f`.

## Quando isto deixa de valer

Na próxima versão que ele experimente e dê como boa. Então este ficheiro
reescreve-se — não se acrescenta ao fundo. Uma lista de versões estáveis
antigas não serve para nada; o histórico completo está no
`PARA-CONTINUAR.md`.
