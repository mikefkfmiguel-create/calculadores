# Publicar o Worker

O Worker do Assistente deixou de se publicar à mão. O que isso resolve: uma
alteração ao Worker podia ficar em `main` sem estar no ar, sem nada a
dizê-lo — foi o que aconteceu com a memória do Assistente, que ficou merged e
inactiva à espera de alguém se lembrar de correr `wrangler deploy`.

## Como funciona agora

O workflow **`.github/workflows/deploy-worker.yml`** publica sozinho sempre
que algo dentro de `worker/` entra em `main`. Também se corre à mão, para
republicar sem ter mexido em código (por exemplo depois de trocar um secret
no Cloudflare):

> GitHub → **Actions** → **Publicar o Worker** → **Run workflow**

Se faltar configuração, o workflow **pára logo no primeiro passo e diz por
palavras o que falta** — em vez de deixar o `wrangler` rebentar lá à frente
com um erro de API.

## O que é preciso configurar, uma vez

Estes três passos precisam da conta Cloudflare, por isso são para fazer no
teu PC. Depois disto, nunca mais.

### 1. ~~Os ids das KV~~ — feito

As **quatro** existem na conta e os ids estão no `wrangler.toml`. A `USO` (a
da contagem de utilização) foi criada a 15/09/2026, no PowerShell, com
`npx.cmd wrangler kv namespace create USO` — o `.cmd` porque a política de
execução do Windows não deixa correr o `npx.ps1`, e é a forma que passa sem
ter de mexer na política da máquina.

Os outros três namespaces já existiam, e os ids estão no mesmo sítio.
Não são segredos — são identificadores, o mesmo que aparece no URL do painel
— e é por isso que vivem no repositório: quem publica passou a ser o GitHub,
e o GitHub só sabe o que estiver neste ficheiro.

O `account_id` está lá pela mesma razão, o que poupa um secret.

Para os reconferir a qualquer momento: no painel do Worker, o quadro
**Bindings** mostra o namespace a que cada nome aponta. Um id trocado não dá
erro nenhum — passa a escrever no namespace errado, calado.

### 2. Um secret no GitHub

> GitHub → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**

| Nome | O que é | Onde se arranja |
|---|---|---|
| `CLOUDFLARE_API_TOKEN` | Token de API da Cloudflare | Dashboard → **My Profile** → **API Tokens** → **Create Token** → modelo **"Edit Cloudflare Workers"** |

O modelo "Edit Cloudflare Workers" já traz as permissões certas (publicar o
Worker e mexer nas KV). Não uses a Global API Key — dá acesso a tudo, e um
token dedicado revoga-se sozinho sem mexer no resto.

É o único segredo desta publicação.

### 3. Os secrets do próprio Worker

Estes vivem **no Cloudflare**, não no GitHub, e **uma publicação nunca lhes
toca** — define-se uma vez e ficam:

```bash
npx wrangler secret put ANTHROPIC_API_KEY   # a chave da Anthropic
npx wrangler secret put ADMIN_TOKEN         # protege a rota /registos
npx wrangler secret put RESEND_API_KEY      # envia o email do feedback
```

A chave da Anthropic **nunca** entra em nenhum ficheiro deste repositório.

## Depois de publicar

A página do workflow mostra o commit que ficou no ar. Para confirmar que o
Worker está mesmo a responder, o teste rápido de sempre:

```bash
curl -s -X POST https://calculadores-assistente.avkvideoshare.workers.dev/extrair \
  -H "Origin: https://mikefkfmiguel-create.github.io" \
  -H "Content-Type: application/json" \
  -d '{"text":"Ecrã LED de 6 por 3 metros, sala para 300 pessoas sentadas"}'
```

O campo é **`text`**, não `texto` — o Worker responde 400 com *"Falta o texto do
projeto…"* a quem lhe mande a chave errada, que é fácil de confundir com um
Worker partido quando não é.

Uma resposta boa traz `requisitos` com as medidas extraídas. Confirmado a 12 de
setembro, na primeira publicação por CI: `200`, 5,1 s, com `larguraM: 6`,
`alturaM: 3`, `numeroParticipantes: 300` e `tipoEcra: "led"`.

## Notas

- O `package-lock.json` está no repositório de propósito: o workflow usa
  `npm ci`, para publicar sempre com a versão do wrangler que foi testada e
  não com a que por acaso for a mais recente nesse dia.
- O wrangler está na linha 3.x. A 4.x existe e avisa disso a cada corrida,
  mas mudar de major é trabalho à parte, com o seu próprio teste — não se
  mistura com pôr o deploy automático de pé.
- Dois merges seguidos não se atropelam: o segundo espera pelo primeiro
  (`concurrency` no workflow).

## A procura de modelos na web (`/modelo`)

Desde a v4.18 dos Calculadores: quando se escreve um modelo que a lista não
tem ("xiripiti 55"), a app pede a esta rota que **procure a ficha na web** e
acrescenta-a sozinha.

```
POST /modelo   { "q": "xiripiti 55", "tipo": "tv" }
→ { "ok": true,  "modelo": { modelo, diag, ratio, resolucao, touchscreen, fonte }, "procurou": [urls] }
→ { "ok": false, "motivo": "…", "procurou": [urls] }
```

**O crivo é o que a torna utilizável numa ficha de produção.** Nada sai daqui
sem passar por ele:

- a pesquisa corre a sério (`web_search`, do lado da Anthropic) — não é
  memória do modelo;
- a `fonte` tem de ser **uma das páginas que a pesquisa devolveu**. Números
  certos com um endereço escrito de cabeça são recusados, e é o caso mais
  perigoso porque parece bem;
- a diagonal tem de ser de um ecrã (7"–130"), o rácio tem de ser um dos
  conhecidos, e a resolução só entra com os dois lados;
- sem isso: `ok: false`. A app fica com a geometria que sabe fazer sozinha e
  **ninguém escreve um número inventado**.

Corre em `claude-haiku-4-5` com `web_search_20250305` (a variante com
filtragem dinâmica pede um modelo 4.6+). **Custa**: uma chamada à API por
procura, mais as pesquisas em si, que são faturadas à parte pela Anthropic.
Leva a **mesma trava de gasto** do Assistente (`LIMITE_IA_POR_IP` /
`LIMITE_IA_POR_DIA`) — as duas rotas partilham o mesmo contador diário, por
isso subir o uso de uma reduz a outra. Do lado da app há ainda uma memória de
sessão: o mesmo texto não é perguntado duas vezes.

Testes: `node --test "worker/testes/modelo.test.mjs"` — nenhum deles gasta um
cêntimo (a chamada à Anthropic é interceptada).

## A trava de gasto da IA

O endereço deste Worker está publicado no `index.html` que o GitHub Pages
serve. O `ALLOWED_ORIGINS` **não** impede um script: o `Origin` é um cabeçalho
do pedido, e um `curl` escreve lá o que quiser. Os limites de tamanho que já
existiam limitam o que cada chamada custa, não **quantas** chamadas se fazem.

Duas travas, ambas só na rota do Assistente (a `/uso`, da contagem de visitas,
não fala com a Anthropic e não leva trava nenhuma):

| Variável | Omissão | Para que serve |
|---|---|---|
| `LIMITE_IA_POR_IP` | 30 | Trava o abuso casual. Largo de propósito — o escritório inteiro sai com o mesmo endereço. |
| `LIMITE_IA_POR_DIA` | 200 | **É esta que protege a factura.** O pior dia possível tem um preço conhecido. |

Mudam-se no `[vars]` do `wrangler.toml` e volta a publicar-se — sem mexer em
código. O IP vem do cabeçalho que a **Cloudflare** escreve, e nesse não se
mente, ao contrário do `Origin`.

**Sem KV configurada a trava não trava**, de propósito: um Worker mal
configurado deixar de responder ao Assistente seria pior do que o risco que
isto cobre.

E a última barreira não é esta: vale a pena ver no painel da Anthropic se dá
para pôr um tecto de gasto na conta ou na área de trabalho onde a chave vive.
Essa não depende de código nenhum.

## O painel do movimento (um link para consultar)

`https://calculadores-assistente.avkvideoshare.workers.dev/uso/painel?t=<TOKEN_USO>`

Abre no telemóvel e mostra aparelhos distintos por app, o movimento por dia e
as abas mais abertas. Períodos de 7, 30 ou 90 dias.

**Precisa de um segredo próprio**, uma vez — e dá pelas duas vias:

- **No painel da Cloudflare** (dá pelo telemóvel): *Workers & Pages →
  calculadores-assistente → Settings → Variables and Secrets → Add*. No tipo,
  **Secret** e não "Text" — um "Text" é apagado na publicação seguinte, porque
  essas variáveis vêm do `wrangler.toml`; um Secret fica. Nome `TOKEN_USO`.
- **Ou no computador:** `npx.cmd wrangler secret put TOKEN_USO`

De qualquer das formas, guarda a palavra: depois de gravada não há como a
voltar a ver. A própria página diz isto tudo enquanto o segredo não existir.

**Porque é que não usa o `ADMIN_TOKEN`:** um browser não manda cabeçalhos ao
abrir um link, por isso o token tem de ir no endereço — e um endereço fica no
histórico, nos favoritos e em qualquer sítio para onde seja reencaminhado. O
`ADMIN_TOKEN` abre também o `/registos`, que guarda **o texto dos pedidos
reais** ao Assistente: briefings de clientes. Essa chave não pode andar num
link. O `TOKEN_USO` só abre contagens — se escapar, o que escapa é saber
quantas pessoas abriram uma calculadora.

Sem `TOKEN_USO` definido a página não se desenrasca com o `ADMIN_TOKEN`: diz o
comando que falta. O `/uso/resumo` (JSON, cabeçalho `Authorization`, para
scripts e para o balanço semanal) continua como estava, com o `ADMIN_TOKEN`.

A conta vive num sítio só (`contasDeUso()`), usada pelos dois — para o JSON e a
página nunca discordarem.
