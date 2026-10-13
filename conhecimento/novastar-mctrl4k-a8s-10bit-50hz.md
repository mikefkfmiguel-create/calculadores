# NovaStar MCTRL4K + A8s — sinal 10-bit a 50Hz (gradientes de grayscale)

Notas de configuração para ter gradientes de grayscale corretos com sinal
10-bit a 50Hz, com o ecrã a 100% e a 50% de brilho. PDF com o mesmo
conteúdo: [`novastar-mctrl4k-a8s-10bit-50hz.pdf`](novastar-mctrl4k-a8s-10bit-50hz.pdf).

> Notas práticas de afinação (outubro 2026), não ficha técnica do
> fabricante. Os nomes dos menus podem variar com o firmware da MCTRL4K e
> a versão do NovaLCT. Confirmar sempre no equipamento.

## Cenário e equipamento

| Elemento | Valor |
| --- | --- |
| Sending card | NovaStar MCTRL4K |
| Receiving card | NovaStar A8s |
| Driver IC / decoder | ICND2153 / ICN2018-ICN2019 |
| Módulo | 96×96 px, scan 1/24, 4 data groups |
| Cabinet | 192×192 px (2×2 módulos), dados da direita para a esquerda |
| Sinal | 10-bit, RGB 4:4:4, 50Hz |
| Software | NovaLCT V5.4.4.6 |

Os 10 bits têm de chegar intactos da fonte até ao módulo.

## O que cada parâmetro do separador Receiving Card faz (NovaLCT)

- **Chip ICND2153 + decoder ICN2018/2019**: é o driver IC do módulo. Define que opções de refresh e de ghosting aparecem.
- **96×96, scan 1/24, 4 data groups**: são as características físicas do módulo. Se estiverem erradas, a imagem fica partida ou repetida.
- **Cabinet 192×192 / From Right to Left**: é o tamanho do cabinet e o sentido do cabo de dados entre módulos.
- **Irregular**: serve para cabinets com módulos em posições não standard.
- **Frame rate**: deve bater com a fonte.
- **DCLK frequency**: é a velocidade do clock de dados. Mais alta dá mais refresh, mas pode causar ruído ou pixels a piscar.
- **GCLK frequency**: é o clock de grayscale. Afeta o refresh e a suavidade.
- **Phase (DCLK/GCLK)**: ajusta o timing dos clocks. Corrige pixels a "dançar", cores trocadas ou faíscas.
- **Refresh Rate Times**: é o multiplicador do refresh. Mais alto é melhor para câmaras, mas pode custar brilho ou grayscale.
- **Grayscale 14bit / 18bit+**: o 18bit+ melhora os pretos e os níveis baixos de brilho.
- **DCLK / GCLK Duty Cycle**: normalmente 50%.
- **Row Blanking**: é a pausa entre linhas do scan. Mais alto elimina o ghosting mas reduz o brilho.
- **Ghost Control Enhancement**: é o anti-ghosting do chip 2153.
- **Eficiência (%)**: é o brilho que resta depois de refresh e blanking.
- **Send / Save**: o Send aplica temporariamente. O Save grava na receiving card.

## Fonte / media server

A fonte tem de sair em 10-bit RGB 4:4:4 full range. Caso contrário, o banding nasce antes do NovaStar.

- Profundidade de cor na GPU: 10 bpc
- Formato: RGB 4:4:4, nunca YCbCr 4:2:2
- Range: Full (0–1023), não Limited
- Frame rate: 50Hz, igual ao EDID da MCTRL4K
- Sem gestão de cor ou gamma extra na saída da GPU

## MCTRL4K — entrada (igual a 100% e a 50%)

| Parâmetro | Valor |
| --- | --- |
| Entrada | DP 1.2 ou HDMI 2.0 |
| EDID | Personalizado: resolução do ecrã @50Hz |
| Input Bit Depth | 10bit (fixo, não Auto) |
| HDR | Off para conteúdo SDR; HDR10/HLG só se a fonte enviar PQ/HLG |
| Frame rate de saída | 50Hz, sincronizado com a fonte |

## A8s — definições comuns (Receiving Card > More Settings)

| Parâmetro | Valor | Porquê |
| --- | --- | --- |
| Frame rate | 50Hz | Igual à fonte |
| Grayscale Level | 14bit | Chega para uma entrada de 10-bit |
| 18bit+ | **Ligado** | Mantém os níveis baixos ao reduzir o brilho |
| Refresh Rate Times | 8 | Ponto de partida; subir só se a câmara mostrar linhas |
| DCLK / GCLK Duty Cycle | 50% / 50% | Valor padrão |
| DCLK / GCLK Phase | Manter atual | Só ajustar se houver pixels instáveis |
| Row Blanking | 27 (≈1.73 µs) | Anti-ghosting; não afeta os gradientes |
| Ghost Control Enhancement | 11 | Subir apenas se houver rasto |

Se o 18bit+ não ficar ativo depois do Send, a combinação de firmware não o suporta.

## Brilho 100% vs 50%

A 50%, o brilho digital custa cerca de 1 bit. O 18bit+ compensa essa perda nos escuros.

| Parâmetro | 100% | 50% |
| --- | --- | --- |
| Screen Brightness (NovaLCT) | 100% | 50% |
| 18bit+ | Ligado (recomendado) | **Ligado (obrigatório)** |
| Current Gain do chip (se disponível) | Máximo / padrão | Alternativa preferível: baixar ganho e deixar brilho digital perto de 100% |
| Gamma | 2.2 (2.4 para vídeo em sala escura) | 2.2 (2.4 para vídeo em sala escura) |
| Bits efetivos estimados | 14bit + 18bit+ | ~13bit + 18bit+ |
| Zona a vigiar | Altas luzes e cor | 0–15% da rampa (escuros) |
| Brilho na fonte | 100%, não reduzir | 100%, não reduzir |

## Validação

Usar uma rampa horizontal de 10-bit (1024 níveis), a 100% e a 50%. Olhar com atenção para os primeiros 10–15% da rampa.

1. Rampa em cinzento, depois R, G e B separados
2. Ver a 100% de brilho e depois a 50%
3. Verificar com a câmara (se houver filmagem): sem linhas nem flicker

| Sintoma | Causa provável | Ação |
| --- | --- | --- |
| Degraus em toda a rampa | Fonte ou MCTRL4K em 8-bit | Rever a GPU (10 bpc, RGB full) e o Input Bit Depth |
| Degraus só nos escuros a 50% | 18bit+ inativo ou brilho digital | Ativar 18bit+ ou usar Current Gain |
| Pretos levantados | Limited range | Mudar a fonte para Full range |
| Linhas na câmara | Refresh baixo | Subir Refresh Rate Times e confirmar 14bit |
| Rasto na linha de cima | Ghosting | Subir Row Blanking ou Ghost Control |

## Checklist

- [ ] Export da configuração atual da receiving card (backup)
- [ ] Fonte em 10-bit RGB 4:4:4 full @50Hz
- [ ] MCTRL4K: EDID @50Hz e Input Bit Depth 10bit
- [ ] A8s: 18bit+ ligado, 14bit, Refresh Times 8
- [ ] Brilho definido (100% ou 50%)
- [ ] Send e teste com rampa
- [ ] Save na receiving card
- [ ] Export da configuração final com o nome do cenário (100% / 50%)
