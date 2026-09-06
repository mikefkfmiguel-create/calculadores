# Calculadores (Mike Apps Calculadores) — contexto para o Copilot

PWA estática para cálculos de AV/produção de eventos, uso interno da AVK Portugal, publicada no GitHub Pages. Lê também `/CLAUDE.md` na raiz — as convenções aí (bump de versão, nunca inventar dados técnicos, publicar sempre via PR para `main`) aplicam-se da mesma forma aqui.

## Arquitetura

- `index.html` — a app quase toda: HTML de todas as calculadoras (tabs) + um `<script>` gigante no fundo com toda a lógica JS. Funções e `var` de topo (não dentro de nenhuma IIFE) são partilhadas por closure com o resto do ficheiro, incluindo com a IIFE do Assistente de Projeto perto do fim do ficheiro.
- `sw.js` — service worker. `CACHE = "calculadores-vNN"` tem de subir sempre que `index.html` muda visivelmente para o utilizador, em sincronia com o `<span class="mark">vX.Y</span>` perto da linha 28 de `index.html`. Cache-first para a app shell, network-first para `data/*.json`.
- `data/*.json` — inventário real (LED tiles, TVs, projetores, lentes, processadores/switchers) usado por todas as calculadoras. Nunca inventar valores aqui; entradas de mercado (não são propriedade da AVK) têm `"mercado": true`, entradas próprias da AVK omitem esse campo — convenção única nos 4 ficheiros com essa distinção (`led-tiles.json`, `tvs.json`, `projectors.json`, `processors.json`). O `modelo` em si é só o nome/designação do equipamento, sem "(stock)" nem outras anotações — a distinção azul/negrito nos menus e a prioridade nas buscas do Assistente vêm sempre de `!item.mercado` (ver `addOption`/`stockFirstIndices` em `js/utils.js`), nunca de sniffing de texto no nome.
- `worker/src/index.js` — Cloudflare Worker que faz de proxy seguro para a API da Anthropic (a chave nunca pode estar no código estático). **Importante: não há deploy automático.** Sempre que este ficheiro muda, tem de se dar o conteúdo completo ao utilizador para ele colar manualmente no dashboard da Cloudflare (Edit code → colar tudo → Save and deploy). Nunca assumir que uma alteração aqui já está "live" só por ter sido commitada.

## Assistente de Projeto (a feature mais ativa deste repo)

Fluxo: o utilizador cola texto e/ou carrega um PDF/imagem (PNG/JPEG) de um briefing ou foto de evento → `index.html` envia para o Worker → o Worker chama a Anthropic com `tool_choice` forçado sobre `EXTRACT_TOOL` (schema JSON) → devolve só dados extraídos, nunca uma recomendação em prosa livre. **Princípio de arquitetura estabelecido:** a IA só extrai factos do texto/imagem; todo o cálculo/recomendação (ângulos, tamanhos, equipamento) é feito em JS no cliente, contra dados reais — nunca pedir à IA para "recomendar" tecnologia diretamente, isso seria inventar/alucinar specs.

**Imagens (fotos/renders de eventos):** o ficheiro em `#asst-pdf` aceita `application/pdf,image/png,image/jpeg`; o cliente decide por `file.type` se envia `pdfBase64` (documento, comportamento original) ou `imageBase64`+`imageMediaType` (imagem) — nunca os dois. O Worker aceita ambos os campos e monta o content block certo (`document` vs `image`) para a Anthropic. **Regra crítica:** uma foto/render nunca tem escala fiável — a IA só pode usá-la para identificar visualmente o tipo de tecnologia (ex: "é um ledwall"), nunca para medir/estimar dimensões, distâncias, pixel pitch ou nits; isso teria de vir sempre do texto (ex: as dimensões da sala nova onde o utilizador quer replicar o que a imagem mostra). Esta regra está reforçada em vários pontos do prompt do Worker — se voltar a aparecer alucinação de medidas a partir de imagem, reforçar aí, não inventar uma exceção do lado do cliente.

### Schema de extração (`worker/src/index.js`, `EXTRACT_TOOL`)

Campos principais: `tipoEcra` (led/projecao/blend/misto/desconhecido), `dimensoes` (tamanho do ECRÃ, nunca da sala — distinção crítica, já houve bug de confundir isto), `local` (`distanciaProjecaoM`, `distanciaVisualizacaoM`, `larguraPlateiaM`, `alturaSalaM`, `interior`, `curvo`), `led`, `orcamento`, `projeto` (nome/datas), `resumo`, `pontosPorConfirmar`.

Comportamento importante já afinado: quando o texto só descreve a sala (largura × profundidade × altura) sem "plateia" explícita, `distanciaVisualizacaoM` e `larguraPlateiaM` devem ser estimados a partir da profundidade/largura da sala (não ficar `null`), sinalizando a suposição em `pontosPorConfirmar`. Isto é intencionalmente diferente de `dimensoes`, que continua estritamente proibida de usar medidas de sala.

### Motor de sugestão de dimensionamento (client-side, em `index.html`) — REDESENHADO

**Importante: a versão descrita aqui substitui um design anterior** (que chegou a incluir busca de grelha de TV, alternativa de TVs "delay" e um veredito que apontava uma tecnologia). Esse design foi propositadamente removido — decisão explícita do utilizador: *"ela deve devolver as três melhores opções de tamanhos e não de tecnologia — essa parte vem a seguir e por escolha minha"*. Se achares código ou uma PR antiga a fazer busca de grelha de TV dentro do Assistente, é obsoleto — não reintroduzir sem pedido explícito.

Quando o ecrã ainda **não tem um tamanho concreto** (nem `dimensoes.larguraM`+`alturaM`, nem `diagonalPolegadas` — ver `hasScreenDims` em `renderScreenRecommendation()`) mas já há `distanciaVisualizacaoM` (dada ou estimada), o painel do Assistente calcula e mostra, sem pedir nada à IA e **sem tentar decidir tecnologia nenhuma**:

- **Nº de ecrãs** para ângulo lateral confortável (SMPTE EG-18-1994, ≤30°) via `screensNeededForAngle(audienceWidth, distance, maxAngleDeg)`.
- **3 tamanhos**, um por nível AVIXA (`AVIXA_CONTENT.detailed` ×4 "texto denso", `.basic` ×6 "leitura normal", `.passive` ×8 "pouco detalhe") — cada um escondido individualmente se não couber no pé-direito da sala (`local.alturaSalaM`); regra geral do motor continua "nunca mostrar um número que não sirva".
- Um seletor (`#asst-rec-tier-seg`) escolhe qual dos 3 tamanhos os botões **"Usar em Ecrã LED"** / **"Usar em Distância de Projeção"** aplicam (via `lastRecommendation.tiers[asstRecSelectedTier]`) — a tecnologia é sempre escolha do utilizador, feita ao clicar num desses botões ou diretamente na aba TVs (que não tem botão próprio aqui, porque o catálogo de TVs é discreto — modelos reais, não tamanho contínuo).
- A **imagem/foto** anexada (ver secção "Imagens" acima) pode fixar `tipoEcra` (ex: uma foto óbvia de ledwall) sem por isso desativar esta sugestão — o gate certo é `hasScreenDims`, não `tipoEcra`; ver commit/PR "sugestão de tamanho aparece mesmo com tecnologia já identificada".
- **Popup de alarme** (`showAlarm()`, ver secção própria abaixo): se NENHUM dos 3 tamanhos couber no pé-direito indicado (nem o menos exigente, ×8), interrompe com um popup em vez de só uma linha no veredito — com o texto do pedido pré-preenchido e editável, e botão "Reanalisar" que aplica a edição e chama o Worker de novo sem sair do popup.

### Popup de alarme (`showAlarm()`, `js/utils.js`)

Componente `<dialog>` partilhado (`#app-alert-dialog`) para **valores fisicamente impossíveis ou limites reais ultrapassados** — nunca para simples dúvidas de leitura da IA (essas continuam nas caixas de aviso inline já existentes, ex: `asst-avisos`/"Confirma antes de aplicar"). Assinatura: `showAlarm({ title, message, editText, actionLabel, onAction(newText) })` — sem `editText`/`actionLabel`/`onAction`, mostra só "Fechar".

Usos atuais:
1. Assistente — pé-direito insuficiente para os 3 tamanhos (ver secção acima).
2. Grafismo px↔cm — resolução ultrapassa o limite de slide personalizado do PowerPoint (56×56 in, `PPT_MAX_SLIDE_IN` em `index.html`, função `calcGfx()`). **Cuidado ao reusar em calculadoras que recalculam a cada tecla** (input events): guardar um flag por-calculadora (ex: `gfxPptAlarmShown`) e só chamar `showAlarm()` na transição de "dentro do limite" para "fora do limite", nunca em todo recálculo — senão o popup reabre a cada dígito escrito. Repor o flag a `false` assim que a condição deixa de se verificar.

Pedido original do utilizador foi genérico ("cria popups sempre que ouves dúvidas ou valores ilegais... e por aí") — só os 2 casos acima foram implementados até agora. Não inventar deteção automática de "valores estranhos" para outras calculadoras — adicionar caso a caso, só quando reportado (mesma política de "nunca aprendizagem automática" abaixo).

### Gaps conhecidos / próximos passos possíveis

- O nível de detalhe de conteúdo já não precisa de deteção automática a partir do texto — os 3 níveis AVIXA aparecem todos, e a pessoa escolhe no seletor. (Gap antigo, já resolvido pelo redesenho acima — mantido aqui só para quem procurar o histórico.)
- `pontosPorConfirmar` por vezes devolve uma nota como "número e tamanho dos ecrãs ainda por definir", que pode parecer contraditória ao lado da sugestão de dimensionamento já calculada pela app — a IA não tem visibilidade sobre esse cálculo client-side. Se isto voltar a ser reportado, ajustar a instrução final do Worker (o texto grande passado como `content` de tipo `"text"` em `worker/src/index.js`) para não gerar esse aviso quando `tipoEcra` é `"desconhecido"`.
- Não há hoje nenhuma alternativa de "TVs delay" (distribuir ecrãs repetidores pela profundidade) em lado nenhum da app — foi removida do Assistente por decisão do utilizador (ver acima) e nunca existiu fora dele. Se for pedida de volta, construir como ferramenta à parte (não dentro da sugestão de tamanhos), já que essa sugestão é para ser puramente sobre tamanho.
- `showAlarm()` só tem 2 usos até agora (pé-direito no Assistente, limite do PowerPoint no Grafismo) — o pedido original de "popups de alarme sempre que houver valores ilegais" era mais amplo ("e por aí"); outros candidatos óbvios ainda por avaliar caso a caso: throw ratio fora do alcance de todas as lentes da base (Distância de Projeção), overlap negativo ou impossível (Blending), data rate acima da capacidade do link escolhido (Sinal & Data Rate). Nenhum destes foi pedido explicitamente ainda.
- **Nunca** construir "aprendizagem automática" para o Assistente — decisão tomada explicitamente com o utilizador. O modelo (Haiku) não retém nada entre pedidos; melhorias vêm de ajustar manualmente o schema/instruções do Worker quando um caso mal resolvido é reportado, nunca de um sistema que se auto-ajusta sem revisão. A mesma política aplica-se a `showAlarm()`: nunca detetar "valores ilegais" genericamente, só casos concretos hardcoded depois de reportados.

## Marca (rebranding — Mike Apps)

A app foi rebrandada de "AVK Calculadores" para "Mike Apps Calculadores" (`index.html`, `ecra-complexo.html`, `manifest.json`, `CLAUDE.md`, título e cabeçalho).

**O kit oficial da marca chegou** (commit "A marca Mike Apps: o logotipo e as regras de o usar", pasta `marca/` — SVGs vetoriais, `.ico`, PNGs em várias variantes/tamanhos, `marca/LEIA-ME.md` com a tabela "qual ficheiro usar" e as 3 regras de uso, `marca/prova.html` com o manual visual). Isto **substituiu** a primeira versão do ícone, que tinha sido uma reconstrução em SVG feita só a partir de uma especificação escrita (o ficheiro oficial nunca tinha chegado como anexo real até esse commit). Os ficheiros de produção em `icons/` (`mike-logo.png`, `favicon-16/32.png`, `apple-touch-icon.png`, `icon-192/512(-maskable).png`) foram gerados a partir dos PNGs oficiais em `marca/png/`, não da reconstrução:

- `icon-192.png`/`icon-512.png` (purpose "any", transparente) — downscale 2x exato de `marca/png/icone-192.png`/`icone-512.png` (esses ficheiros já vêm a 2x, ex. "icone-192.png" tem na verdade 384px).
- `favicon-16/32.png` e `mike-logo.png` (ícone inline do cabeçalho, 28px) — downscale de alta qualidade a partir do master `marca/png/icone-1024.png` (2048px), que já tem o padding/"ar à volta" correto para uso como ícone de app.
- `apple-touch-icon.png` — a partir de `marca/png/icone-1024-branco.png`, que é o ficheiro que o próprio kit designa para "onde a transparência não serve" (fundo branco opaco; o resto dos PNGs do kit é transparente).
- `icon-192-maskable.png`/`icon-512-maskable.png` — não há equivalente maskable no kit (é um conceito específico de PWA/Android, não de brand kit genérico), por isso continuam a ser compostos localmente: símbolo (`marca/png/simbolo-2048.png`, versão sem padding) sobre fundo escuro `#0E1418` (o `background_color`/`theme_color` do `manifest.json`), à escala mínima que garante que a forma inteira (incluindo os cantos quase-retos do quadrado, rx=30) cabe dentro do "safe circle" de raio 0.4×canvas exigido pelos adaptive icons — a escala é calculada a partir do raio máximo real dos pixels com alfa da imagem recortada, não de um valor fixo. Ver o script usado (histórico do commit) se for preciso regenerar a outro tamanho.

**Deliberadamente mantido "AVK"** nos sítios que descrevem equipamento/inventário real da empresa — isso é facto de negócio (de quem é o equipamento), não identidade visual da app: hints "Inventário da AVK" nas calculadoras, badge "Mercado" (`item && item.mercado`), notas "existe no grupo AVK" em `led-tiles.json`. Nunca "despromover" essas referências ao mexer na marca — só a identidade visual (nome, logo, ícone, título) muda.

## TVs — integração no Projeto e posição da aba

A aba TVs ganhou "Adicionar ao projeto" (`tv-addproject`, checkbox junto ao resumo) — antes não existia. Segue o padrão mais simples já usado por Distância de Visualização/Sinal & Data Rate/Media Server (`PROJECT_SOURCES` em `index.html`): soma-se como item independente à ficha técnica final (`renderProjectItems()`), **não** entra no grupo exclusivo "tipo de ecrã principal" (`PROJTYPE_LED_ADDPROJECT_IDS`/`PROJTYPE_PROJ_ADDPROJECT_IDS`) porque o catálogo de TVs é de unidades discretas (modelo+diagonal), sem os campos livres de tamanho em metros que esse grupo usa. Lembrar de manter `tv-addproject` em `ADDPROJECT_BY_MODE` (atalho fixo do topo) e `PROJ_ADDPROJECT_IDS` (limpar projeto) se esse padrão for copiado para outra calculadora nova.

A aba TVs também mudou de posição na navegação: agora vem logo a seguir a Distância de Visualização, antes de Ecrã LED & Pixel Pitch (pedido explícito do utilizador, já que TVs passou a ser uma opção de tecnologia escolhida cedo no fluxo, não um extra ao fundo).

## Convenções operacionais

- **Bump de versão obrigatório** em qualquer alteração visível: `<span class="mark">vX.Y</span>` em `index.html` E `const CACHE = "calculadores-vNN";` em `sw.js`, sempre os dois juntos, inteiro incrementado. Alterações só ao Worker não exigem bump.
- **PR sempre para `main`**, sem pedir confirmação extra (draft → ready → merge) — ver `CLAUDE.md`.
- **Conflitos de merge espúrios são frequentes** neste repo (histórico de squash-merge diverge a cada PR) mesmo sem alterações reais conflituantes. Resolver com: `git fetch origin main`, snapshot dos ficheiros locais, `git merge origin/main` (produz conflitos), copiar os snapshots por cima dos ficheiros conflituosos, confirmar `diff` vazio e zero marcadores de conflito, `git add` + commit do merge, push, tentar o merge do PR outra vez.
- **Testar antes de publicar**: usar Playwright com `context.newContext({ serviceWorkers: 'block' })` (evita que o service worker interfira nos testes) e abrir `<details>` colapsados via `document.querySelectorAll('.panel[data-mode="X"] details').forEach(d => d.open = true)` antes de interagir com campos.
- **Nunca inventar dados técnicos** — specs de equipamento, standards (SMPTE, AVIXA) ou thresholds têm de vir de fontes reais (procurar/confirmar antes de implementar), nunca assumidos.
