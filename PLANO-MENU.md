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

Cinco escolhas. As quatro primeiras são contas rápidas; a última é a app como
está hoje.

> **Continuar: ‹nome do projeto›** — só quando há projeto guardado
>
> Calcular distâncias
> Calcular resoluções
> Ver medidas de TV/ecrã STD
> Calcular visualização
> **Abrir a calculadora completa** — todas as abas, projeto e sync com o 3D

"Avançado" e "Criar projeto completo" eram dois nomes para a mesma porta
(confirmado em conversa: *"estavas certo"*), por isso sobra uma, chamada pelo
que faz.

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

## Fases

Cada fase é publicável sozinha e útil sozinha. Ordem por tamanho do destino,
do mais pequeno para o maior: assim a mecânica do menu prova-se no caso barato.

### Fase 1 — o ecrã, e uma porta só

A única porta que não precisa de trabalho no destino, porque o destino é a app
de hoje.

- Ecrã de boas-vindas, antes das abas.
- **Continuar: ‹nome›** em primeiro, quando há projeto guardado. Nunca
  interrompe trabalho a meio.
- **Abrir a calculadora completa** — muda para as abas como estão.
- **Abrir projeto** e **Limpar** mudam-se para aqui; hoje vivem espremidos no
  cabeçalho.
- O logótipo passa a levar sempre de volta ao menu. Sem isso, a calculadora
  completa é uma porta de sentido único.

**"Abrir a calculadora completa" não é um modo.** Não guarda estado, não
esconde nada depois, não há interruptor para procurar. Quem entrou por uma
conta rápida e precisa de mais, carrega nas abas e está lá.

**Verificação:** abrir a app sem projeto mostra o menu com cinco linhas; com
projeto guardado mostra seis, a primeira a nomear o projeto. Carregar em
"Abrir a calculadora completa" dá a app exactamente como hoje. O logótipo
volta ao menu de qualquer aba.

### Fase 2 — Ver medidas de TV/ecrã STD

O destino mais pequeno: 5 campos, 3 painéis (`tv`).

1. A resposta à chegada: largura, altura, resolução e distância mínima/máxima
   (`tv-out-w`, `tv-out-h`, `tv-out-res`, `tv-out-dmin`, `tv-out-dmax`)
   visíveis sem abrir nada.
2. A entrada no menu.

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
