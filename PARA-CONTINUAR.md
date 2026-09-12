# Para continuar

Onde isto está, e o que falta. Escrito a 6 de setembro de 2026, atualizado a
7 de setembro (sessão Claude Code, depois de sincronizar com o trabalho feito
localmente entre 6 e 7 — ver "O que aconteceu depois" abaixo).

Quem pegar nisto — pessoa ou agente — deve ler primeiro o `CLAUDE.md` (as
convenções da casa) e o `.github/copilot-instructions.md` (arquitectura,
Assistente de Projeto, o motor de sugestão de dimensionamento, o popup de
alarme, e a lista de decisões já tomadas que não se voltam a discutir).

## PENDENTE — retomar aqui (noite de 11 de setembro)

Lista fechada no fim da sessão de 11/9, a pedido do mike: *"guarda para de
manhã tudo o que fica pendurado para revermos"*. Por ordem do que estava
combinado.

### 1. ~~O token do Cloudflare~~ — FEITO a 12 de setembro

**O Worker publica-se sozinho, e a publicação por CI está confirmada.** A
primeira correu a 12/9 às 07:39 UTC: `Uploaded calculadores-assistente`,
version id `e802f3b5-64df-4469-aabb-9c600c19f9cb`. A seguir, um pedido real ao
`/extrair` devolveu `200` em 5,1 s, com `larguraM: 6`, `alturaM: 3`,
`numeroParticipantes: 300` e `tipoEcra: "led"`. **A memória do Assistente está
finalmente activa em produção.**

Duas coisas que se aprenderam a fazê-lo, e que valem para a próxima:

- **O secret foi criado com o nome errado à primeira** —
  `CLAUDEFLARE_API_TOKEN`, com "CLAUDE" em vez de "CLOUD". O workflow falhou
  com `CLOUDFLARE_API_TOKEN:` vazio e a dizer que faltava o secret, o que é
  exactamente o que devia dizer. O GitHub não deixa **renomear** um secret:
  cria-se outro com o nome certo e apaga-se o errado.
- **Um token de API não se cola em conversas nem em ficheiros.** Aconteceu uma
  vez a meio, foi apanhado na hora e o token foi revogado e substituído. O
  valor vai do Cloudflare directamente para a caixa do secret do GitHub, e
  mais lado nenhum.

O que estava aqui escrito antes, e que já não é preciso fazer:

### ~~O que era preciso~~ (histórico)

`.github/workflows/deploy-worker.yml` já publica o Worker sozinho. Os ids das
KV e o `account_id` já estão no `wrangler.toml`. **Falta um único secret:**

> GitHub → `calculadores` → Settings → Secrets and variables → Actions →
> New repository secret → `CLOUDFLARE_API_TOKEN`
>
> (Cloudflare → My Profile → API Tokens → Create Token → modelo
> **"Edit Cloudflare Workers"**. Não a Global API Key.)

A corrida nº 2 do workflow falhou só por causa disto, e a mensagem de erro
diz-o por palavras. Passos completos em `worker/DEPLOY.md`.

**Consequência de estar por fazer:** a memória do Assistente (pedidos
anteriores como referência, merged na v3.29) continua **inactiva** em
produção.

### 2. Limpeza de branches — falta a autorização, não o trabalho

Contado na noite de 11/9, com `git cherry` (que é o que apanha as que foram
squash-merged e o `--merged` não vê):

| | locais já incorporadas em `main` | com patch-id diferente | remotas no `origin` |
|---|---|---|---|
| `calculadores` | 25 | 1 | 29 |
| `preview` | 69 | 1 | 2 |

As duas "com patch-id diferente" (`assistente-registo-e-revisao` e
`devolver-no-topo`) foram verificadas à mão: **o trabalho delas está em
`main`**, com outro sha — é só o efeito do squash. A do preview está tão
atrasada que lhe faltam 2191 linhas do que `main` já tem.

Combinado:
- **`calculadores`**: apagar as locais e também as remotas já merged. Está
  tudo no GitHub, não se perde nada.
- **`preview`**: só 2 das branches existem no `origin` — as outras **só
  existem nessa pasta**. Continuam a ser seguras, mas antes de apagar
  confirmo branch a branch e digo o resultado. É a diferença entre apagar uma
  cópia e apagar o original.

Rede extra, se se quiser: marcar os tips com tags antes de apagar.

### 3. ~~As TVs no Ecrã Complexo~~ — FEITO a 12 de setembro (v3.41)

Era: com 4 TVs e mais nada, o painel mostrava `0 tiles`, **canvas `—`**,
`0,0 kg`, `0,00 A`. O peso e os amps foram resolvidos na v3.40 ("não
conhecido" em vez de zero). A resolução ficou para aqui, e está feita.

**O que se decidiu, e porquê.** Uma TV de delay e uma projeção são **saídas
próprias**, cada uma com a sua resolução nativa — não são uma região do
canvas do LED. Por isso:

- Cada zona de delay passa a ter resolução própria. Uma TV sincronizada da
  aba TVs traz a do `data/tvs.json`; à mão, escreve-se num campo novo no
  popup da zona. **Em branco quer dizer "não conhecida"** e é isso que sai
  escrito — nunca `0×0`.
- O **canvas do LED não mexe**. `lzComputePixelMap()` passou a filtrar
  `tipo === "led"` à letra. Isto é o ponto que era preciso acertar: sem ele,
  dar píxeis às TVs inflava calado o canvas que alimenta o Sinal & Data
  Rate, o Media Server e **o número de processadores de LED** — mandava
  alugar um processador maior para alimentar monitores que nunca lhe passam
  pela frente. Está provado por teste (esconder as TVs não muda o canvas).
- Linha nova nos totais, **"Saídas de delay (TV/projeção)"**, agrupada por
  resolução: `3 × 1920×1080 px`. É como se pedem ao media server.
- O `lz-sum`, o relatório do Projeto e a lista do desenho deixaram de
  escrever `0×0 tiles` — passa tudo por `lzTextoTiles`/`lzTextoRes`, um
  sítio só.

**Dois bugs apanhados a testar isto, ambos já cá estavam:**

1. **O nome da TV vinha cortado.** `lzAddZone` metia o nome num atributo
   HTML sem escapar, e quase todos os modelos de TV têm aspas no nome (a
   diagonal: `Monitor 13" JOHNWILL`). A aspa fechava o atributo e a zona
   ficava a chamar-se `Monitor 13`.
2. **As TVs desapareciam do projeto ao reabrir a app.** O interruptor
   "Adicionar ao projeto" não se guardava, mas as zonas sim — ao arrancar, o
   `calcTV()` corria com ele desligado e apagava as zonas acabadas de
   restaurar. Marcava-se, fechava-se, e no dia seguinte não havia TVs
   nenhumas. O mesmo valia para o Ecrã LED. Duas peças a corrigir: uma
   guarda (`lzSyncArmado`, em `js/zonas.js`) que só deixa a sincronização
   mexer nas zonas depois de alguém tocar mesmo nessa aba, e a aba TVs
   passou a guardar-se (modelo, diagonal, formato, quantidade, interruptor).

**Fica por fazer, e é pequeno:** a aba **Ecrã LED** guarda só o interruptor,
não os campos. Com a guarda isso já não destrói nada — a zona restaurada
fica como estava —, mas no dia em que se tocar nessa aba a zona é refeita a
partir dos valores por omissão. Falta persistir a aba Ecrã LED inteira, como
se fez com as TVs.

**Peso e amps continuam sem solução pelos dados.** O `data/tvs.json` tem
`diag`, `ratio`, `resolucao`, `resolucaoNota`, `touchscreen` e `fonte`. Nem
peso nem consumo. Enquanto alguém não preencher o catálogo com valores de
ficha técnica, dizem "não conhecido" — que é a verdade.

### 4. Os nomes novos do Preview (v2.99)

"Tamanho do ecrã", "Ecrãs na sala", "Onde ficam os delays e o DSM", "fundo"
em vez de "↕"/"profundidade" para a posição… Se algum não soar bem depois de
o usar a sério, é uma linha a mudar cada um.

### 5. Dar escala às fotos — a ideia do mike, já analisada

*"Uma vez que uma imagem não tem referência a medidas quando a adiciono para
a IA analisar, se a app reconhecer que estou em mobile com câmara poderia
tirar partido das funções das câmaras de hoje, que têm equipamento de medição
para focus e afins, para fazer medidas para usar nas medidas da sala e ajudar
a sugerir os equipamentos."* E depois: *"daria a opção de tirar fotografias
com o telemóvel ou tablet"* e *"até o GPS pode dar informação de onde estamos
e procurar medi[das]"*.

O diagnóstico está certo, e é o mesmo que a própria app já admite no texto ao
lado do campo de imagem: **uma foto não tem escala**.

**Plataforma:** *"poderá ser nos dois, mas maioritariamente para Android."*

#### Os dois primeiros passos estão FEITOS — 12 de setembro (v3.42)

Na aba Assistente de Projeto:

- **Tirar a foto ali mesmo.** Botão "📷 Tirar foto agora"
  (`capture="environment"`), que **só aparece onde há mesmo câmara** —
  perguntado por `enumerateDevices()`, que responde sem pedir autorização
  nenhuma. Num portátil sem câmara o `capture` era ignorado e ficavam dois
  botões a fazer o mesmo. A foto tirada entra pelo mesmo campo da carregada
  à mão, para o "Analisar" não ter de saber de onde ela veio.
- **A régua.** Duas linhas arrastáveis por cima da foto: a azul aponta uma
  coisa de medida conhecida e escreve-se quanto mede, a laranja mede o que
  se quiser. A conta faz-se em píxeis **nativos** da imagem (não do canvas),
  por isso rodar o telemóvel não mexe em nada. Há **lupa** enquanto se
  arrasta, porque num telemóvel o dedo tapa exactamente o ponto que se está
  a apontar — e 5 px de erro a apontar o canto de uma porta são metade do
  erro da medida final.
- O resultado sai para a **largura da sala**, para o **pé-direito**, ou
  junta-se ao texto do pedido — sempre marcado como *"medida na foto (por
  referência, aproximada)"*, nunca como medida a sério.
- A app **diz onde isto falha**: só vale para coisas no mesmo plano da
  referência, com a câmara mais ou menos de frente. E avisa sozinha quando a
  referência é curta na imagem (menos de 15% do lado maior), onde o erro
  dispara.

Verificado com geometria conhecida: numa imagem 800×600, referência de
300 px declarada como 3,00 m e medida de 500 px → **4,99 m** (o certo é
5,00; o desvio é o arredondamento do próprio arrasto). Testado também a
arrastar com o dedo num ecrã de 390 px.

**Falta destes dois:** um modo de ampliar o canvas para ecrã inteiro. Num
telemóvel a régua fica com ~310 px de largura, que chega mas é apertado para
apontar cantos com precisão.

Continuam por fazer os outros dois caminhos da tabela abaixo: a **memória de
salas** (GPS) e o **AR**.

#### O que um site consegue mesmo pedir ao telemóvel (verificado, 11/9)

- **WebXR (medir por AR, com *hit-test*): Android sim, iPhone não.** No
  caniuse, o WebXR está a vermelho em **todas** as versões do Safari iOS,
  incluindo a mais recente — não é "desligado por omissão", não existe. No
  Chrome para Android está como suporte parcial. O `XRHitTestSource` e o
  `XRDepthInformation` estão ambos marcados pela MDN como *Limited
  availability* e experimentais.
- **O autofocus não serve.** Existe mesmo um `focusDistance` nas
  `MediaTrackConstraints`, mas dá a distância ao plano de focagem, não a
  largura de uma sala — e a implementação em browsers móveis nem está
  confirmada. O caminho é o WebXR, não o autofocus.
- **Não há nenhuma API web que exponha LiDAR/ToF fora do WebXR.**

#### Os quatro caminhos, por custo

| | Onde funciona | Esforço | Estado |
|---|---|---|---|
| **Fotografar na hora** (`capture="environment"` no input) | Android **e** iPhone | Cinco minutos | **feito (v3.42)** |
| **Escala por referência conhecida** na foto | Android **e** iPhone | Uma tarde | **feito (v3.42)** |
| **Memória de salas** (GPS a reconhecer onde já estiveste) | Android **e** iPhone | Uma tarde | por fazer |
| **Medir por AR** (WebXR + hit-test) | **Só Android** | Vários dias, e frágil onde mais faz falta | por fazer |

**Regra de desenho, decidida:** o caminho universal é a base; o AR é um extra
que só aparece onde funciona (`navigator.xr.isSessionSupported("immersive-ar")`).
No iPhone o botão não existe, em vez de existir e não abrir.

#### As três notas que importam

1. **O AR é fraco exactamente onde mais faz falta.** Medir por AR é bom a
   poucos metros e degrada-se com a distância, com pouca luz e em espaços
   vazios sem textura — a descrição de um pavilhão antes de montar. Para
   largura de palco, pé-direito e distância à primeira fila, serve bem. Para
   os 24 m de um pavilhão medidos a andar, o erro acumula.
2. **A escala por referência tem um limite honesto.** Tocar em dois pontos de
   algo de medida conhecida (uma A4, um troço de truss de 2 m, a altura de
   uma porta) e escrever essa medida dá a escala **daquele plano**. Uma foto
   tirada de esguelha distorce; corrigir a perspectiva a sério pedia quatro
   pontos conhecidos, e aí já é outro nível de trabalho.
3. **O GPS não encontra medidas — reconhece sítios.** Não existe base de
   dados de dimensões de salas por coordenadas. O que existe são fichas
   técnicas publicadas pelos recintos, que é o tipo de documento que o
   Assistente já sabe ler — mas perguntar a uma IA "quanto mede o Pavilhão 4
   da FIL" **sem lhe dar a ficha** é a receita para ela inventar um número com
   toda a confiança, que é a regra que mais se protege nesta app. Além disso,
   dentro de um pavilhão o GPS chega para saber que estás *na FIL*, não em que
   pavilhão.
   **A versão forte:** memória de salas. Mede-se uma vez, guarda-se com o
   nome; da próxima, o GPS (ou só o nome) traz de volta o que **tu** mediste.
   Não é a IA a adivinhar — são dados com fonte, e melhoram com o uso. Encaixa
   no que o Worker já faz com os projetos anteriores.

E, em qualquer dos casos: um número que venha daqui **nunca** pode aparecer
como medida confirmada. Vem marcado como medido pelo telemóvel, com a sua
incerteza — tal como a app já marca as estimativas da IA.

#### Por decidir — o que vem a seguir

As duas primeiras linhas da tabela estão feitas, e foi de propósito por essa
ordem: agora o AR seria uma melhoria, não a condição para a coisa existir.

A seguir, por ordem de retorno:

1. **Ampliar a régua para ecrã inteiro** — pequeno, e é o que separa
   "consigo medir" de "consigo medir bem" num telemóvel.
2. **Memória de salas** — mede-se uma vez, guarda-se com o nome, e da
   próxima vez o GPS (ou só o nome) traz de volta o que **tu** mediste. É a
   opção que dá dados com fonte em vez de adivinhados, e melhora com o uso.
3. **AR** — só Android, e fraco exactamente num pavilhão vazio.

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

**v3.34 (fases 3 e 4, e a marca nos resumos): as peças deixam de aterrar
umas em cima das outras, e tudo o que se copia leva a marca da app.**

**Fase 3.** A suspeita do plano confirmou-se num teste, e era pior do que
parecia: marcar Ecrã LED e depois 4 TVs punha a fila das TVs (centrada, de
-2,51 a 2,51) exatamente por cima do ecrã LED (também centrado, -4 a 4) —
quatro sobreposições. `lzSincronizarTVs` centrava a fila às cegas, sem
olhar ao que já lá estava. Passa a centrar só quando é a única coisa no
projeto (o sítio certo para uma fila de delays sozinha) e, havendo já outra
coisa, arranca à direita dela — o mesmo critério do `lzNextDefaultPos()`
que as zonas normais já usavam. Testado: com o ecrã LED presente, a fila
passa a começar em 5,1 (zero sobreposições); sozinha, continua centrada em
0,00 exatamente como antes.

**A marca nos resumos** (pedido direto: *"vais ter de marcar o copy em
todas as abas disto pois está a crescer"*). Todos os botões "Copiar"
passam por um único handler (`button.copy[data-target]`), e é lá que a
marca é acrescentada — não repetida no texto de cada aba. Assim uma aba
nova nasce já marcada, sem ninguém se lembrar de o fazer. Leva a versão
junto (`— Mike Apps Calculadores v3.34`) porque estes resumos vão parar a
emails e fichas técnicas, e meses depois é preciso saber de que versão da
app saiu aquele número. Confirmado que nenhum dos 11 alvos de cópia é JSON
— são todos resumos legíveis, portanto acrescentar uma linha não parte
nada. O caminho de recurso (fora de HTTPS, que não é onde a app está
publicada) selecciona o que está no ecrã e por isso não leva a marca.

**v3.35: a marca nos resumos passa a ser o termo legal.** *"Mike apps todos
os direitos reservados — acho que é o termo."* A marca da v3.34 identificava
a app mas não reservava nada; passa a `© 2026 Mike Apps — todos os direitos
reservados · Calculadores v3.35`, com o ano a vir do relógio (não fica preso
a 2026) e a versão mantida pela razão de sempre: estes resumos vão parar a
emails e fichas técnicas, e meses depois é preciso saber de que versão saiu
aquele número. Continua no handler único de cópia, não no texto de cada aba.

**v3.36: a identidade das zonas passa a aguentar mesmo, e corrigida uma
duplicação de material que já existia.** Apanhado a testar o depósito do
Preview (v2.92), mas são dois bugs deste lado, independentes dele:

1. **A fila de TVs trocava de identidade a cada sync.** `lzSincronizarTVs`
   apaga e recria os cartões (é como lida com a quantidade a mudar), e cada
   cartão novo nascia com um `zid` novo. Do outro lado, isso são peças
   NOVAS de cada vez que se mexe numa TV — a arrumação feita no 3D perdia-se
   toda. A fase 2 tinha resolvido isto para renomear uma zona, mas não para
   este caminho. Agora os ids da fila anterior são reutilizados pela ordem
   em que estavam: a 3ª TV de antes continua a ser a 3ª TV de agora.
2. **A fila de TVs DUPLICAVA depois de uma ida e volta ao 3D.** O
   `lzImportarProjetoDoPreview` reconstrói os cartões a partir do que o
   Preview devolve — e os cartões reconstruídos vinham sem a marca de
   origem (`data-origem-tv`). Na sincronização seguinte, a aba TVs começa
   por remover "os seus" cartões, não encontrava nenhum, e ACRESCENTAVA
   outra fila: 4 TVs viravam 8. A marca de origem passa a viajar no payload
   e a ser reposta no regresso (e a ficar gravada, como o resto).

Testado com Playwright: subir de 2 para 4 TVs deixa as duas primeiras
montadas e manda só as duas novas para o depósito (antes iam as quatro); e
depois de uma volta completa pelo 3D, o Ecrã Complexo fica com 4 cartões,
não com 8.

**v3.37: a marca passa a ver-se, e a sair por todos os caminhos.** *"o copy
está?"* — *"não vejo"*. Estava, mas só colada ao texto que o botão "Copiar"
punha na área de transferência: na app, ao olhar para o ecrã, não havia
marca nenhuma. Duas coisas mudam:

1. **À vista.** `© 2026 Mike Apps` na barra superior (ao lado da versão) e
   `© 2026 Mike Apps — todos os direitos reservados` por extenso no rodapé.
   A barra superior é *sticky* e é a mesma para todas as abas, por isso a
   marca fica no ecrã seja qual for a aba aberta — que era o pedido, *"marca
   o copy em todas as abas disto pois está a crescer"*. O ano vem do relógio
   nos dois sítios, como já vinha no texto copiado.
2. **Em todas as saídas, não só no "Copiar".** Os selects de
   partilhar/guardar (texto nativo, `.txt`, `.csv` e PDF) liam o resumo em
   cru e mandavam-no sem marca — ou seja, precisamente os ficheiros que vão
   para fora da empresa saíam por marcar. Passam pelo mesmo `marcaDaApp()`.

Testado com Playwright: as 13 abas, uma a uma, com a marca do topo visível em
todas e zero erros de página; e o texto de `marcaDaApp()` confirmado a chegar
aos dois caminhos de partilha (o do resumo do Projeto e o ciclo genérico das
outras nove calculadoras).

Fica de fora, e à espera de pedido: o **Preview** não leva marca visível — o
pedido dizia *"disto"*, esta app. É uma linha no painel dele quando se
quiser.

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

**v3.38: o modelo da TV passa a viajar até ao bloco Delay.** *"Aqui devia
trazer das TVs também, pois o complexo não transportou o modelo."* Estava
certo: a Ecrã Complexo guarda o **nome** da zona ("TV LED LG 86"), não o
modelo como dado — por isso o `↙ Trazer da Ecrã Complexo` do bloco Delay
trazia a contagem e deixava o modelo em "Nenhum / não sei ainda".

Duas mudanças:

1. **`↙ Trazer das TVs`** (botão novo, no bloco Delay): traz modelo,
   quantidade e — pelo modelo — a resolução, directamente da aba TVs. Para
   quando os delays ainda não passaram pela Ecrã Complexo.
2. **O botão antigo passa a trazer o modelo também**, quando as zonas
   contadas vieram da aba TVs (`data-origem-tv`, a marca que o
   `lzSincronizarTVs` já punha). Nesse caso o modelo é, por definição, o que
   está escolhido na aba TVs.

Os quatro selects de TV da app (TVs, DSM, Delay, Distância de Visualização)
são preenchidos do mesmo `TVS_DATA` e com o mesmo `value` (o índice), por
isso o valor copia-se directo; o `change` que se dispara a seguir é o que já
preenchia a resolução — não se reescreve aqui.

Testado com Playwright: escolher um modelo real + 4 unidades nas TVs e carregar
em "Trazer das TVs" deixa modelo, `count: 4` e resolução em "custom" com os
píxeis do modelo; marcar "Adicionar ao projeto" cria 4 cartões todos com
`data-origem-tv="1"`, e o "Trazer da Ecrã Complexo" traz agora `4` **e** o
modelo. Sem modelo escolhido, traz a quantidade e diz que a resolução fica
como está; com a Ecrã Complexo vazia, dá 0 sem rebentar. Sem erros de consola.

**O que fica por resolver, e é maior do que isto:** numa Ecrã Complexo só com
TVs, a "Resolução final do canvas" fica em `—`, os tiles a `0` e o peso e os
amps a `0,00`. A razão é estrutural: uma zona de TV é um rectângulo em metros
(ver `lzZoneMetrics`, que sai cedo para tipos não-LED), sem píxeis nenhuns —
ao contrário de uma zona LED, que traz pitch, peso e amps do modelo de tile.

Dar-lhe resolução a sério é trabalho de raiz: campo novo por zona, a viajar na
serialização e na ponte para o Preview, e a entrar na conta do canvas (que
hoje é toda feita a partir do pitch). **O peso e os amps não têm solução
nenhuma pela via dos dados**: o `data/tvs.json` tem `diag`, `ratio` e
`resolucao`, e mais nada — inventá-los era partir a regra da casa. Ficariam
sempre a zero, ou a app teria de dizer "não conhecido" em vez de "0,00",
que é provavelmente o certo.

**v3.39: o relatório do projeto passa a ter tudo, e a checklist também.**
Dois relatos seguidos, na mesma noite: *"as TVs não aparecem no relatório do
projeto"* e *"e no checklist não está o projetor"*. Os dois estavam certos, e
eram as duas metades do mesmo problema — a aba Projeto tinha **duas listas que
nunca se falavam**:

- As calculadoras de **Projeção, LED e Blending** preenchem os **campos** da
  aba Projeto, e saíam na primeira metade do relatório.
- As **TVs**, a **Distância de Visualização**, o **Sinal & Data Rate** e o
  **Media Server** ficavam só na "Checklist do projeto", um bloco dobrado à
  parte — e **não** no texto que o botão "Copiar relatório" manda para o
  cliente.

Ou seja: marcar "Adicionar ao projeto" nas TVs e não sair no relatório é, do
lado de quem usa, o mesmo que não ter marcado nada.

**O relatório passa a levar as duas metades.** O texto dos itens marcados é
acrescentado no fim, numa secção **"Também no projeto:"**. Passa por um sítio
só (`escreverRelatorioDoProjeto()`, com a primeira metade guardada em
`projSumBase`), para que qualquer caminho que recalcule os itens actualize o
relatório — e não só o `calcProjeto()`.

**A checklist passa a mostrar o projetor.** A lista "Itens do projeto" ganhou
uma linha por cada calculadora de campos que esteja marcada (Projeção,
Blending, LED, Ecrã Complexo), com a nota *"Preenche os campos do projeto —
sai no relatório, na primeira parte."*

**Estas linhas ficam de fora do texto combinado, de propósito.** Esse texto é
o que vai colado ao relatório, e o projetor já lá está na primeira metade —
repeti-lo era pôr o mesmo equipamento duas vezes na ficha que vai para o
cliente. A lista diz a verdade sobre o que está marcado; o texto não se
duplica.

Testado com Playwright, os quatro estados: nada marcado (lista vazia, sem
secção no relatório); só o projetor (lista com "Distância de Projeção",
texto combinado vazio, relatório com o projetor); projetor + TVs (lista com
os dois, texto só com as TVs, relatório com ambos e **o projetor uma só
vez**); e desmarcar as TVs volta a tirar a secção do relatório. Sem erros de
consola.

**Nota do que continua como estava:** desmarcar "Adicionar ao projeto" na
Projeção **não limpa** os campos que ela preencheu na aba Projeto — o
relatório continua a mostrar o projetor. É o comportamento de sempre, e
provavelmente o certo (ninguém quer ver os seus valores apagados por
desmarcar uma caixa), mas fica escrito por ser fácil de confundir com um bug.

**v3.40: o peso e os amps que não se sabem deixam de dizer 0,00.** *"Mete
'não conhecido' em vez de 0,00."* Era o item 3 da lista de pendentes, na
parte que **não** tem solução pelos dados — e ficou mais urgente quando a
v3.39 pôs esses zeros dentro do relatório que vai para o cliente.

Uma zona de **TV ou de Projeção não tem peso nem consumo**: o `data/tvs.json`
tem diagonal, formato e resolução, e mais nada. Somá-las como **zero** dava um
total que parecia uma medida e não era. Num cálculo de estrutura e de energia,
é a mentira mais cara que esta app podia contar: `0,0 kg` lê-se como "não
pesa", não como "não sei".

Cada zona passa a trazer `pesoConhecido`. Os totais somam **só as que sabem**,
e há três estados em vez de um:

| Projeto | Antes | Agora |
|---|---|---|
| Só TVs | `0,0 kg` · `0,00 A` | **não conhecido** |
| Só LED | `864,0 kg` · `82,08 A` | igual |
| LED **+** TVs | `864,0 kg` (calado) | `864,0 kg (só a zona LED — 3 zonas sem peso no catálogo)` |

O terceiro é o que mais interessa e o que não existia: o total estava certo
para as zonas LED e **calava** que havia material fora da conta. Agora diz.

Vale em todo o lado ao mesmo tempo: o painel da Ecrã Complexo, a linha de cada
zona no resumo (uma TV escreve "peso e amps não conhecidos" em vez de
"0,0 kg, 0,00 A"), a linha TOTAL, o painel da aba Projeto e o relatório.

Aproveitou-se para uniformizar a palavra: o caminho do LED único já dizia
**"não disponível"** quando o modelo de tile não traz peso — passou a
"não conhecido", que é a mesma ideia e agora tem um nome só.

Testado com Playwright, os três estados, mais a linha por zona. Confirmado que
`0,0 kg` e `0,00 A` já não aparecem em lado nenhum do relatório. Sem erros de
consola.

**O que continua por resolver:** os **píxeis** das TVs (`0x0 px`, `0 tiles`).
Esses **têm** dado no catálogo — o que falta é o caminho até à zona, e isso
mexe na conta do canvas, que hoje é toda feita a partir do pitch. Continua a
ser o item 3 da lista, agora só com essa metade.

## O Worker publica-se sozinho (setembro, 11)

Até aqui o Worker ia ao ar com um `wrangler deploy` à mão, do PC. Isso tem um
buraco que já mordeu: uma alteração ao Worker fica em `main` **sem estar no
ar**, e nada o diz. Foi o que aconteceu à memória do Assistente — merged e
inactiva à espera de alguém se lembrar.

`.github/workflows/deploy-worker.yml` publica sempre que algo dentro de
`worker/` entra em `main`, e também à mão (Actions → "Publicar o Worker").
Antes de instalar o que quer que seja, um primeiro passo confirma a
configuração e **pára com uma frase em português** se faltar alguma coisa —
em vez de deixar o `wrangler` rebentar lá à frente com um erro de API. Cobre
os dois secrets do GitHub em falta e, o mais traiçoeiro, os ids de exemplo
(`cola-aqui-o-id`) ainda no `wrangler.toml`: com esses, a publicação passava e
as partilhas/registos/feedback ficavam partidos em silêncio.

O `package-lock.json` do Worker passou a estar no repositório, para o
workflow usar `npm ci` e publicar sempre com a versão de wrangler testada
(3.114.17), não com a mais recente do dia.

**O que ainda precisa das mãos do mike, uma vez** — está escrito passo a
passo, com os comandos, em `worker/DEPLOY.md`: os ids reais das três KV no
`wrangler.toml`, e os secrets `CLOUDFLARE_API_TOKEN` e
`CLOUDFLARE_ACCOUNT_ID` no GitHub. Os secrets do próprio Worker
(`ANTHROPIC_API_KEY`, `ADMIN_TOKEN`, `RESEND_API_KEY`) vivem no Cloudflare e
uma publicação nunca lhes toca.

Verificado nesta sessão: o `wrangler deploy --dry-run` compila o Worker
inteiro (31,22 KiB, os três bindings de KV e as duas vars reconhecidos), o
`npm ci` instala a partir do lock, e o passo de guarda foi corrido nos três
estados — tudo em falta (3 erros), só os ids por trocar (1 erro), e tudo
certo (passa). O que **não** foi verificado, por não haver conta Cloudflare
nesta sessão: a publicação em si.

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
