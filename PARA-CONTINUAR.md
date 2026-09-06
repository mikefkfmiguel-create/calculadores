# Para continuar

Onde isto está, e o que falta. Escrito a 6 de setembro de 2026.

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

## O que falta, do lado de cá

1. **O shift das lentes que faltam.** Estão as 9 lentes Epson (publica-o por
   lente). Sony e Barco bloqueiam leitura automática das páginas — à mão, a
   partir das fichas técnicas. Panasonic, Christie e NEC publicam o shift **no
   corpo do projetor**, não na lente: esse número pertence a
   `data/projectors.json`, não a `data/lenses.json`.
2. **TVs para o Preview**, como os projetores já vão (rácio, distância,
   modelo — nunca o catálogo).
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
