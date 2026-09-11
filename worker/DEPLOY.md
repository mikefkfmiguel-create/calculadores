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

### 1. Os ids das KV, no `wrangler.toml`

O `wrangler.toml` ainda tem `cola-aqui-o-id` nos três namespaces. Não são
segredos — são identificadores, e é por isso que vivem no repositório.

Se os namespaces **já existem**:

```bash
cd worker
npx wrangler kv namespace list
```

Se **ainda não existem** (cria cada um uma vez):

```bash
npx wrangler kv namespace create PARTILHAS
npx wrangler kv namespace create REGISTOS
npx wrangler kv namespace create FEEDBACK
```

Qualquer dos dois devolve um `id` por namespace. Troca no `wrangler.toml`:

| binding | trocar |
|---|---|
| `PARTILHAS` | `cola-aqui-o-id` |
| `REGISTOS` | `cola-aqui-o-id-registos` |
| `FEEDBACK` | `cola-aqui-o-id-feedback` |

Commit e push — isso por si só já dispara a primeira publicação.

### 2. Dois secrets no GitHub

> GitHub → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**

| Nome | O que é | Onde se arranja |
|---|---|---|
| `CLOUDFLARE_API_TOKEN` | Token de API da Cloudflare | Dashboard → **My Profile** → **API Tokens** → **Create Token** → modelo **"Edit Cloudflare Workers"** |
| `CLOUDFLARE_ACCOUNT_ID` | O id da conta | `npx wrangler whoami` mostra-o, ou vem no painel do Cloudflare |

O modelo "Edit Cloudflare Workers" já traz as permissões certas (publicar o
Worker e mexer nas KV). Não uses a Global API Key — dá acesso a tudo, e um
token dedicado revoga-se sozinho sem mexer no resto.

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
curl -s -X POST https://calculadores-assistente.<o-teu-subdominio>.workers.dev/extrair \
  -H "Origin: https://mikefkfmiguel-create.github.io" \
  -H "Content-Type: application/json" \
  -d '{"texto":"ecrã de 6 por 3 metros"}'
```

## Notas

- O `package-lock.json` está no repositório de propósito: o workflow usa
  `npm ci`, para publicar sempre com a versão do wrangler que foi testada e
  não com a que por acaso for a mais recente nesse dia.
- O wrangler está na linha 3.x. A 4.x existe e avisa disso a cada corrida,
  mas mudar de major é trabalho à parte, com o seu próprio teste — não se
  mistura com pôr o deploy automático de pé.
- Dois merges seguidos não se atropelam: o segundo espera pelo primeiro
  (`concurrency` no workflow).
