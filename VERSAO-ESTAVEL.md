# Versão estável

**Calculadores v4.12** · commit `6c63869` · dada como estável a 24 de setembro de 2026.

> *"era só para confirmares as versões correctas como estão"* — com as duas
> apps abertas lado a lado. E a seguir, confirmadas: *"promove as duas"*.

Par: **Preview 3D v3.87** (`ed7b80b` no repositório `preview`). As duas apps
falam uma com a outra — dar uma como estável sem a outra não quer dizer nada,
e por isso o par escreve-se aqui e é promovido ao mesmo tempo.

## O que "estável" quer dizer aqui

Que é **este** o ponto a que se volta se alguma coisa partir daqui para a
frente. Não quer dizer acabado, nem sem defeitos conhecidos (ver
`PARA-CONTINUAR.md` e `BALANCO.md`) — quer dizer *experimentado por ele e dado
como bom*, com as verificações todas verdes no dia em que se escreveu isto.

## Medido no dia, neste commit

**17 verificações verdes** em `scripts/`:

`abrir-projeto` · `abrir-sem-trancar` · `area-de-visualizacao` ·
`catalogo-led` · `dsm-do-projeto` · `duas-janelas` · `extensoes` ·
`ficha-dome` · `ficheiro-da-app` · `folgas` · `foto-encolhe` ·
`fundo-das-zonas` · `instalar` · `limpeza` · `pitch` · `recado-de-erro`

E `verificar-traducao`: **nada de novo por traduzir** (dívida conhecida: 287
trechos, em `traducao-por-fazer.json`).

Do outro lado, no Preview v3.87, **18 verificações verdes**: `cena` ·
`contagem` · `copiar-pecas` · `excecoes-de-lugares` · `ficheiro-da-app` ·
`fora-das-paredes` · `grupo-no-3d` · `grupos-guardados` · `instalar` ·
`palco` · `planta-de-volta` · `planta-dxf` · `planta-guardada` · `plateia` ·
`posicao-bidirecional` · `posicao-real` · `relatorio-ecras` ·
`sincronizacao`.

Correram no commit que esta página nomeia, não no ramo antes de fundir.

## O que mudou desde a v4.11, que foi a estável anterior

**O peso do Traulux transparente era o dobro** (v4.12). O fabricante dá o peso
em **kg/m²** e os dois módulos estavam na tabela como se fosse o peso de cada
painel — uma torre de LED aparecia com o dobro do peso que tem, e é desse
número que sai a estrutura. Corrigido para 3,75 kg e 7,5 kg, com a fonte
anotada em cada linha.

A cura ficou na raiz: `verificar-catalogo-led` passou a exigir que, quando uma
nota cita `N kg/m²`, o peso a dividir pela área do painel bata certo com esse
número (5% de tolerância). Um engano destes não volta a entrar calado.

Do outro lado, o Preview andou da v3.79 à v3.87 no mesmo período: relatório
com o quadro dos ecrãs, selecção e rotação de conjuntos, cópias de peças,
grupos guardados com cor, caixa de ajustes que se arrasta, e os números do
painel a baterem certo com as coordenadas da sala. Está tudo no
`PARA-CONTINUAR.md` desse repositório.

## Como se volta a este ponto

```
git checkout 6c63869          # ver como estava
git revert <commit>           # desfazer uma coisa só, sem perder o resto
```

A tag `v4.12` **não** está no GitHub: as credenciais da sessão que escreveu
isto deixam empurrar ramos, não tags (HTTP 403). Se ela fizer falta, cria-se
na página de *releases* do repositório, apontada a `6c63869`.

## Quando isto deixa de valer

Na próxima versão que ele experimente e dê como boa. Então este ficheiro
reescreve-se — não se acrescenta ao fundo. Uma lista de versões estáveis
antigas não serve para nada; o histórico completo está no
`PARA-CONTINUAR.md`.
