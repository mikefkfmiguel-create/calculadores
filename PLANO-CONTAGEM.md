# Plano: saber quantos usam isto — sem saber quem

## O pedido

Voltar à ideia de contabilizar utilizadores. Hoje **não há nada, e não há mesmo**:
o GitHub Pages não dá registos nenhuns. Neste momento não se sabe se a app é
usada por três pessoas ou por trinta, e é a adivinhar que se decide o que
polir a seguir.

**A pergunta a que isto tem de responder**, por ordem de valor:

1. Quantos aparelhos usaram a app esta semana?
2. Que abas é que eles abriram?

A segunda não é curiosidade. O Dome tem **121 trechos por traduzir** — o maior
bloco que resta do `BALANCO.md`. Se ninguém abre o Dome, isso não se traduz.
Neste momento essa decisão tomava-se a adivinhar.

---

## O que o levantamento mostrou, e que muda o desenho

### 1. O endereço do Worker é escrito à mão, em cada aparelho

O Worker do Assistente não tem endereço nenhum no código. A app lê-o do
`localStorage`, na chave `calculadores-assistente-worker-url`, e quem o põe lá
é a pessoa, a escrevê-lo no campo "Endereço do Worker" da aba Assistente
(`index.html:216`).

**Consequência directa:** uma contagem que passasse por esse endereço contaria
os aparelhos onde alguém configurou o Assistente à mão — provavelmente um, o
do mike. **Contaria zero utilizadores.**

A contagem precisa de um endereço **fixo, escrito no código**.

### 2. E esse endereço não pode ser o do Worker do Assistente

Pôr o endereço do Worker do Assistente no código-fonte publica-o. O
`wrangler.toml` diz que o `ALLOWED_ORIGINS` "continua a bloquear pedidos
diretos (curl/scripts) de outras origens" — **e isso é optimista**. O `Origin`
é um cabeçalho de pedido: um browser não o pode forjar, um `curl` forja-o numa
linha. Na prática, o que hoje protege aquele Worker da conta da Anthropic é o
endereço dele **não estar publicado**.

Publicá-lo para contar utilizadores seria trocar uma coisa que não custa nada
por um risco na factura da API.

**Por isso: um Worker à parte, só para a contagem.** Endereço público, nada de
valor atrás dele, nada para gastar. Uma chamada abusiva a esse Worker suja uma
contagem interna — não custa dinheiro nem expõe nada.

---

## A regra

**Conta-se quantos, nunca quem. E diz-se que se está a contar.**

A segunda metade não é um extra. O `BALANCO.md` diz, sobre esta app, que
*"nada sai do telemóvel"* — e passa a não ser inteiramente verdade. Uma app
que promete uma coisa e faz outra em silêncio é exactamente o defeito nº 4 da
lista (*"o silêncio"*), desta vez virado contra quem confia nela.

---

## Fase A — o Worker da contagem

Novo Worker `calculadores-uso`, ao lado do que já existe (`worker/` passa a ter
um irmão, `worker-uso/`, com o seu `wrangler.toml` e a sua KV `USO`).

**`POST /uso`** — o que a app manda:

```json
{ "app": "calculadores", "id": "<uuid da instalação>", "versao": "v3.90",
  "abas": ["projecao", "led", "projeto"] }
```

Guarda em KV com a chave `d:<AAAA-MM-DD>:<app>:<id>` e o valor `{versao, abas}`,
com `expirationTtl` de 90 dias. A data vem do relógio do **Worker**, não do
aparelho: um telemóvel com a data trocada não estraga a contagem.

Valida com mão pesada e cala-se: `id` tem de ser um UUID, `abas` no máximo 20
nomes de uma lista fechada, corpo abaixo de 2 kB. O que não encaixar é
descartado sem erro — não há nada aqui que valha uma mensagem de volta.

**`GET /uso/resumo`** — com `Authorization: Bearer <ADMIN_TOKEN>`, o mesmo
padrão do `/registos` que já existe (`worker/src/index.js:255`). Devolve, por
semana: aparelhos distintos, por app, e a contagem por aba.

**`ALLOWED_ORIGINS`** igual ao do outro, mais o `localhost` para se poder medir
em desenvolvimento.

## Fase B — o lado da app

- **A identidade da instalação**: `calculadores-instalacao-v1`, um
  `crypto.randomUUID()` gerado à primeira vez. Não é uma pessoa — é uma cópia
  da app. Quem limpar os dados do browser passa a contar como nova.
- **As abas desde o último envio**: acumula os `data-mode` num `Set`, na
  mesma chave do `localStorage`. É a lista fechada que o Worker aceita, e não
  leva nada do que foi escrito nos campos.
- **Uma vez por dia, no máximo.** Guarda a data do último envio; se for de
  hoje, não manda nada.
- **Falha em silêncio e nunca bloqueia.** `fetch` com `keepalive`, sem `await`
  em lado nenhum do arranque. Sem rede — um pavilhão sem wifi, que é onde esta
  app mais serve — não há contagem nesse dia, e as abas ficam acumuladas para
  a próxima vez que houver ligação.
- **Nunca ao arrancar a app.** Manda-se depois de a pessoa abrir a primeira
  aba, para não pesar no arranque e para não contar quem abriu e fechou.

O mesmo, igual, no Preview (`app: "preview"`) — senão não se fica a saber se o
3D é usado, que é metade da pergunta.

## Fase C — dizê-lo, e o interruptor

- **Uma linha na aba Ajuda**, por palavras que se percebam: o que é enviado
  (um número aleatório, a versão, que abas foram abertas), o que **não** é
  (nada do projeto, nada escrito nos campos, nenhum nome, nenhum ficheiro), e
  para quê.
- **Um interruptor ao lado dela**, que desliga mesmo. Guardado na mesma chave.
- **Um botão para esquecer o número** e gerar outro, para quem quiser.
- Fica na Ajuda e não numa janela à entrada: um aviso que interrompe é um
  aviso que se fecha sem ler.

## Fase D — fechar o ciclo

O balanço semanal por email passa a levar a linha que hoje não pode levar:
**quantos aparelhos usaram a app, e que abas**. A rotina já corre às segundas;
falta-lhe o número.

---

## Fica de fora, e porquê

- **IP, país, aparelho, browser.** Não respondem a nenhuma das duas perguntas,
  e transformam uma contagem numa vigilância.
- **Quanto tempo esteve aberta, ordem dos cliques, caminhos.** Idem. Isto não
  é um produto com funil de conversão, é uma ferramenta de trabalho.
- **Qualquer coisa escrita nos campos.** Nunca. Um projeto é do cliente de
  quem o está a fazer.
- **Contar o Assistente.** Já tem os seus `REGISTOS` próprios, para outra coisa
  (a revisão semanal do que a IA extraiu). Não se mistura.

## Ficheiros

- `worker-uso/` — novo: `wrangler.toml`, `src/index.js`, `package.json`
- `.github/workflows/deploy-worker.yml` — um segundo *job*, com o mesmo
  desenho do primeiro (as verificações antes de gastar tempo, o `npm ci`, o
  resumo no fim)
- `calculadores/index.html` — a identidade, o acumulador de abas, o envio, a
  linha na Ajuda e o interruptor
- `preview/js/app.js` — o mesmo, do outro lado
- `BALANCO.md` — a frase *"nada sai do telemóvel"* passa a ter uma nota

## Verificação

1. **Com o interruptor desligado, não sai nada.** Medido no separador de rede,
   não assumido.
2. **Duas aberturas no mesmo dia dão um envio só.**
3. **Sem rede, a app abre e calcula na mesma** — e as abas acumuladas saem no
   dia seguinte, quando houver ligação.
4. **O `/uso/resumo` sem o token dá 401.**
5. **Um corpo malformado é descartado sem 500.**
6. **Dois aparelhos diferentes contam dois**, e o mesmo aparelho duas vezes
   conta um.

## O que isto nunca saberá

Quem. Por desenho, e não por esquecimento. Se um dia a pergunta passar a ser
*"quem é que está a usar o quê"*, isso é outro sistema e outra conversa — não
se chega lá por acrescentos a este.
