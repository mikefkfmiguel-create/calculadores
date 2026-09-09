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
`mikefkfmiguel-create.github.io/avplanner/`), uma página só com a marca da
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
2. **TVs para o Preview**, como os projetores já vão (rácio, distância,
   modelo — nunca o catálogo). Ainda por fazer (verificado a 7/9: não há
   nenhum botão "Ver no Preview 3D" na aba TVs).
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
