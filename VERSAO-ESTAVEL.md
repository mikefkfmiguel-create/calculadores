# Versão estável

**Calculadores v4.20** · commit `b12cf56` · dada como estável a 27 de setembro de 2026.

> *"promovo o par v4.20 / v3.90 a estável?"* — e a resposta: *"Sim"*.

Par: **Preview 3D v3.90** (`d2e0129` no repositório `preview`). As duas apps
falam uma com a outra — dar uma como estável sem a outra não quer dizer nada,
e por isso o par escreve-se aqui e é promovido ao mesmo tempo.

## O que "estável" quer dizer aqui

Que é **este** o ponto a que se volta se alguma coisa partir daqui para a
frente. Não quer dizer acabado, nem sem defeitos conhecidos (ver
`PARA-CONTINUAR.md` e `BALANCO.md`) — quer dizer *experimentado por ele e dado
como bom*, com as verificações todas verdes no dia em que se escreveu isto.

## Medido no dia, neste commit

**19 verificações verdes** em `scripts/`:

`abrir-projeto` · `abrir-sem-trancar` · `area-de-visualizacao` ·
`catalogo-led` · `dsm-do-projeto` · `duas-janelas` · `extensoes` ·
`ficha-dome` · `ficheiro-da-app` · `folgas` · `foto-encolhe` ·
`fundo-das-zonas` · `instalar` · `limpeza` · `modelo-novo` ·
`pesquisa-de-modelos` · `pitch` · `prioridade-eletronicas` · `recado-de-erro`

Três são novas desde a v4.12: `pesquisa-de-modelos`, `modelo-novo` e
`prioridade-eletronicas`. (A `regra-do-mercado` saiu: a regra que ela guardava
deixou de existir quando a procura passou a acrescentar sozinha, e um teste a
guardar uma regra que já não há é pior do que nenhum.)

E `verificar-traducao`: **nada de novo por traduzir** (dívida conhecida: 287
trechos, em `traducao-por-fazer.json`).

No **Worker**: **41 testes verdes** (`worker/testes/`), incluindo os do
`/modelo`, a rota de procura na web que entrou na v4.18.

Do outro lado, no Preview v3.90, **21 verificações verdes**: `barra-de-vista` ·
`cena` · `comecar-no-deposito` · `contagem` · `copiar-pecas` ·
`excecoes-de-lugares` · `ficheiro-da-app` · `fora-das-paredes` ·
`grupo-no-3d` · `grupos-guardados` · `instalar` · `palco` ·
`planta-de-volta` · `planta-dxf` · `planta-guardada` · `plateia` ·
`posicao-bidirecional` · `posicao-real` · `relatorio-ecras` · `rodar-palco` ·
`sincronizacao`.

Correram no commit que esta página nomeia, não no ramo antes de fundir.

## O que mudou desde a v4.12, que foi a estável anterior

**A pesquisa de modelos deixou de dizer "não encontrado" e ficar por aí.**
Reportado do telemóvel com uma foto: *"Não encontra"*. Eram oito versões a
resolver a mesma coisa, por partes:

- **v4.13** — a procura passou a ser por **palavras** e não por pedaço de
  texto: escrever "hitachi 55" deixou de esconder o que a AVK tem.
- **v4.14 e v4.15** — quando a lista não devolve nada, dispara uma procura no
  mercado, e **diz que está a procurar** enquanto o faz.
- **v4.16 e v4.17** — a procura deixou de abrir popups e de pedir para ser ele
  a escrever o que pode estar errado: *"apenas acrescenta automaticamente"*.
  E deixou de estar presa ao inventário da AVK — *"será para dar todas as
  opções de mercado"*.
- **v4.18** — o `/modelo` no Worker procura mesmo na **web**, com a **fonte a
  servir de prova**: só entra na lista o que vier de uma página que a procura
  abriu, com diagonal, rácio e resolução dentro do plausível. Nada inventado.
- **v4.19** — uma **marca não é um modelo**: "Xiaomi" sozinho deixou de
  entrar na lista como se fosse uma TV.

**E a prioridade das eletrónicas de LED** (v4.20), a última antes desta
página. A lista ordenava-se por nº de unidades e o selo saía da percentagem de
ocupação — duas réguas na mesma linha, com um «Não aconselhado» a vermelho
acima de um «Possível» a amarelo, e o primeiro da lista a levar «Recomendado»
mesmo a 94%. Passou a haver uma régua só (`APERTADO_PCT`), e quando nenhuma
máquina tem folga a sério **não há recomendação nenhuma**, que é a verdade
desse caso.

Do outro lado, o Preview andou da v3.87 à v3.90: o palco principal passou a
**rodar**, os interruptores do "ver" saíram do menu para uma **barra no topo
da janela** (com a grelha desligada à nascença e a escolha guardada), e quem
escolhe começar um projeto ali aterra em cima do **`+ Ecrã`** em vez de numa
secção vazia. Está tudo no `PARA-CONTINUAR.md` desse repositório.

## Como se volta a este ponto

```
git checkout b12cf56          # ver como estava
git revert <commit>           # desfazer uma coisa só, sem perder o resto
```

A tag `v4.20` **não** está no GitHub: as credenciais da sessão que escreveu
isto deixam empurrar ramos, não tags (HTTP 403). Se ela fizer falta, cria-se
na página de *releases* do repositório, apontada a `b12cf56`.

## Quando isto deixa de valer

Na próxima versão que ele experimente e dê como boa. Então este ficheiro
reescreve-se — não se acrescenta ao fundo. Uma lista de versões estáveis
antigas não serve para nada; o histórico completo está no
`PARA-CONTINUAR.md`.
