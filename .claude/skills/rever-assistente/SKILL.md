---
name: rever-assistente
description: Revisão semanal dos pedidos reais ao Assistente de Projeto (Cálculos e Preview) vs. o que a IA extraiu, para encontrar padrões e ajustar o Worker (schema/prompt) — só com base em pedidos reais, nunca inventado. Usar quando a rotina semanal disparar, ou quando pedido diretamente ("revê o assistente", "como está o assistente a sair-se").
---

# Revisão semanal do Assistente

Nasceu de um pedido direto do mike: *"ela tem de ir aprendendo... podemos
montar uma skill para isso e acordar que automaticamente fazes a busca e
comparas entre os pedidos e as resposta dela para ajustar o worker, e
marcávamos de semana a semana a revisão para ajustar o worker, uma vez que
não podes fazê-lo sozinho"* — a segunda parte deixou de ser verdade a meio
da mesma sessão (ganhei um token de deploy scoped só a este Worker), mas o
resto do combinado continua: nunca inventar regras novas sem verem-se em
pedidos a sério.

## 1. Ir buscar os pedidos recentes

```
curl -sS "https://calculadores-assistente.avkvideoshare.workers.dev/registos" \
  -H "Authorization: Bearer $ASSISTENTE_ADMIN_TOKEN"
```

O token e as credenciais de deploy vivem em
`/tmp/claude-0/-home-user-calculadores/2001e5c0-0e12-5ae8-991e-a4d66ff36a02/scratchpad/cf-creds.env`
(`source` esse ficheiro primeiro). Se essa sessão/scratchpad já não
existir (sessão nova, sem memória disto), pedir ao mike os três valores de
novo (`CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`,
`ASSISTENTE_ADMIN_TOKEN`, `RESEND_API_KEY`) em vez de tentar adivinhar ou
recriar — nunca ficam no repositório.

Cada registo tem `quando`, `texto` (o pedido, ou `null`), `temPdf`,
`temImagem`, e `requisitos` (o que a IA extraiu). Ficam 30 dias — o que já
saiu dessa janela já não aparece.

## 2. O que procurar

Comparar `texto` com `requisitos`, campo a campo, à procura de:

- **Um dado que a pessoa deu claramente no texto e ficou `null`** (ou
  errado) em `requisitos` — sinal de que falta um campo no
  `EXTRACT_TOOL`, ou que a instrução para um campo existente está
  ambígua.
- **Um padrão que se repete** em vários registos (não um caso isolado) —
  um só pedido estranho pode ser só um pedido mal escrito; três pedidos
  parecidos a falhar da mesma forma é um gap a sério.
- **`pontosPorConfirmar` a listar coisas que já deviam estar nos campos
  próprios** (sinal de a IA estar a "desistir" de um campo que devia
  preencher).
- **`resumo` a mostrar que a IA percebeu algo que não chegou aos campos
  estruturados** — o mesmo tipo de problema que "de pé"/"300 pessoas"
  eram, antes de virarem `numeroParticipantes`/`publicoEmPe`.

Casos de referência já resolvidos (para não repetir o trabalho, e para
servirem de modelo de como um fix bom fica):
`local.numeroParticipantes` + estimativa por densidade (v3.20),
`local.publicoEmPe` + densidade de pé vs. sentado (v3.21).

## 3. Nunca

- Nunca acrescentar um campo ou regra que "pareça fazer sentido" sem ver
  pelo menos um pedido real que precisasse dele — a regra do projeto
  (`CLAUDE.md`) proíbe inventar dados técnicos, e o mesmo espírito
  aplica-se a inventar capacidades do Assistente.
- Nunca deixar a IA calcular uma medida física a partir de uma contagem de
  gente, de uma foto, ou de qualquer coisa sem escala fiável — isso
  continua sempre do lado do cliente (`renderScreenRecommendation()` em
  `index.html`), com uma norma real e citada.
- Nunca aplicar um ajuste a partir de UM caso isolado esquisito — texto
  mal escrito ou ambíguo existe sempre; o que interessa é o padrão.

## 4. Implementar, testar, publicar

1. Editar `worker/src/index.js` (`EXTRACT_TOOL` para novos campos/
   instruções mais claras) e, se o cálculo for do lado do cliente,
   `index.html` (`renderScreenRecommendation()` ou onde fizer sentido).
2. Testar localmente antes de publicar — ver
   `worker/test-worker-feedback.mjs` (scratchpad desta sessão, se ainda
   existir) como modelo de teste com KV/fetch mockados, ou escrever um
   teste novo parecido para o caso em questão.
3. Publicar o Worker sozinho (token já scoped só para isto):
   ```
   source .../scratchpad/cf-creds.env
   cd worker && npx --yes wrangler deploy
   ```
4. Confirmar em produção com um pedido real a sério (curl direto), não só
   no mock.
5. Se `index.html` também mudou: bump de versão (`#app-versao` +
   `CACHE` no `sw.js`), PR normal (draft → ready → merge). Só o Worker
   mudar não pede bump.
6. Actualizar `PARA-CONTINUAR.md` com uma entrada datada, como sempre.

## 5. Reportar ao mike

Resumo curto: quantos pedidos na semana, o que mudou (ou "nada a mudar
esta semana, os pedidos estavam bem cobertos"), e por que — sem despejar
os registos todos na conversa.
