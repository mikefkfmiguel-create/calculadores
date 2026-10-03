# Soluções próprias — as Mike Apps

As ferramentas que o mike construiu e que podem entrar numa proposta **antes
de ir ao mercado**. Cada linha diz o que a app resolve num evento. Escrito a
partir dos README/LEIA-ME de cada repositório (3 de outubro de 2026): é o que
a app diz que faz, não promessas. Antes de prometer a um cliente, confirmar
com o mike a versão e o estado.

Regra para o Better call Mike: quando o pedido tem uma necessidade que uma
destas cobre, **sugere primeiro a solução própria** e compara-a com uma
alternativa de mercado (com fonte). Se nenhuma cobre, diz isso e vai ao
mercado.

## Planeamento e cálculo (web, telemóvel)

- **Mike Apps Calculadores** — distância de projeção, ecrã LED & pixel pitch,
  blending, dome, distância de visualização, TVs, sinal & data rate, fibra &
  SFP, media server, lentes, grafismo px↔cm e a ficha técnica do projeto.
  Usa o inventário da AVK. Web/PWA.
- **Better call Mike** — perguntas técnicas do terreno e pedidos de projeto
  (texto, foto, PDF, email); responde com notas da equipa + web, e passa o
  projeto para os Cálculos e o Preview 3D. Web/PWA.
- **Mike Apps Preview 3D** — a sala, o palco, o público e os ecrãs em 3D à
  escala, com a vista de quem está sentado; link para mandar a quem não está.
  Corre sem servidor (também sem rede). Web/PWA.
- **AV Planner** — página de entrada que junta as três acima.
- **Test Pattern Generator** — test patterns para LED walls e ecrãs wide
  (grelha, mapa de cabinets numerados, barras, rampas, cinzas, xadrez,
  linhas de pixel, réguas), exporta PNG à resolução real até 32768 px.
  Um só ficheiro, funciona offline.
- **Comparador de PDFs** — extrai e compara os mapas de material das
  propostas técnicas AV (sala, categoria, descrição, datas, quantidades).
  PC e web/telemóvel, tudo local.

## Régie, palco e show control (Windows/Mac)

- **AVKtimer (MyCueTimer)** — cronómetro/relógio de estúdio: contagem
  decrescente, modo negativo, relógio, ecrã de palco, visor web para OBS/vMix,
  mensagens, alarmes e API HTTP para Bitfocus Companion. Windows e macOS.
- **Cue4All Prompter** — teleprompter de broadcast: régie/operador + janela de
  saída (render) com scroll suave; a pré-visualização é igual ao palco. Windows.
- **Cue Light** — sincroniza PowerPoint entre máquinas: master manda o
  impulso e a posição do slide/animação, slaves e máquina de notas seguem
  (arranque medido com ~1 ms de diferença). Leva a cue light do master.
- **ShowPresenter** — servidor de apresentações para rede local fechada:
  salas independentes, o orador escolhe a sessão e o deck vai sozinho para
  o projetor, com presenter view no portátil; continua se a rede cair.
- **Live Overlay Engine** — motor de infografismo live (lower thirds, faixas,
  texto) com saídas fill e key para o switcher, modo composição/direto, e
  módulo para o Bitfocus Companion.
- **Full Controller (w7control)** — comando remoto do WATCHOUT 7 pela API do
  Director, em app Windows + interface web no telemóvel/tablet (inclui PJLink).
- **Mike Virtual Remote** — app Android (tablet) que faz de Stream Deck
  virtual para o Bitfocus Companion (Satellite API) quando não há deck físico.
- **EDID Manager** — gestor de EDIDs para servidores de vídeo (Watchout,
  Pixera, disguise, Resolume, vMix…) com placas NVIDIA, AMD e Intel; três
  métodos (NVAPI, ADL, Registo). Offline.

## Conteúdo, reprodução e ativações

- **QuickVideoPlayer** — servidor local de vídeos (Node + ffmpeg) com
  dashboard, listas/shows e saída para ecrã externo.
- **QuickVideoPlayer Android** — kiosk autónomo de vídeos para Android
  (touchscreens, boxes/Android TV, MUPI).
- **MySignage + StickPlayer** — gestão de frota de sinalética digital (AVK
  Fleet Manager): servidor central com dashboard, players Windows e Android
  (TV box, tablets); pen USB em modo sem rede.
- **Mconverter** — conversor de vídeo/imagem acelerado por GPU NVIDIA
  (FFmpeg), incluindo PowerPoint para vídeo mantendo os tempos das transições.
- **Fotowall** — paredes de fotos para eventos: API e páginas (Cloudflare
  Worker) + visualizador Windows autónomo.
- **Race Clock** — relógio de jogo configurável para ativações (parar o mais
  perto possível do alvo), com perfis, botão remoto no telemóvel e ecrã espelho.
- **Gaby Draw** — app Android (sem README; a descrever com o mike antes de a propor).

## Interno (não entra em propostas a clientes)

- **Things On** (site + admin) — página de downloads das apps e painel de
  licenças/instalações.
- **Video Team** — escala da equipa de vídeo.
