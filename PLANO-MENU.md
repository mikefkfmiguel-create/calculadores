# Plano — menu de entrada, porta a porta

Escrito a 14 de setembro de 2026, com a app na **v3.78**. Combinado em conversa;
nada disto está feito ainda.

## O pedido

> *"Com tanto avanço que aqui temos poderá tornar-se complicado para um gestor
> de um projeto. Poderíamos tornar isto em dois níveis de uso."*
>
> *"Iríamos pelo boas-vindas. Aí uma lista de escolhas."*
>
> *"O menu tornaria menos confuso para quem não precisa de tudo e está no
> terreno e quer apenas fazer uma conta."*

## O tamanho do problema, medido

| | Calculadores | Preview |
|---|---|---|
| abas / secções | 14 | 17 |
| campos | 126 | 48 |
| listas | 50 | 1 |
| caixas de marcar | 24 | 22 |
| saídas numeradas | 115 | — |

E os dois números que decidem o desenho:

- **79 % dos campos numéricos (93 de 117) já têm um valor por omissão que
  funciona.** A maior parte nunca precisa de ser tocada.
- **51 dos 65 painéis nascem fechados.**

Ou seja: **os dois níveis já existem — a app é que não os assume.** Um por
omissão que responde sem se mexer em nada, e um detalhe que se abre quando se
quer. Só que não é uma decisão, é um acidente de arrumação: nada garante que o
nível 1 esteja completo, e nada diz a quem chega onde é que ele acaba.

## O menu

Quatro contas rápidas, o 3D, e a app como está hoje.

> **Últimos projetos** — até 5, os mais recentes primeiro
>
> Calcular distâncias
> Calcular resoluções
> Ver medidas de TV/ecrã STD
> Calcular visualização
> **Ver em 3D** — abre o Preview
> **Abrir a calculadora completa** — todas as abas, projeto e sync com o 3D

"Avançado" e "Criar projeto completo" eram dois nomes para a mesma porta
(confirmado em conversa: *"estavas certo"*), por isso sobra uma, chamada pelo
que faz.

O menu é a entrada para **os dois serviços**, não só para as abas: hoje o
"Preview 3D" está espremido num botão do cabeçalho.

O valor não está no código — está em **chamarem-se pelo que se quer**, e não
pelo nome da aba. *"Ver medidas de TV"* é uma pergunta; *"TVs"* é um
substantivo.

## A regra que decide as fases

**Uma porta só entra no menu no mesmo dia em que o destino dela responde à
chegada.**

Isto não é zelo: é a medição. Hoje, **as quatro portas rápidas aterram num
painel fechado** —

| destino | aba | campos | painéis | a resposta nasce |
|---|---|---|---|---|
| Calcular distâncias | `projecao` | 13 | 3 | fechada |
| Calcular resoluções | `led` | 21 | 5 | fechada |
| Ver medidas de TV | `tv` | 5 | 3 | fechada |
| Calcular visualização | `visualizacao` | 13 | 5 | fechada |

Um menu sozinho seria uma placa de sinalização para uma sala às escuras: em vez
de *"qual das 14 abas?"*, a pergunta passaria a ser *"porque é que isto não
mostra nada?"* — que é literalmente o que foi reportado duas vezes no mesmo dia
(*"A LENTE????"* e *"esta menina deveria fazer a conta sozinha"*, v3.75 e
v3.78).

E a pessoa que o menu serve — *"está no terreno e quer apenas fazer uma
conta"* — é precisamente quem não pode ter de abrir um painel para ver o
número.

## Arranque: nada assumido, nada perdido

Quatro decisões tomadas em conversa, e que andam juntas. As duas primeiras são
a mesma ideia vista dos dois lados: **nada é assumido, e nada se perde.**

### 1. Abre sempre limpo, dos dois lados

> *"Abre sempre dos dois lados com o sync desligado e em projeto limpo até eu
> abrir um. Mesmo na calculadora, para que nunca leve a engano com valores auto
> de arranque."*

- **Sem projeto carregado**, sem nome, nada marcado "adicionar ao projeto".
- **Sincronização desligada.**
- O Preview já nasce assim desde a v3.32 (sala vazia, tudo desligado). Passa a
  valer também para os Calculadores.

**Limpo não é em branco — e isto é a distinção que decide as fases.** Um campo
com 10 m escritos não engana ninguém; o que engana é um *projeto* que parece
teu e não é. Por isso:

- **O projeto** nasce vazio: nada lá dentro até o abrires ou o construíres.
- **Os campos das contas rápidas** mantêm os valores de trabalho (são 93 em
  117), porque é deles que vem a resposta à chegada — sem eles a porta rápida
  não responde nada, que era o problema que o menu existe para resolver. Ficam
  marcados como **exemplo** até serem tocados, e a porta di-lo.

> ⚠️ **Por confirmar com o mike:** se "limpo" quiser dizer mesmo *campos em
> branco*, as Fases 2 a 5 mudam de forma — a porta rápida deixa de poder
> responder à chegada e passa a pedir dois números primeiro. Não é impossível,
> é outro plano.

**Cuidado na migração:** hoje a sincronização está **ligada por omissão**
(`sincronizacaoAutomaticaLigada()` devolve `true` quando a chave não existe).
Virar o valor por omissão desliga-a a quem nunca lhe tocou — em silêncio, que é
exactamente o defeito que esta app passa a vida a corrigir. O menu tem de o
dizer, com um clique para ligar: *"sincronização com o 3D desligada"*.

### 2. Os últimos 5, guardados sozinhos

> *"Guarda sempre os 5 últimos projetos auto em cache para escolher, com
> nomeação automática pela data."*

É a rede que torna o arranque limpo seguro: se a app nunca assume nada, tem de
garantir que nada se perdeu.

- Guardados **automaticamente**, sem depender de alguém carregar em "Guardar".
  Hoje o Guardar/Abrir é um **ficheiro** (`proj-save` / `proj-open`) — continua
  a existir, isto é outra coisa: histórico local.
- **Cinco**, os mais recentes à frente; o sexto empurra o mais antigo.
- **Nome automático pela data** quando o projeto não tem nome; com nome, o nome
  e a data.
- Aparecem em primeiro no menu. Escolher um é o único caminho para a app deixar
  de estar limpa.

Duas coisas a tratar com cuidado, porque já morderam antes:

- **Guardar um projeto vazio não conta.** Cinco entradas todas vazias é o mesmo
  que não ter rede nenhuma.
- **O `localStorage` tem limite.** Cinco projetos com plantas e imagens podem
  não caber. A escrita tem de falhar em condições — nunca apagar as anteriores
  para meter a nova, e dizer quando não coube.

### 3. "Adicionar ao projeto" à vista na porta rápida

Hoje uma conta só chega ao 3D e ao projeto se a caixa estiver marcada — o que
está certo, senão cada tecla inundava a sala. Mas quem entra pela porta rápida
não sabe que essa caixa existe. Passa a estar **à vista**, no topo da conta.

### 4. A ponte nunca depende da porta

**"Abrir a calculadora completa" é um destino, não um modo.** Não há bandeira
de "modo completo", e a sincronização não sabe por que porta entraste.

Fazes a conta rápida no terreno, marcas a caixa, e ela fica lá — quando abrires
a app inteira, está. Constróis no Preview em obra, sem os Calculadores abertos
sequer, e quando os abrires o material está à espera.

Gatilhar a ponte pelo modo de entrada criaria o pior defeito que esta app já
teve: trabalho que desaparece em silêncio (o *"marcado numa gaveta, ausente
noutra"* da v3.73, o Depósito, a ponte do blend a falhar sem dizer nada).

### O ciclo já existe nos dois sentidos

Verificado no código, não é preciso construí-lo — é preciso não o partir:

- O Preview **cria projeto do nada**: `garantirProjeto()` nasce com
  `origem: "preview"`, e o estado de sala vazia já oferece três portas.
- E **devolve**: `devolverAosCalculadores()` manda as zonas com o `id` intacto,
  posição, tiles e resolução (`mikeapps-ecra-v1`).
- São sete pontes, e uma só chave a governar o automático
  (`mikeapps-sincronizacao-v1`).

**Não se faz uma terceira página de entrada** à frente das duas apps. São dois
endereços e duas PWAs instaláveis; quem instalou o Preview no telemóvel quer
abrir o Preview, não um átrio. Cada uma tem o seu menu e conhece a outra — o
ecrã de sala vazia do Preview já é o menu espelho deste.

## Fases

Cada fase é publicável sozinha e útil sozinha. Ordem por tamanho do destino,
do mais pequeno para o maior: assim a mecânica do menu prova-se no caso barato.

### Fase 1 — a rede, o arranque limpo, e o ecrã

Três passos, **nesta ordem**, e a ordem não é negociável: **a rede antes do
arranque limpo.** Publicar "abre sempre limpo" sem o histórico é tirar a app do
sítio e não pôr nada no lugar — uma regressão com boas intenções.

**1a. O histórico dos últimos 5.** Automático, nome pela data, o mais recente à
frente. Projeto vazio não entra. A escrita falha em condições quando o
`localStorage` esgota, e diz que não coube — nunca apaga os anteriores para
meter o novo.

**1b. O arranque limpo.** Sem projeto, sem nome, sincronização desligada, dos
dois lados. Com o aviso da migração: a quem tinha a sincronização ligada sem
nunca lhe ter tocado, o menu diz que está desligada e dá o clique para a ligar.

**1c. O ecrã.** É a única porta que não precisa de trabalho no destino, porque
o destino é a app de hoje.

- Ecrã de boas-vindas, antes das abas.
- Os **últimos projetos** em primeiro. Escolher um é o único caminho para a app
  deixar de estar limpa. Nunca interrompe trabalho a meio.
- **Abrir a calculadora completa** — muda para as abas como estão.
- **Ver em 3D** — abre o Preview.
- **Abrir projeto** (ficheiro) e **Limpar** mudam-se para aqui; hoje vivem
  espremidos no cabeçalho.
- O logótipo passa a levar sempre de volta ao menu. Sem isso, a calculadora
  completa é uma porta de sentido único.

**"Abrir a calculadora completa" não é um modo.** Não guarda estado, não
esconde nada depois, não há interruptor para procurar. Quem entrou por uma
conta rápida e precisa de mais, carrega nas abas e está lá.

**Verificação:**

- App aberta de fresco: nenhum projeto carregado, nome vazio, nenhuma caixa
  "adicionar ao projeto" marcada, sincronização desligada, e o 3D vazio.
- Trabalhar, fechar, reabrir: o trabalho está na lista dos últimos, não
  carregado. Escolher a primeira linha repõe-no inteiro.
- Seis projetos seguidos: a lista fica com cinco, o mais antigo saiu.
- Carregar em "Abrir a calculadora completa" dá a app exactamente como hoje; o
  logótipo volta ao menu de qualquer aba.

### Fase 2 — Ver medidas de TV/ecrã STD

O destino mais pequeno: 5 campos, 3 painéis (`tv`).

1. A resposta à chegada: largura, altura, resolução e distância mínima/máxima
   (`tv-out-w`, `tv-out-h`, `tv-out-res`, `tv-out-dmin`, `tv-out-dmax`)
   visíveis sem abrir nada.
2. **"Adicionar ao projeto" à vista**, no topo da conta.
3. A entrada no menu.

Os passos 1 a 3 repetem-se tal e qual nas Fases 3, 4 e 5 — muda só a aba e
quais são as saídas que têm de aparecer.

**Verificação:** entrar pela porta e ler as cinco saídas sem um clique.

### Fase 3 — Calcular distâncias

`projecao`, 13 campos, 3 painéis. O painel de resultados
(`data-accent="projecao"`) nasce fechado.

1. À chegada: largura, altura, resolução do projetor e distância mínima/máxima
   (`p-out-w`, `p-out-h`, `p-out-projres`, `p-out-dmin`, `p-out-dmax`).
2. A entrada no menu.

**Verificação:** a mesma — a resposta lê-se sem abrir.

### Fase 4 — Calcular visualização

`visualizacao`, 13 campos, 5 painéis.

1. À chegada: `v-out-dmin`, `v-out-dmax` e o ângulo (`v-out-angle`), que é o
   que decide se a plateia vê.
2. A entrada no menu.

### Fase 5 — Calcular resoluções

`led`, 21 campos, 5 painéis. O maior, e o único com três donos possíveis.

1. À chegada: `l-out-px`, `l-out-py`, `l-out-size` e `l-out-pitch`.
2. **Os dois atalhos laterais**, à entrada da aba: *"é um blend de
   projetores?"* → `blend`; *"é grafismo?"* → `grafismo`. Um passo, não um
   submenu.
3. A entrada no menu.

## Como se encaminha

Pelo mecanismo que já existe: cada linha do menu carrega no
`.tab[data-mode="…"]` correspondente. **Não há um segundo encaminhador** — o
`tabs.forEach(… click …)` já trata do `aria-selected`, do painel activo, do
`syncAddProjectFixed()` e do `updateTabsCurrent()`. Um router novo acabaria a
discordar deste no dia em que uma aba mudasse.

## O que fica de fora do nível 1, e porquê

Lentes, Dome, Sinal & Data Rate, Media Server, Ecrã Complexo, Blending,
Grafismo, Projeto e Assistente. **Oito das catorze abas.** É o ponto: deixam
de incomodar quem não precisa delas, e continuam a uma porta de distância.

## O que este plano NÃO faz

- **Não esconde a justificação.** O nível 1 esconde o *caminho*, nunca o
  *porquê*. Se a lente não serve, continua a dizer o rácio, a janela de
  distâncias e a razão. Em produção, o número que não se pode conferir é o que
  custa dinheiro na obra.
- **Não há interruptor "modo simples / modo técnico".** Falha sempre da mesma
  maneira — esconde precisamente o campo de que a pessoa precisa, e ela não
  encontra o interruptor. E duplicava a superfície a testar.
- **Não há perfis guardados** (gestor / técnico). Não são duas pessoas, são
  **dois momentos**, e muitas vezes a mesma pessoa: ao telemóvel a preparar um
  orçamento, ou à secretária a fechar um blend de cinco máquinas. Um perfil
  escolhido no arranque erra sempre, porque obriga a declarar hoje o que só se
  sabe daqui a dez minutos.
- **Não mexe nas contas.** Nenhuma fase acrescenta aritmética nova. Só muda
  onde as respostas aparecem e por onde se lá chega.

## Não confundir com a edição "global"

O `CLAUDE.md` guarda a ideia de separar o motor de cálculo do inventário da
AVK, para uma edição de venda. **É um eixo diferente deste:** este é *quanto se
vê*; esse é *o que se leva*. Tratados como o mesmo, dão quatro combinações e
nenhuma bem feita.

Há uma sobreposição útil, ainda assim: perceber o que é motor e o que é AVK
serve os dois, e fazer o menu primeiro deixa esse corte meio feito.

## O que me faria parar

Se, ao fazer a Fase 2, "a resposta à chegada" obrigar a reorganizar a aba em
vez de a abrir — então o problema não é o menu, é a aba, e as fases seguintes
ficam mais caras do que este plano assume. Nesse caso volta-se a falar antes
de continuar.
