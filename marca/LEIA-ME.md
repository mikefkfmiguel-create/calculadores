# mike apps — o logótipo

Quatro apps numa grelha, e os cantos vão abrindo — quadrado, squircle, círculo —
até a última deixar de ser caixa e virar movimento. É o que o mike faz: caixas
que acabam em play.

## Qual ficheiro usar

| quando | ficheiro |
|---|---|
| ícone de uma app, atalho, favicon | `mike-apps-icone.svg` |
| ícone no Windows (Inno, PyInstaller, atalhos) | `mike-apps.ico` |
| cabeçalho de um site ou documento, fundo claro | `mike-apps-horizontal.svg` |
| o mesmo, fundo escuro | `mike-apps-horizontal-branco.svg` |
| espaço estreito (cartão, ecrã de arranque) | `mike-apps-empilhado.svg` / `-branco.svg` |
| carimbo, gravação, uma cor só | `mike-apps-mono-tinta.svg` / `-branco.svg` |
| onde não entra SVG, só o símbolo | `png/simbolo-*.png` e `png/icone-*.png` |
| onde não entra SVG, marca completa | `png/marca-*.png` (fundo claro) |
| o mesmo, para fundo escuro | `png/marca-branco-*.png` |
| marca empilhada em PNG | `png/marca-empilhada*.png` |
| onde a transparência não serve | `png/icone-1024-branco.png` |

**Todos os PNG têm fundo transparente.** Os `-branco` têm as *palavras* em
branco — sobre fundo claro ficam invisíveis, e é isso que se pretende: são para
fundo escuro. O símbolo é sempre azul, nas duas versões.

O manual visual está no `prova.html` — abre no browser.

## As cores

| nome | hex | onde |
|---|---|---|
| Azul fundo | `#1246E6` | canto escuro do gradiente |
| Azul | `#2E7BFF` | corpo |
| Azul claro | `#3B8CFF` | o círculo |
| Ciano | `#22D3EE` | a app de cima à direita, e o play |
| Tinta | `#0C1020` | as palavras |

## Três regras, e só três

1. **O ar à volta** é a altura de uma app da grelha. Nada entra nesse espaço.
2. **Abaixo dos 16 px** usa-se só o ícone, nunca a marca com as palavras — a
   esse tamanho as letras deixam de se ler e só sujam.
3. **Contraste com o que está atrás.** Azul sobre azul é o erro fácil de fazer
   sem dar por ele; para fundos escuros existem as versões `-branco`.

## Uma coisa a saber sobre a fonte

Nos SVG com palavras, o texto está escrito em **Segoe UI** e não convertido em
curvas. Numa máquina que não a tenha — um Mac, uma gráfica, o computador de
outra pessoa — o desenho mantém-se mas as letras mudam de feitio.

Para dentro de casa não incomoda. Para dar a terceiros ou mandar para impressão,
usa os PNG, ou pede as letras em curvas.

## Se for preciso mexer

O símbolo vive numa grelha de 512: quatro caixas de 168 com 32 de intervalo,
a começar em 72. Os raios dos cantos são 30, 64 e círculo — é essa progressão
que conta a história, por isso é a última coisa a mudar.
