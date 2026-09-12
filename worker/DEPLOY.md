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

Os três namespaces já existiam na conta, e os ids estão no `wrangler.toml`.
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
