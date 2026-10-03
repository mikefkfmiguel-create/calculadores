# Calculadores (Mike Apps Calculadores)

PWA estática para cálculos de AV/produção de eventos, uso interno da AVK Portugal.

## Convenções

- Publicar sempre: fazer merge do trabalho terminado diretamente para `main` via PR, sem pedir confirmação extra (draft → ready → merge).
- Bump de versão em cada alteração visível ao utilizador: `<span class="mark">vX.Y</span>` em `index.html` (~linha 24) e `const CACHE = "calculadores-vNN";` em `sw.js` — sempre os dois juntos, inteiro incrementado.
- Nunca inventar dados técnicos (specs, capacidades, etc.) — só usar valores reais, com fonte.
- Prioridade: simplicidade para produção não-técnica.
- **Doc de transporte, sempre:** no fim de cada sessão de trabalho, acrescentar no TOPO de `PARA-CONTINUAR.md` uma secção datada (o que mudou, ficheiros, versão, o que ficou por fazer, como publicar) — é por lá que o agente de gestão do mike pega no trabalho quando ele está no PC.

## Base de conhecimento (`conhecimento/`)

Notas técnicas de afinação guardadas a pedido do mike, para responder a perguntas futuras sobre o assunto. Ler o ficheiro certo antes de responder:

- `conhecimento/novastar-mctrl4k-a8s-10bit-50hz.md` (+ `.pdf`): NovaStar MCTRL4K + receiving cards A8s, módulo ICND2153 96×96 1/24, sinal 10-bit 50Hz — significado de cada parâmetro do NovaLCT (Receiving Card), configuração para gradientes de grayscale a 100% e a 50% de brilho (18bit+, Input Bit Depth, gamma, current gain), validação com rampa e checklist.

Isto são notas práticas, não fichas do fabricante: não usar estes valores como dados de inventário em `data/*.json`.

**Como cresce (regra combinada com o mike):** sempre que numa conversa surgir algo novo sobre um tema destas notas (um valor que funcionou no terreno, um problema e a solução, outro módulo/processador), propor no fim acrescentá-lo — e só gravar com o ok dele. Nunca acrescentar palpites nem valores não confirmados.

**Para acrescentar ou criar uma nota:**
1. Editar/criar `conhecimento/<tema>.md` (e o `.pdf` se fizer sentido).
2. Atualizar `conhecimento/indice.json` (`ficheiro`, `pdf` opcional, `titulo`, `resumo`, `atualizado`). É daqui que a aba **Conhecimento** da app lê a lista.
3. Nota nova: acrescentar o `.md` a `DATA_FILES` em `sw.js`, para abrir sem rede.
4. Bump de versão (index.html + sw.js), como em qualquer alteração visível.

**Better call Mike** (aba `perguntar`, `js/perguntar.js` + `worker/src/pergunta.js`): perguntas técnicas com texto/foto. O Worker lê as notas de `conhecimento/` do GitHub Pages e responde com Sonnet + pesquisa web; a origem (notas/web/geral) é verificada no Worker, nunca confiada ao modelo. As propostas "📘 Propor como nota" chegam à rota `/registos` com `tipo: "proposta-nota"` (guardadas 120 dias) — rever com o mike e, com o ok dele, passar a nota pelos passos acima. Substitui o antigo **Assistente de Projeto** como porta de entrada: a aba `assistente` está escondida da barra (`.tab-escondida`, rótulo "Cálculos do projeto") mas continua a fazer a extração, as opções de tamanho e o "Aplicar". A barra "Levar este projeto para:" em cada resposta (Cálculos / Ecrã LED / Projeção / Preview 3D) passa para lá só o que a pessoa escreveu/anexou na conversa (nunca a resposta da IA), carrega em "Analisar" e segue para o destino com a sugestão de tamanho ou as medidas lidas; sem tamanho nenhum fica nos resultados a dizer o que falta. É uma conversa: por baixo da última resposta há a caixa "Responde ao que falta", com um campo por cada pergunta numerada da IA; histórico de 8 trocas (`HISTORICO_MAX` igual em `js/perguntar.js` e no Worker) e a conversa guarda-se no aparelho (`bcm-conversa-v1`). Cada conversa é um caso: a primeira vez que um caso é levado para os cálculos/3D, as duas apps são limpas a fundo (`limpezaProfunda`, mantendo histórico e modelos próprios) para nada do caso anterior vir atrás; o mesmo caso levado outra vez não limpa (`bcm-caso-levado-v1`). Princípio do mike para o motor de busca: ir a todo o lado à procura da melhor solução, **combinada com o que a calculadora já conhece** (inventário em `data/*.json`, projeto aberto) — hoje o Worker ainda só usa notas + web. O número de "Ligar ao Mike" é a constante `MIKE_TELEFONE` em `js/perguntar.js` (vazia = botões escondidos; público no código da página).

**App separada Better call Mike** (`mike/`, publicada em `…/calculadores/mike/`): a entrada de arranque rápido, instalável com ícone próprio (`mike/manifest.json`, `mike/icons/`, `mike/sw.js` rede-primeiro, scope só `mike/`). Usa o MESMO `js/perguntar.js` e `js/conhecimento.js` da app completa (mudar lá muda nas duas; a marcação do painel está duplicada em `mike/index.html`). Sem cálculos na página, "Levar este projeto para:" guarda o pedido em IndexedDB (`mikeapps-bcm`/`passagem`, mesma origem, ficheiros incluídos) e abre `../#levar=<destino>`; a app completa lê-o em `receberDaApp()` e segue para o destino (o Preview abre na mesma janela, porque aí não há toque para abrir outra). "← Voltar ao Better call Mike" volta a `mike/` quando se veio de lá.

## Ideias futuras (por explorar, não iniciar sem pedido explícito)

- **"Event planner total" para comerciais** (visão do mike, 3 out): de um briefing de orçamento, propor várias soluções (só stock / stock + mercado / ideal sem limites), cruzando inventário, contas das calculadoras e mercado (web, com fonte), incluindo opções fora do habitual. Detalhe em `PARA-CONTINUAR.md` (secção de 3 de outubro, fecho).
- **Versão "global" para venda**: separar o motor de pesquisa/cálculo (throw ratio, pixel pitch, data rate, etc. — genérico, reutilizável) do inventário/stock específico da AVK (equipamento próprio, badges "Mercado"/"Estimado", filtros de posse). Uma edição para venda a outras empresas manteria só os motores de pesquisa e cálculo, sem os filtros de stock da AVK, com versões traduzidas para outras línguas.
