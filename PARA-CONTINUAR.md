# Para continuar

Onde isto está, e o que falta. Escrito a 6 de setembro de 2026, atualizado a
7 de setembro (sessão Claude Code, depois de sincronizar com o trabalho feito
localmente entre 6 e 7 — ver "O que aconteceu depois" abaixo).

Quem pegar nisto — pessoa ou agente — deve ler primeiro o `CLAUDE.md` (as
convenções da casa) e o `.github/copilot-instructions.md` (arquitectura,
Assistente de Projeto, o motor de sugestão de dimensionamento, o popup de
alarme, e a lista de decisões já tomadas que não se voltam a discutir).

## Esta pasta ficou parada, e já não está

Esta pasta (`Desktop\APPS\calculadores`) esteve **455 commits atrás** do
`origin/main` — meses de trabalho feito directamente por PR no GitHub, sem
nunca se dar `git pull` aqui. A 6 de setembro de 2026 foi posta ao dia com um
`git pull --ff-only`. Ficaram por integrar (intencionalmente — são de fora do
Git) `LOGO/` e um `key.txt` vazio, que já lá estavam e não conflituam com nada
do repositório.

**Lição:** se voltar a passar-se tempo sem tocar nesta pasta, confirmar sempre
`git log --oneline HEAD..origin/main` antes de editar — trabalhar por cima de
uma base tão antiga far-se-ia sobre código que já não existe no `main`.

## A ponte com o Preview

O **Preview** (`mikefkfmiguel-create/preview`, pasta `Desktop\APPS\PREVIEW`) é
outro projeto, que mostra o que aqui se calcula montado numa sala em 3D. Vivem
no mesmo domínio e falam por `localStorage` — ver a tabela completa no
`.github/copilot-instructions.md`, secção "As pontes com o Preview".

A peça mais recente: o botão **"Analisar com a IA"**, do lado do Preview, chama
o **mesmo Worker** que o Assistente de Projeto usa aqui — o endereço vem do
`localStorage` que este repositório já escreve
(`calculadores-assistente-worker-url`). Não duplica o catálogo; manda só o
texto do pedido e a sala que já estiver desenhada, e aplica o que voltar.

**Susto corrigido (8 de setembro): loop contínuo de sincronização.** O
Preview passou a devolver o tamanho do ecrã/zonas sozinho (v2.48) sempre
que "Auto" está ligado — mas isso, combinado com `calcLedZones()` já
reescrever `mikeapps-projeto-v1` sem guarda nenhuma a cada recálculo
(mesmo os causados só por ACABAR de aplicar algo vindo do Preview), abriu
um ciclo fechado entre as duas apps, a cada ~700ms, sem parar sozinho.
Corrigido nos dois lados no mesmo dia (`lzAImportarDoPreview` aqui,
`ignorarProximoDevolver` no Preview — nenhum dos dois volta a ecoar de
volta uma alteração que acabou de chegar de fora). Detalhe técnico
completo no `PARA-CONTINUAR.md` do Preview.

**Cabeçalho sempre visível (8 de setembro).** Pedido direto do mike a
seguir ao susto do loop: sem ver o botão "Auto" sem subir ao topo, não dá
para desligar a sincronização depressa numa emergência destas. A linha
`.top` (Preview 3D / Sincronizar / Auto / Guardar / Abrir / Limpar) ficou
sticky, tal como a barra de abas (`.tabs-wrap`) já era — as duas
empilham-se uma por baixo da outra (`--top-h`, medido em JS via
ResizeObserver). Esta parte foi feita pelo GitHub Copilot directamente no
`main`, sem passar por aqui. O que faltava e foi corrigido nesta sessão:
`.results` (sidebar de resultados, usada em várias abas) ainda tinha
`top: 16px` fixo, ficando escondida atrás do novo cabeçalho sticky ao
descer a página — passou a somar `--top-h` também, tal como `#lz-add-top`
já fazia.

**Dois "DSM"/"Delay" com o mesmo nome, sem ligação nenhuma (8 de
setembro).** Reportado como "puxar o projeto não traz os delays/DSM do
Preview". Testei a ponte a sério (as duas apps a partilhar `localStorage`,
`/tmp/.../scratchpad/site` com symlinks para simular o mesmo domínio da
produção) — a sincronização em si está bem: zonas LED, zonas tipo TV/
Projeção (delay) e o DSM da Ecrã Complexo vão e voltam do Preview sem
perder nada, nos dois sentidos. O que não está ligado é outra coisa: a
aba **Projeto → Adicionais → DSM/Delay** (`proj-dsm-count`,
`proj-delay-count`) é um par de contadores manuais, só para o "Pixel
usage total" dessa aba — nunca leu a Ecrã Complexo nem via para o
Preview, mesmo com "Usar total das zonas" marcado. Em vez de ligar os
dois automaticamente (perderia o uso de estimar antes de montar as zonas
a sério), acrescentei um botão "↙ Trazer da Ecrã Complexo" em cada um
(mesmo padrão do "↙ Sinal & Data Rate" que já lá estava), que copia a
contagem real com um clique.

**Nome do projeto não chegava ao Preview (9 de setembro).** Reportado com
um screenshot: no viewport do Preview, em vez do nome do evento
("PCMA 2026 - FIL"), aparecia "Ecrã LED — 3 zona(s)". Causa: `lzPayloadPreview()`
(`js/zonas.js`, usada tanto pelo "Ver em 3D" como pela sincronização
automática) sempre mandou essa descrição genérica como `nome` — nunca lia o
campo **"Nome do projeto"** da aba Projeto (`#proj-nome`), por mais que
estivesse preenchido lá. Corrigido para usar esse campo quando não estiver
vazio, caindo na descrição genérica só quando o projeto ainda não tem nome
nenhum (inclui a página `ecra-complexo.html`, que não tem esse campo — cai
sempre na descrição, como antes, sem erro).
Testado com Playwright: com "PCMA 2026 - FIL" escrito na aba Projeto, o
payload gravado para o Preview (`mikeapps-projeto-v1`) sai com esse nome;
com o campo vazio, continua a sair "Ecrã LED — N zona(s)"; na página
avançada (sem o campo), sai a descrição genérica sem nenhum erro na consola.

**A correcção de cima "não estava a pegar" (9 de setembro, mesmo dia) —
causa a sério: cache-first também no `js/zonas.js` e na navegação.**
Publicado o v3.16, recarregado, e o nome do projeto continuava errado no
Preview ("olha que não"). Confirmado por `curl` directo à produção que o
código do v3.16 já lá estava (não era falha de deploy) — a causa era o
`sw.js`: **tudo** (incluindo o próprio `index.html` na navegação e o
`js/zonas.js`, o ficheiro que mais muda) servia sempre a versão em cache
primeiro, só indo à rede em segundo plano para a PRÓXIMA vez. Um só
recarregar depois de publicar continuava a mostrar o bug de antes — era
preciso recarregar duas vezes, sem nada que o dissesse. É a mesma classe de
susto que o Preview já tinha tido com `app.js`/`cena.js`, agora do lado de
cá.
Corrigido com a mesma receita: `js/zonas.js` e os pedidos de navegação
(`event.request.mode === "navigate"`, cobre tanto `index.html` como
`ecra-complexo.html`) passam a ir **primeiro à rede**, com o cache só como
reserva para quando não há net — o resto da casca (CSS, ícones, ficheiros
de dados, os outros `.js`, bem menos mexidos) continua cache-first, que é o
que garante o arranque num pavilhão sem wifi.
Testado com Playwright, simulando o cenário a sério (um marcador falso
posto directamente no cache, a fingir ser uma versão velha presa lá):
um `fetch` a `js/zonas.js` já não devolve essa versão falsa, vem sempre da
rede; recarregar a página com um `index.html` falso em cache mostra a
página real, não a mentira; e a app continua a abrir e a funcionar OFFLINE
(desliguei a rede a sério no teste) — a correcção não custou o "abre sem
rede" que é a razão de isto ser uma PWA. Confirmei também que o `sw.js` de
ANTES desta correcção falha exactamente estes três testes, para a
correcção não ser só "parece que sim".

**Duas peças a mais, a seguir a esta tarde inteira à volta do nome do
projeto (9 de setembro, mesmo dia).**

1. **"Não segue o nome que lhe dou".** Escrever no campo "Nome do
   projeto" (aba Projeto) só entrava na sincronização automática para o
   Preview no recálculo SEGUINTE das zonas — se a pessoa só mudasse o
   nome, sem tocar em zona nenhuma a seguir, o payload ficava preso no
   nome antigo (ou na descrição genérica) até algo mais mexer numa zona.
   `js/zonas.js` passou a ligar `#proj-nome` directamente a
   `lzGuardarParaPreview()` (`input`/`change`), o mesmo caminho que os
   campos do DSM já usavam. Testado com Playwright: criar uma zona, ir à
   aba Projeto, escrever só o nome (sem tocar em zonas outra vez) — o
   payload em `mikeapps-projeto-v1` já sai com o nome novo de imediato.

2. **De onde veio isto, e com que versão.** Sugestão directa a seguir a
   uma tarde a adivinhar por `curl` se uma correcção já estava publicada:
   "deviamos ter forma de identificar se são da calculadores ou do
   preview". `lzPayloadPreview()` passou a mandar `origemVersao` (lido de
   `#app-versao`) a par de `origem: "calculadores"`; do lado do Preview,
   `lerProjeto()` (`js/projeto.js`) guarda esse campo, e um projeto criado
   directamente no Preview (`garantirProjeto()`) estampa-se a si próprio
   como `origem: "preview"` com a SUA versão. O viewport do Preview mostra
   isto no `title` (só ao pairar o rato) — "Calculadores v3.18" ou
   "Preview v2.7x", conforme o caso. Detalhe completo do lado do Preview
   no `PARA-CONTINUAR.md` de lá.

**v3.19: AV Planner — uma marca a envolver as duas apps (9 de setembro,
ainda o mesmo dia).** Pedido directo: "o que achas de fazermos um rename
radical nestes dois meninos... ter apenas uma unificada, já que elas abrem
uma a outra". Decisão tomada com o mike: sem fundir código (as duas apps
continuam separadas, cada uma no seu repositório) — só uma "casca" por
cima, uma marca comum. Nasceu o repositório `AvPlanner`
(`mikefkfmiguel-create/av-planner`, publicado em
`mikefkfmiguel-create.github.io/AvPlanner/`), uma página só com a marca da
Mike Apps e um botão — "Abrir AV Planner" — que entra directamente aqui
nos Cálculos (o Preview 3D já está a um clique, no botão que já existe no
topo). O logótipo aqui (`#brand-logo`) passa a link para essa página, com
um `title` traduzido também para inglês (`js/i18n.js`).
Nota sobre instalar como app: as três continuam PWAs distintas — instalar
a partir da página AV Planner dá um ícone "AV Planner"; instalar
directamente daqui (o botão "Instalar" já existente) continua a dar
"Calculadores", como sempre deu. Não há um único ícone que represente as
três ao mesmo tempo sem fundir os manifests/service workers a sério, o
que fica de fora de propósito (mais uma vez, é código dos dois lados a
mudar, não só isto).

**v3.20: sugestão de tamanho a partir do nº de pessoas, sem sala nenhuma
indicada.** Reportado direto a seguir a um teste real: pediu-se ao
Assistente "opções para um evento como o exemplo [de uma foto anexada] para
300 pessoas" — a IA leu a imagem correctamente, mas como não havia sala nem
distância nenhuma no texto, só devolveu perguntas ("faltam as dimensões da
sala..."), sem sugerir tamanho nenhum. Pedido directo a seguir: "esperava
uma sugestão prática, não só perguntas". A regra do projeto proíbe inventar
dados técnicos sem fonte real — por isso a IA continua proibida de adivinhar
uma sala a partir de gente (`worker/src/index.js`, novo campo
`local.numeroParticipantes`, com instrução explícita de nunca o usar para
calcular medida nenhuma, só para o extrair do texto tal como está). Quem faz
essa conta agora é o próprio `index.html`
(`renderScreenRecommendation()`): sem distância/largura de plateia mas com
nº de participantes, estima-se uma plateia QUADRADA a partir de uma
densidade real e publicada — Tabela 1004.5 do IBC (International Building
Code), "assembleia concentrada, só cadeiras soltas": 7 pés²/pessoa (~0,65
m²/pessoa) — a única suposição sem norma nenhuma é a forma quadrada em si
(uma sala real raramente é um quadrado perfeito), por isso o resultado fica
sempre marcado com "⚠ Estimativa..." no veredito, nunca misturado com uma
medida a sério. Testado com Playwright: 300 pessoas sem sala dá uma
estimativa de ~14×14 m com o aviso completo; a mesma pessoa com sala REAL
indicada (20m fundo, 12m plateia) ignora a estimativa e usa os valores
reais, sem aviso nenhum.

**v3.21: tradução partida do Assistente, e densidade certa para gente de
pé.** Dois reportes seguidos do mesmo teste. Primeiro: a aba mudava para
inglês mostrava "Assistente de Project" — um híbrido quebrado. Causa:
`js/i18n.js` não tinha entrada nenhuma para a frase completa "Assistente
de Projeto"; o tradutor (`translateString()`, por substituição de
palavras/frases com fronteira de palavra) encontrava só a entrada curta
"Projeto"→"Project" e trocava essa palavra sozinha dentro da frase maior.
Corrigido com uma entrada de frase completa ("Assistente de
Projeto"→"Project Assistant"), que por ser mais comprida entra primeiro
na lista ordenada por tamanho — nota para o resto do painel do Assistente
(campos, botões, textos de ajuda): continuam SEM tradução nenhuma
para inglês, gap pré-existente que ainda não foi tratado a sério (só o
rótulo da aba, que era o que estava visivelmente partido).
Segundo: pediu-se "300 pessoas de pé" e a sugestão de tamanho saiu com a
densidade de gente SENTADA (a da v3.20). Corrigido com um segundo campo no
Worker, `local.publicoEmPe` (true só se o texto o disser explicitamente),
que troca a densidade IBC usada na estimativa: 0,65 m²/pessoa sentada
(Tabela 1004.5, "concentrated, chairs only") vs 0,46 m²/pessoa de pé
("standing space") — gente de pé ocupa menos chão. O mesmo campo viaja
também para o Preview (ver `PARA-CONTINUAR.md` de lá) para corrigir uma
sala desenhada errada lá do outro lado do mesmo teste.

**v3.22: escolher o Panasonic 12k saltava sozinho para o Christie 12k.**
Reportado direto: "na calculadora de projetores ao escolher o panasonic
12k está a saltar para o christie 12k". Causa em
`populateProjectorSelect()`: o `value` de cada `<option>` é os lúmens do
projetor (reaproveitado logo a seguir para preencher "p-lumens" sozinho),
não um identificador único — e dois projetores diferentes podem ter os
mesmos lúmens (Panasonic PT-RZ120B e Christie Roadster HD12K, ambos
12000). Ao repor a seleção depois de repopular a lista, `sel.value =
matchOpt.value` seleciona sempre a PRIMEIRA opção da lista com esse
valor — nunca necessariamente a que se queria manter, mesmo já tendo sido
encontrada correctamente por índice (`matchOpt`) um instante antes.
Corrigido selecionando o elemento em si (`matchOpt.selected = true`), que
não sofre desta ambiguidade. A mesma função serve as duas listas de
projetor (Distância de Projeção e Blending Multi-Projetor), por isso um
só fix cobre as duas abas. Testado com Playwright: escolher o Panasonic
mantém o Panasonic escolhido; escolher a seguir o Christie muda
correctamente para o Christie (não ficava preso no primeiro).

**Só no Worker (sem bump de versão, por convenção — ver
`.github/copilot-instructions.md`): feedback do AV Planner e registo de
pedidos para revisão semanal.** Dois pedidos seguidos.

1. **`POST /feedback`.** Pedido direto: "cria um report bug/sugestions no
   av planer que junte 5 mensagens e envie para o meu mail para os
   feedbacks da malta". Cada mensagem (`nome?`, `mensagem`) fica em KV
   (`FEEDBACK`) até haver 5 por enviar — aí junta-se tudo num só email
   (via Resend, de `onboarding@resend.dev`, sem domínio verificado) e
   limpa-se o lote; sem cron nenhum, é o próprio pedido (o 5º) que dispara
   o envio. O formulário do lado do AV Planner é nesse repositório
   (`index.html` + `sw.js` — push direto a `main`, como é hábito lá).
   Testado em produção: 6 pedidos reais, o email de lote chegou.
2. **`GET /registos`, protegido por `ADMIN_TOKEN`.** Pedido direto a
   seguir: "ela tem de ir aprendendo... podemos montar uma skill para
   isso... e marcávamos de semana a semana a revisão para ajustar o
   worker". Cada pedido ao Assistente (texto + o que a IA extraiu — nunca
   a imagem em si) fica em KV (`REGISTOS`) por 30 dias. A rota de leitura
   fica fora do bloqueio de CORS normal (é chamada de fora do browser, sem
   `Origin`) e fecha a 401 sem o token certo. Serve de base à revisão
   semanal combinada — ver skill própria (`.claude/skills/`) e a rotina
   agendada.

**v3.23: o ficheiro guardado não dizia de onde era, só pelo nome.**
Pergunta directa a seguir a tudo isto: "não tínhamos ficado com os dois a
abrir o mesmo ficheiro?" — não, ficou por decidir (unificar o formato
continua por fazer, é trabalho a sério, os dois guardam coisas
fundamentalmente diferentes). Mas o Preview já grava como
`<nome>.preview.json` desde sempre; os Cálculos gravavam só `<nome>.json`,
sem nada a distinguir. Sugestão directa: "podiam ao menos ter o caminho
calc.json para calculador e pvw.json para o 3d". Corrigido para
`<nome>.calculadores.json` (nome por extenso, a condizer com o
`.preview.json` já existente, em vez de abreviado) — cada app já recusa
abrir o ficheiro errado pelo conteúdo (`_app`/`tipo` dentro do JSON, não
pelo nome), isto é só para se ver logo na pasta de downloads qual é qual.
Testado com Playwright: "Guardar projeto" com o nome "Evento Teste XPTO"
descarrega `evento-teste-xpto.calculadores.json`.

**v3.24: Blending Multi-Projetor manda todos os projetores para o
Preview.** Pedido combinado numa sessão só: *"o 3D não está a trazer os
projetores do projeto"* — confirmado no código, a aba Blending nunca
mandava nada, nem sequer tinha o botão "Ver no Preview 3D" que a aba
simples (Distância de Projeção) já tinha. Fase 6 de um plano maior (as
fases 1-5, do lado do Preview, já tinham ido: base do formato, projetor
arrastável, vários palcos/régies/passarelas). Novo campo `#b-knowndist`
(mesma distância para todos os projetores do blend — sem ela não há
como calcular o rácio de cada um). A matemática de posição da grelha
(já usada por `renderBlendDiagram()`) saiu para `blendGridPositions()`,
reaproveitada tanto pelo diagrama SVG como pelo botão novo, para os dois
nunca poderem discordar. Novo botão "Ver no Preview 3D" escreve um
envelope novo em `mikeapps-projetor-v1`: `{v:2, projetores:[...]}` — a
aba simples continua a escrever `{v:1, ...}`, sem tocar nesse caminho
(o Preview aceita as duas formas). Ecrãs curvos ficam de fora do v1: a
distância de tiro varia ao longo do arco, uma só distância partilhada
seria inventar um número — o botão fica desligado nesse caso.

Cada projetor da grelha leva `lateral`/`alturaOffset` **relativos ao
primeiro projetor da grelha**, nunca uma posição absoluta na sala — isso
os Calculadores não sabem (confirmado no código do Preview: a posição
da instância principal nunca vem de lá, "a altura da lente é daqui").
Do lado do Preview, essas ofertas somam-se ao que já lá estava para dar
a posição de cada projetor extra.

Testado com Playwright, dos dois lados: no Calculadores, um blend 2×1
por omissão gera dois projetores com o mesmo rácio/distância e
`lateral` simétrico (±2.63 m); no Preview, "Trazer projetor dos
Calculadores" aplica o primeiro à instância #0 (como sempre) e cria um
projetor extra arrastável/editável/removível na cena, com a lotação e a
lista a condizerem; um payload antigo (`v:1`, um só projetor) continua a
aplicar-se à instância #0 e agora limpa os extras que lá estivessem —
sem erros de consola em nenhum passo.

**v3.25: TVs chegam ao Preview (fase 7/7, a última do plano).** Pedido
direto: *"o 3D tem de ir buscar tudo do projeto e não apenas o ecrã
complexo"* — confirmado com o mike que o âmbito é TVs (Sinal & Data
Rate e Media Server são cálculos, sem posição física na sala, ficam de
fora por não haver o que desenhar). A aba TVs é um catálogo simples
(modelo + diagonal + quantidade, sem posição nem layout — "só entra no
resumo, não afeta o cálculo") e, perguntado como as unidades deviam
aparecer no Preview sem essa posição, o mike escolheu **grelha
automática por quantidade**: a quantidade gera esse nº de zonas lado a
lado, como uma prateleira.

A app já sabia desenhar uma zona tipo "TV (delay)" — a aba Ecrã
Complexo já deixa escolher esse tipo à mão no "+ Ecrã" — só faltava a
aba TVs também criar essas zonas, em vez de só entrar na ficha técnica
em texto. Nova `lzSincronizarTVs(spec)` em `js/zonas.js`: recebe
quantidade/largura/altura/nome-base da aba TVs e cria essa quantidade
de zonas tipo "tv" na aba Ecrã Complexo, lado a lado — chamada de novo
sempre que a aba TVs recalcula (diagonal/formato/quantidade mudam, ou
"Adicionar ao projeto" liga/desliga), começando sempre por retirar as
zonas da sincronização ANTERIOR (marcadas no dataset do card,
`origem-tv`) antes de criar as novas, para mudar a quantidade não as
empilhar. Zonas criadas à mão por quem estiver a usar a aba Ecrã
Complexo (LED ou TV) nunca são tocadas — só as desta sincronização.

Ao contrário de Projeção/LED/Blending, isto não entra no grupo de
exclusividade dessas calculadoras (`setExclusiveAddProject`): TVs
(ecrãs delay) coexistem normalmente com um ecrã LED/projeção principal,
em vez de o substituírem.

Como as zonas do Ecrã Complexo já eram o caminho que chega ao
`mikeapps-projeto-v1` (e daí ao Preview 3D), e o Preview já sabia
desenhar `tipo:"tv"` (confirmado no código de lá, `cena.js` — nenhuma
mudança precisou de ser feita do lado do Preview), isto foi só ligar um
fio que já existia dos dois lados.

Testado com Playwright: ligar "Adicionar ao projeto" com 3 unidades
criou 3 zonas tipo "tv" lado a lado; mudar para 2 substituiu-as (não
empilhou); uma zona LED criada à mão na mesma sessão nunca foi tocada;
desligar "Adicionar ao projeto" removeu as zonas TV e deixou a LED
intacta; o payload para o Preview trouxe as duas zonas correctamente.
Confirmado também do lado do Preview: uma zona `tipo:"tv"` vinda deste
payload desenha-se na cena sem nenhuma mudança de código lá.

**v3.26: Watchout com placa AMD (6 saídas), e "empilhável" no Media
Server.** Pedido direto: *"nos media servers, no Datatom, existe a
opção de gráfica AMD com 6 saídas"*. A placa indicada inicialmente
(Radeon Pro W6600) afinal só tem 4 saídas DisplayPort — confirmado na
ficha oficial da AMD; a que tem mesmo 6 é a **Radeon Pro W6800** (6×
Mini-DisplayPort 1.4), aviso dado antes de escrever o número errado
na base. Nova entrada em `data/processors.json` → `mediaServers`:
"Dataton — Watchout 7 (PC próprio, placa AMD Radeon Pro W6800)", 6
saídas × 4K = 49,77 MP, `estimated:true` (o teto real é da GPU/
máquina, como as outras entradas Watchout/Resolume/Mitti/Millumin já
marcadas assim) — fonte: ficha técnica oficial da AMD (o cálculo de MP
é nosso, a partir da contagem de saídas; a AMD não publica um total).

A seguir, pedido relacionado: *"deve dar a opção de stack quando a
resolução não cabe só num mas o sistema permite"* — o Watchout já diz
na própria nota que escala juntando mais nós WATCHPAX, mas a
calculadora só olhava para 1 unidade de cada vez. Novo campo
`escalavel: true` nas duas entradas Dataton/Watchout (WATCHPAX 64 e a
nova com a W6800) — confirmado com o mike que isto não é exclusivo do
inventário da AVK (*"pode sugerir sempre, não será apenas para AVK"*):
quando uma unidade só não chega mas o fabricante confirma que o
software escala por nós, a lista mostra agora um selo "Empilhável ·
Nx unidades" com a conta de quantas fariam falta — sem afirmar que
essas unidades existem disponíveis (nem na AVK, nem no mercado), só
o cálculo. Nova `stackBadgeHtml(x, totalMP)` em `index.html`.

Testado com Playwright: a entrada W6800 aparece na lista com "6
saídas" e o link para a fonte; pedindo 90MP (acima de 1 unidade de
qualquer Watchout), as duas entradas Dataton mostram "Empilhável" com
o nº de unidades certo (4x para a WATCHPAX 64, 3x para a W6800),
enquanto as outras entradas (disguise, Resolume, Mitti, Millumin —
sem `escalavel`) continuam só com "Não aconselhado", sem o selo novo.

**v3.27: frame rate universal entre abas, e DSM da aba Projeto passa a
criar DSM a sério.** Dois pedidos seguidos na mesma sessão.

*"O frame rate não fica universal, tenho sempre de voltar a
escrever."* Havia 3 campos de frame rate independentes (Sinal & Data
Rate, Media Server, "Refresh rate" da aba Projeto), cada um com o seu
próprio 60Hz por omissão, sem ligação nenhuma entre eles. Confirmado
com o mike: quer os três ligados nos dois sentidos — mudar QUALQUER um
actualiza logo os outros dois (e dispara o recálculo deles, como se a
pessoa tivesse escrito lá o mesmo número), *"para não andar sempre a
escrever e talvez fazer erros"*. Nova `syncFpsFrom(sourceId)` em
`index.html`, com guarda contra recursão infinita (`syncingFps`).
Reabrir um projeto gravado também passou a propagar o refresh rate
restaurado para os outros dois campos (antes só o `proj-refresh` era
guardado/restaurado — os outros dois voltavam sempre ao 60Hz por
omissão nessa altura, mesma causa do problema reportado).

*"Estou a meter DSM no projeto e não aparecem no 3D, apenas se for ao
ecrã complexo."* O campo "Ecrãs DSM" da aba Projeto só alimentava a
ficha técnica em texto — nunca criava DSM a sério na aba Ecrã Complexo
(que é o único caminho que chega ao Preview). Havia já um botão manual
só no sentido contrário ("↙ Trazer da Ecrã Complexo"), criado
deliberadamente separado para permitir uma estimativa rápida antes de
configurar os DSM a sério — mas confirmado com o mike que, tal como
nas TVs (v3.25), prefere ligação automática. Escrever/mudar a
quantidade em "Ecrãs DSM" (ou escolher um modelo de TV real, com
diagonal confirmada) passa a criar/actualizar esse nº de DSM a sério na
Ecrã Complexo, reaproveitando `lzAplicarDsm()` — a mesma função já
usada quando um DSM chega do Preview, agora exposta em `window` para a
aba Projeto poder chamá-la. Só a QUANTIDADE tem correspondência directa
(o campo na aba Projeto é resolução em píxeis, não tamanho físico) — o
tamanho físico (largura/altura em metros) só se actualiza quando um
modelo real da AVK com diagonal confirmada está escolhido; sem modelo,
o tamanho que já estiver na Ecrã Complexo fica intocado, nunca se
inventa um valor a partir de píxeis.

Testado com Playwright: escrever 50 em Sinal & Data Rate propagou para
Media Server e Projeto; escrever 25 em Media Server propagou de volta
para os outros dois; escrever 3 em "Ecrãs DSM" (Projeto) criou 3 DSM a
sério na Ecrã Complexo, que chegaram ao payload do Preview
(`{n:3,w:0.6,h:0.4}`, tamanho físico intocado por não haver modelo
escolhido) — sem erros de consola em nenhum passo.

**v3.28: standard da Distância de Visualização passa a valer para a
Cobertura do Preview, e corrigido um bug — a aba TVs não estava a
segui-lo.** Dois pedidos seguidos.

*"E nas TVs não está a usar."* Ao investigar *"dá para escolher o
Standard... de forma a ser o usado em todos os cálculos"*, o mike
testou e reportou (com capturas de ecrã) que mudar o standard em
"Distância de Visualização" não mudava a regra mostrada na aba TVs.
Causa: o listener de `#v-standard` (`index.html`) já chamava
`calcVisualizacao()` e `calcLed()` ao mudar, mas nunca `calcTV()` —
a aba TVs só recalculava quando se mexia num campo dela própria.
`calcVisualizacao()`/`calcLed()` já liam bem o standard partilhado
(`viewingDistanceRange()`/`viewRuleDescription()`, ambas globais no
mesmo scope); só faltava a terceira chamada. Testado com Playwright:
mudar o standard para AVIXA em "Distância de Visualização" e voltar à
aba TVs agora mostra logo "Regra: Conteúdo com texto/dados para ler —
… (altura × 6)" em vez de ficar preso ao standard anterior.

*Standard escolhido → Cobertura do Preview.* Confirmado por
`AskUserQuestion` que o pedido era especificamente para a Cobertura
do Preview 3D deixar de usar uma regra fixa (AVIXA "basic", 6-8
alturas de imagem) e passar a usar o standard escolhido aqui.
`lzPayloadPreview()` (`js/zonas.js`) resolve o standard escolhido
(`VIEW_STANDARDS[vStandardKey]` + `AVIXA_CONTENT` quando a base é
altura) num objecto simples `{basis, min, max, label}` — já resolvido
em número, para o Preview não ter de conhecer os catálogos internos
daqui, só a fórmula final. `calcVisualizacao()` passou a chamar
`lzGuardarParaPreview()` no fim, para mudar o standard empurrar logo a
actualização para o Preview, sem esperar por uma mudança de zona não
relacionada. Ver a entrada correspondente no `PARA-CONTINUAR.md` do
Preview para o lado de lá (`regraDeDistancia()`, `js/app.js`).

Testado com Playwright: um projeto de teste com `standard:
{basis:"width", max:6}` (um ecrã de 4×2,25 m) deu 217 lugares
confortáveis contra 101 com o standard por omissão (altura-base,
6 alturas de imagem) — a mesma sala, só a regra a mudar, confirma que
a base largura/altura está mesmo a ser aplicada e não só o texto.

**v3.29: a lente deixa de ficar escondida quando já há ecrã + projetor +
distância, nas abas Distância de Projeção e Projeto.** Pedido direto: "na
parte de projeção não está a apresentar a lente quando já tem toda a info,
tamanho de ecrã, projetor e distância".

Em ambas as abas, o item "Distância de projeção (com a lente indicada)"
só aparecia depois de escolher manualmente uma lente da base (secção "Já
sabes a lente?") — mesmo já sabendo tudo o resto, a app ficava à espera
dessa escolha extra, enquanto a lista "Lentes compatíveis" logo abaixo já
calculava sozinha qual seria a melhor. Sem lente escolhida à mão, mas
havendo pelo menos uma lente compatível com a marca do projetor a essa
distância, o item passa a mostrar essa mesma "melhor" sugestão — título
muda para "(com a lente sugerida — Marca Modelo)" para não se confundir
com uma escolha confirmada; ao escolher a lente à mão, volta a "(com a
lente indicada)" e mostra os números exatos dessa lente.

Apanhado no caminho: a primeira versão deste código tinha um erro por
apanhar — quando NENHUMA lente da marca cobre o throw ratio necessário
(caso real, não hipotético: aconteceu logo no primeiro teste com um
projetor Epson a uma certa distância), o acesso a uma lente sugerida
inexistente rebentava a função a meio, deixando o ecrã com texto
desatualizado de um cálculo anterior. Corrigido antes de publicar — sem
lente nenhuma (escolhida ou sugerida), o item volta a ficar escondido tal
como antes, sem rebentar nada.

Testado com Playwright nas duas abas: sugestão automática aparece com
ecrã+projetor+distância preenchidos; escolher uma lente à mão substitui
pela informação exata dela; um projetor sem nenhuma lente compatível na
base a essa distância não rebenta e esconde o item correctamente; voltar
a uma distância com match restaura a sugestão sem texto preso de uma
distância anterior.

**v3.30: a lente sugerida passa a aparecer também junto ao próprio campo
"Lente", com botão para a escolher.** Pedido direto a seguir a testar a
v3.29: *"ok sai no relatório... podia apresentar aqui"* (com captura de
ecrã a apontar para a secção "Já sabes a lente? (opcional)"). A sugestão
já saía no resultado e no relatório, mas quem está a preencher os campos
não a via sem ir procurar mais abaixo — e o menu "Lente" ali continuava a
dizer só "Nenhuma / não sei ainda", como se nada estivesse a acontecer.

Nas duas abas (Distância de Projeção e Projeto), quando há sugestão e
nenhuma lente escolhida à mão, aparece por baixo do menu: *"Sugestão
automática (ainda não escolhida): **Marca Modelo**"* + botão **"Usar esta
lente"**, que a escolhe no menu (mesmo caminho do clique na lista de
lentes compatíveis, `mudarCampo()`) — a partir daí passa a ser escolha
confirmada e a nota desaparece sozinha.

Apanhado no teste: a primeira versão reconstruía o botão por `innerHTML`
a cada recálculo, e como o recálculo dispara logo no *blur* do campo
anterior, o botão era destruído entre o `mousedown` e o `mouseup` — o
clique perdia-se sem erro nenhum (com `.click()` sintético funcionava, com
rato a sério não, o que torna isto o tipo de bug que passa despercebido a
um teste mal feito). O botão passou a ser fixo no HTML, e o cálculo só lhe
muda o texto e o `data-usar-lente`.

Testado com Playwright nas duas abas, com clique real: a nota aparece com
o nome da lente sugerida, o botão escolhe-a mesmo (menu passa a "Epson
ELPLW06"), e a nota esconde-se depois de escolhida.

**Só no Worker (sem bump de versão, por convenção — ver
`.github/copilot-instructions.md`): o Assistente passa a ter memória dos
pedidos anteriores.** Pedido direto: "deve ir guardando os projetos
criados como referência para sugerir e fazer menos perguntas". Reverte a
regra antiga "nunca aprendizagem automática" — confirmado de propósito
antes de avançar, por ser uma decisão já documentada — ver a nota
atualizada em `.github/copilot-instructions.md`.

Reaproveita os mesmos `REGISTOS` que já existiam só para revisão manual
(30 dias): antes de perguntar à Anthropic, `buscarExemplosParecidos()`
lê os últimos 30 registos e pontua-os por sobreposição de palavras
significativas com o texto do pedido atual (sem embeddings nem serviço à
parte — só contagem de palavras em comum, ≥2 para entrar) — até 3 dos
melhores entram no pedido como exemplos de referência ("aqui estão
pedidos anteriores parecidos, e o que foi extraído deles"), com uma
instrução explícita a proibir copiar valores técnicos de um exemplo para
o projeto atual — um exemplo só ensina o PADRÃO (que campos costumam
ficar null, que tipo de ambiguidade não precisa de `pontosPorConfirmar`),
nunca um número. Continua sem estado persistente nem ajuste de modelo —
é few-shot por pedido, determinístico e inspecionável.

Testado com um harness isolado (a função de pontuação copiada para fora
do Worker, já que corre em Cloudflare e não há deploy nesta sessão): um
pedido novo para "Hotel Marriott, 300 pessoas" contra três registos de
exemplo pontuou 5 para um pedido anterior no mesmo hotel, 2 para uma sala
pequena não relacionada (abaixo do limite de utilidade mas ainda dentro
do corte de 2), e 0 (excluído) para um festival ao ar livre sem nada em
comum — confirma que a pontuação distingue exemplos relevantes de
ruído antes de gastar tokens a enviá-los à Anthropic.

**v3.31: uma projeção marcada "Adicionar ao projeto" passa a seguir
sozinha para o Preview.** Reportado com duas capturas de ecrã: com
"Adicionar ao projeto" marcado na aba Distância de Projeção e
"Auto: ligada", o Preview respondia *"Ainda não há nada guardado"* ao
carregar em "Trazer projeto dos Calculadores".

Causa: há DUAS pontes, e uma projeção só viaja por uma delas. As zonas
(Ecrã Complexo, TVs) vão em `mikeapps-projeto-v1`, escrita sozinha a cada
recálculo. A projeção vai em `mikeapps-projetor-v1` — que só era escrita
ao carregar em "Ver no Preview 3D". Marcar "Adicionar ao projeto" ali não
escrevia ponte nenhuma (só preenchia os campos da aba Projeto, para o
relatório em texto), e como uma projeção nunca cria zonas, o Preview via
mesmo o armazenamento vazio. O aviso dele até prometia "ou qualquer outra
com Adicionar ao projeto" — uma promessa que o código não cumpria.

Agora, com "Adicionar ao projeto" marcado E sincronização automática
ligada, a projeção é escrita na ponte a cada recálculo (nova
`guardarProjetorParaPreview()`, e também no próprio momento de marcar a
caixa — senão só ia no toque seguinte num campo). Sem a caixa marcada não
passa nada: mexer nos campos desta aba é o que se faz a experimentar, e
não deve mexer no 3D de quem ainda não decidiu. A construção da carga saiu
do botão para uma `cargaDoProjetor()` partilhada pelos dois caminhos.

Do lado do Preview (v2.89), o botão "Trazer projeto dos Calculadores"
deixa de mentir: sem zonas, tenta a ponte do projetor antes de desistir, e
diz *"Não havia zonas guardadas, mas veio a projeção dos Calculadores"*.

Testado com Playwright, com as duas apps servidas da MESMA origem (é o que
faz o `localStorage` ser partilhado — em produção estão as duas em
`mikefkfmiguel-create.github.io`; em portas diferentes o teste nunca
funcionaria): marcar a caixa escreve a carga (`distancia: 17`), e o botão
do Preview aplica-a (`projDist` fica a 17.00) com a mensagem nova.

**v3.32 (fase 1 de um plano novo): marcado = está no projeto = está no
3D.** Pedido direto: *"o 3d ser sempre o construtor da calculadora, para
depois arrumar no sítio dentro dele... na calculadora marco tudo o que
preciso através do adicionar ao projeto, o 3d vê tudo isso"*, e *"guiar o
utilizador através das abas para construir o projeto e esse é que vai para
o 3d quando o sync for ligado"*.

A regra já existia meia-feita, peça a peça (TVs numa fase, DSM noutra,
projeção na véspera). O levantamento encontrou duas lacunas:

1. **Ecrã LED (ecrã único) nunca chegava ao 3D.** `syncLedToProject()` só
   preenchia os campos da aba Projeto (relatório em texto), e o único
   caminho para o 3D é a ponte das zonas — que só o Ecrã Complexo escreve.
   Nova `lzSincronizarLed()` (`js/zonas.js`) cria lá a zona a sério: modelo
   de tile, grelha e curvatura, não um retângulo em metros, para a zona
   trazer consigo pitch, peso e amps.
2. **O Blending só atravessava pelo botão "Ver no Preview 3D".** A carga
   saiu do handler para `cargaDoBlend()`, e `guardarBlendParaPreview()`
   escreve-a a cada recálculo quando "Adicionar ao projeto" está marcado e
   o sync ligado — mesma receita da projeção simples na v3.31.

**Decisão mudada a meio, e porquê.** O plano previa uma terceira parte:
pôr o Ecrã Complexo a respeitar também o seu "Adicionar ao projeto", para
a regra não ter exceções. Não se fez, e não se deve fazer: `l-addproject` e
`z-addproject` estão no mesmo grupo de exclusividade (marcar um desmarca o
outro), por isso marcar "Ecrã LED" ia criar a zona **e ao mesmo tempo
desligar a ponte das zonas** — o 3D ficava vazio precisamente na ação que
devia enchê-lo. A regra certa, e a que fica, é outra: **o Ecrã Complexo é a
montagem física do projeto** — cada aba larga lá a sua peça quando marcada,
e é essa montagem que atravessa quando o sync está ligado. A projeção e o
blend são a exceção coerente: não são zonas, são um projetor mais a imagem
que ele lança, e viajam pela ponte do projetor.

Detalhe que só se vê a usar: ao contrário das TVs (onde a quantidade muda e
obriga a recriar a fila), a zona do Ecrã LED **actualiza-se no sítio**.
Recriar o cartão a cada tecla escrita na aba punha a zona de volta na
posição de fábrica — ou seja, deitava fora exatamente a arrumação que este
plano todo existe para preservar.

Testado com Playwright, com as duas apps na mesma origem: marcar "Adicionar
ao projeto" no Ecrã LED cria a zona (16×9 tiles = 8×4,5 m) e ela chega à
ponte; desmarcar tira-a. No Blending, marcar escreve a carga `v:2` com os 2
projetores. E o que interessa: dar posição (3,5) e nome ("Palco principal")
à zona e depois mudar a grelha na aba LED de 16 para 20 tiles — a grelha
muda, a posição e o nome ficam.

**v3.33 (fase 2): as zonas passam a ter identidade própria.** É a fase que
faz o resto do plano valer alguma coisa — sem ela, "eu arrumo no 3D e depois
volto a sincronizar" era uma aposta.

Os ajustes de posição/rotação do Preview guardavam-se pelo NOME da zona.
Renomear uma zona aqui, ou trocar o modelo da TV (que muda o nome-base de
toda a fila), deitava fora a arrumação toda do outro lado. Havia um `__id`
no Preview, mas é `enumerable: false` e só serve para o foco dos campos —
não sobrevive a gravar, reabrir nem sincronizar.

As zonas já viajavam com um `id`, mas era o `dataset.zoneId`: uma sequência
(z1, z2...) refeita a cada arranque. Passou a ser um id aleatório e
persistente (`lzNovoZid()`), gravado no `localStorage` das zonas, no ficheiro
do projeto e no payload para o Preview. O Preview também gera id para as
zonas que nascem lá ("+ Ecrã", "+ Delay"), e devolve-o intacto — quem cria a
peça dá-lhe o id, mais ninguém lhe toca.

**Como se usou o id, e porque não se mudou tudo de chave.** A tentação era
passar `ajustes.delays` a ser indexado por id. Mas o nome não é só a chave
dos ajustes: é também o nome do objecto na cena (`delay-<nome>`), a chave do
arrasto e o que o `fazerZonas` procura — mudá-los todos era um refactor
grande com muito por onde partir. Em vez disso, o id **persegue o nome**:
`reconciliarAjustesPorId()` (`preview/js/app.js`) guarda o último nome
conhecido de cada id (`ajustes.nomePorId`) e, quando a zona reaparece com
outro nome, muda o ajuste (e a marca "sem leitura") de nome com ela. Mesmo
efeito, uma função só, e sem tocar em nada do que já funciona. Só move para
um nome livre: se já houver ajuste com o nome novo, é de outra zona e não se
lhe mexe.

Projetos antigos, ou colados à mão, não têm id nenhum — aí não corre nada e
fica tudo exatamente como sempre esteve.

Testado com Playwright, as duas apps na mesma origem: criar uma zona tipo
"tv" chamada "Delay esquerda", arrumá-la no 3D (dx 2,5), renomeá-la nos
Calculadores para "Delay lateral A" e voltar a sincronizar — o ajuste segue
o nome novo (`delays: { "Delay lateral A": { dx: 2.5 ... } }`), quando antes
se perdia. E um projeto colado à mão, sem ids, carrega as 3 zonas na mesma,
sem um erro de consola.

Entre este documento ter sido escrito (16:44 do dia 6) e agora, houve trabalho
substancial feito localmente (autor de commit "MIKE") que não estava refletido
aqui: extração de grupos de ecrãs no Worker, várias rondas de sincronismo ao
vivo com o Preview (`v2.6`–`v2.9`+), tipo de ecrã por zona (LED/TV/Projeção) +
DSM do projeto, correções ao Ecrã Complexo, e por fim "Trazer o projeto
inteiro do Preview" com o interruptor de sincronização automática (🔗 Auto).
A tabela completa das chaves de `localStorage` da ponte, que este documento já
prometia, está agora escrita em `.github/copilot-instructions.md`, secção
"As pontes com o Preview" (não estava, até esta sessão notar a promessa por
cumprir).

**Lição repetida:** este documento também ficou desatualizado a meio — foi
escrito a abrir uma sessão, não fechado no fim dela. Da próxima vez, atualizar
isto ao terminar, não só ao começar.

## O que falta, do lado de cá

1. **O shift das lentes que faltam.** Estão as 9 lentes Epson (publica-o por
   lente). Sony e Barco bloqueiam leitura automática das páginas — à mão, a
   partir das fichas técnicas. Panasonic, Christie e NEC publicam o shift **no
   corpo do projetor**, não na lente: esse número pertence a
   `data/projectors.json`, não a `data/lenses.json`. Ainda por fazer (verificado
   a 7/9: só as 9 Epson têm `shift`, mais nenhuma marca).
2. ~~TVs para o Preview~~ — feito na v3.25 (ver abaixo), mas por um caminho
   diferente do que este item previa: em vez de um botão "Ver no Preview
   3D" próprio, "Adicionar ao projeto" na aba TVs cria zonas tipo TV a
   sério na aba Ecrã Complexo, que já é o caminho que chega ao Preview.
3. Ver também os "Gaps conhecidos" no fim do `.github/copilot-instructions.md`
   — `pontosPorConfirmar` da IA por vezes contradiz a sugestão de
   dimensionamento já calculada no cliente; candidatos a `showAlarm()` ainda
   por avaliar (throw ratio fora de alcance, overlap impossível em Blending,
   data rate acima do link).

## Coisas que se decidiram e não se voltam a discutir

- **A IA só extrai factos; nunca recomenda tecnologia.** O cálculo é sempre em
  JS no cliente, contra dados reais.
- **Os 3 tamanhos AVIXA, não uma tecnologia.** Foi decisão explícita do mike:
  "ela deve devolver as três melhores opções de tamanhos e não de tecnologia".
- **Nunca aprendizagem automática** no Assistente nem no `showAlarm()`. Casos
  mal resolvidos corrigem-se à mão no Worker, um de cada vez, depois de
  reportados.
- **Nunca inventar dados técnicos.** Toda a entrada em `data/*.json` tem
  `fonte`; sem fonte, não entra.
