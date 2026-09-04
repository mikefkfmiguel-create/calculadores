// Motor de tradução PT→EN, aplicado no browser (sem build step, sem tocar
// na lógica de cálculo). Funciona por substituição de frases: percorre o
// texto visível e troca cada trecho em PT que reconhece pelo equivalente em
// EN. Como cada calcX() já regenera o texto em PT do zero a cada
// interação, o MutationObserver só precisa de traduzir para a frente — indo
// de volta a PT, o dicionário inverso faz a mesma coisa ao contrário.
(function () {
  "use strict";

  var DICT_EN = {
    // ---- Cabeçalho / navegação / instalação ----
    "Distância de projeção e pixel pitch de ecrãs LED, calculados com precisão para fichas técnicas de produção.": "Projection distance and LED pixel pitch, calculated precisely for production spec sheets.",
    "Instala esta app": "Install this app",
    "acesso direto no ecrã principal, sem andares à procura do link.": "direct access from your home screen, no hunting for the link.",
    "Instalar": "Install",
    "Distância de Projeção": "Projection Distance",
    "Blending Multi-Projetor": "Multi-Projector Blending",
    "Distância de Visualização": "Viewing Distance",
    "Ecrã LED & Pixel Pitch": "LED Screen & Pixel Pitch",
    "Ecrã Complexo": "Multi-Zone Screen",
    "Sinal & Data Rate": "Signal & Data Rate",
    "Media Server": "Media Server",
    "Projeto": "Project",
    "Lentes": "Lenses",
    "TVs": "TVs",
    "Grafismo px↔cm": "Graphics px↔cm",
    "Ajuda": "Help",
    "Calculadores — ferramenta interna, valores para conferência antes de envio ao cliente.": "Calculators — internal tool, values for review before sending to the client.",

    // ---- Ações / botões comuns ----
    "Copiar resumo": "Copy summary",
    "Copiar relatório": "Copy report",
    "Copiar checklist": "Copy checklist",
    "Adicionar ao projeto": "Add to project",
    "↗ Partilhar/Guardar": "↗ Share/Save",
    "Partilhar ou guardar — escolhe o formato e por onde enviar": "Share or save — choose the format and where to send it",
    "Como texto (mensagem)": "As text (message)",
    "Como ficheiro .txt": "As .txt file",
    "Como ficheiro .csv (Excel)": "As .csv file (Excel)",
    "Como PDF": "As PDF",
    "Guardar projeto": "Save project",
    "Abrir projeto…": "Open project…",
    "Descarregar .txt": "Download .txt",
    "Limpar projeto": "Clear project",
    "Para começar um projeto novo do zero, usa": "To start a new project from scratch, use",
    "— repõe só os campos desta aba, não mexe nas calculadoras nem nas zonas do Ecrã Complexo.": "— it only resets this tab's fields, it doesn't touch the calculators or the Multi-Zone Screen zones.",
    "Para começar um projeto novo, usa": "To start a new project, use",
    "Repõe os campos desta aba em branco e desliga 'Adicionar ao projeto' em todas as calculadoras — não apaga as calculadoras em si nem as zonas do Ecrã Complexo": "Resets this tab's fields to blank and turns off 'Add to project' in every calculator — doesn't delete the calculators themselves or the Multi-Zone Screen zones",
    "Projeto limpo.": "Project cleared.",
    "Limpar zonas": "Clear zones",
    "Remover todas as zonas desta lista — as outras calculadoras e o projeto não são afetados": "Removes all zones from this list — the other calculators and the project aren't affected",
    "Remover todas as zonas desta lista? Esta ação não pode ser desfeita — as outras calculadoras e o projeto não são afetados.": "Remove all zones from this list? This can't be undone — the other calculators and the project aren't affected.",
    "Zonas removidas.": "Zones removed.",
    "numa zona apaga só essa;": "on a zone deletes just that one;",
    ", no fundo da lista, apaga todas de uma vez para recomeçar do zero — pede confirmação antes, porque não pode ser desfeito. Nenhum dos dois mexe nas outras calculadoras nem no projeto.": ", at the bottom of the list, deletes all of them at once to start from scratch — it asks for confirmation first, because it can't be undone. Neither touches the other calculators or the project.",
    "Cancelar": "Cancel",
    "Confirmar": "Confirm",
    "Limpar": "Clear",
    "Remover": "Remove",
    "Mover": "Move",
    "Mover selecionadas": "Move selected",
    "Todas": "All",
    "Todas as marcas": "All brands",
    "Usar": "Use",
    "Usar resolução de": "Use resolution from",
    "Usar total das zonas": "Use combined zone total",
    "Usar total das zonas (aba Ecrã Complexo)": "Use combined zone total (Multi-Zone Screen tab)",
    "Calcular a partir do ecrã": "Calculate from screen size",
    "ver resultado ▾": "see result ▾",
    "versão avançada": "advanced version",
    "↗ Abrir versão avançada (página à parte, mesmas zonas)": "↗ Open advanced version (separate page, same zones)",
    "Ver ↗": "View ↗",
    "Referenciado ↗": "Referenced ↗",
    "Sel.": "Sel.",
    "Vis.": "Vis.",
    "Ref.": "Ref.",
    "+ Adicionar zona": "+ Add zone",
    "Aplicar réplicas": "Apply copies",
    "Atualizar réplicas": "Update copies",
    "Eu defino nº e overlap": "I'll set the count and overlap",
    "Exportar mapa de píxeis": "Export pixel map",
    "Exportar mapa de píxeis (PNG)": "Export pixel map (PNG)",
    "Exportar máscara": "Export mask",
    "Exportar máscara (PNG)": "Export mask (PNG)",
    "→ horizontal": "→ horizontal",
    "↓ vertical": "↓ vertical",
    "↙ Ecrã Complexo": "↙ Multi-Zone Screen",
    "↙ Projeto": "↙ Project",
    "↙ Sinal & Data Rate": "↙ Signal & Data Rate",
    "↙ Tile do Projeto": "↙ Project's tile",
    "↙ Trazer escolha do Sinal": "↙ Bring choice from Signal tab",

    // ---- Badges / estado ----
    "Recomendado": "Recommended",
    "Possível": "Possible",
    "Não aconselhado": "Not advised",
    "Mercado": "Market",
    "Estimado": "Estimated",
    "Equipamento marcado": "Owned equipment",
    "✓ compatível": "✓ compatible",
    "melhor": "best",
    "Nenhum item adicionado ainda.": "No items added yet.",

    // ---- Ecrã / projetor — campos comuns ----
    "Ecrã": "Screen",
    "Ecrã & projetor": "Screen & projector",
    "Ecrã físico": "Physical screen",
    "Ecrã físico desejado": "Desired physical screen",
    "Altura": "Height",
    "Altura (metros)": "Height (meters)",
    "Altura desejada": "Desired height",
    "Altura do ecrã": "Screen height",
    "Largura": "Width",
    "Largura (metros)": "Width (meters)",
    "Largura desejada": "Desired width",
    "Largura do ecrã": "Screen width",
    "Largura recomendada": "Recommended width",
    "Diagonal": "Diagonal",
    "Diagonal (polegadas)": "Diagonal (inches)",
    "Diagonal aproximada": "Approximate diagonal",
    "Diagonal do ecrã": "Screen diagonal",
    "Diagonal máx.": "Max diagonal",
    "Diagonal mín.": "Min diagonal",
    "Tamanho": "Size",
    "Tamanho de ecrã ideal": "Ideal screen size",
    "Tamanho do ecrã": "Screen size",
    "Tamanho real": "Actual size",
    "Formato": "Aspect ratio",
    "Formato (ratio) do projetor": "Projector aspect ratio",
    "Formato (relação de aspeto)": "Format (aspect ratio)",
    "Formato alvo": "Target aspect ratio",
    "16:9": "16:9",
    "16:9 — widescreen": "16:9 — widescreen",
    "16:10": "16:10",
    "4:3": "4:3",
    "4:3 — clássico": "4:3 — classic",
    "21:9": "21:9",
    "21:9 — cinema": "21:9 — cinema",
    "1:1 — quadrado": "1:1 — square",
    "Personalizado": "Custom",
    "Personalizado — tenho a largura e altura em metros": "Custom — I have width and height in meters",
    "Personalizado…": "Custom…",
    "Nenhum / não sei ainda": "None / not sure yet",
    "Nenhum / preencher à mão": "None / fill in by hand",
    "Nenhuma / não sei ainda": "None yet / not sure",
    "Nenhuma — só calcular o ratio necessário": "None — just calculate the needed ratio",
    "Modelo": "Model",
    "Marca": "Brand",
    "Marca do projetor": "Projector brand",
    "Modelo de projetor": "Projector model",
    "Projetor": "Projector",
    "Projetor único": "Single projector",
    "Projetor único ou blend?": "Single projector or blend?",
    "Projetores": "Projectors",
    "Projeção": "Projection",
    "Blend (vários projetores)": "Blend (multiple projectors)",
    "Total de projetores": "Total projectors",
    "Nº de projetores (H x V)": "Number of projectors (H x V)",
    "Nº de projetores (horizontal)": "Number of projectors (horizontal)",
    "Nº de projetores (vertical)": "Number of projectors (vertical)",
    "Calculado automaticamente. Edita para forçar um valor — o nº de projetores horizontal recalcula-se a partir daí.": "Calculated automatically. Edit to force a value — the horizontal projector count recalculates from it.",
    "O mesmo valor para todos os projetores do blend.": "Same value for every projector in the blend.",
    "Resolução": "Resolution",
    "Resolução a usar nos cálculos": "Resolution used in the calculations",
    "Resolução do módulo": "Module resolution",
    "Resolução do projetor": "Projector resolution",
    "Resolução final do canvas (com gaps)": "Final canvas resolution (with gaps)",
    "Resolução horizontal": "Horizontal resolution",
    "Resolução nativa — horizontal": "Native resolution — horizontal",
    "Resolução nativa — vertical": "Native resolution — vertical",
    "Resolução total": "Total resolution",
    "Resolução vertical": "Vertical resolution",
    "Declarada (pixel-shift)": "Declared (pixel-shift)",
    "Nativa (painel/chip)": "Native (panel/chip)",
    "Este modelo atinge a resolução declarada por pixel-shift — o painel/chip nativo é mais baixo. Escolhe qual usar.": "This model reaches its declared resolution via pixel-shift — the native panel/chip is lower. Choose which one to use.",
    "HD (1920×1080)": "HD (1920×1080)",
    "WUXGA (1920×1200)": "WUXGA (1920×1200)",
    "UHD/4K (3840×2160)": "UHD/4K (3840×2160)",
    "Píxeis (horizontal)": "Pixels (horizontal)",
    "Píxeis (vertical)": "Pixels (vertical)",
    "Nº de caixas": "Number of units",
    "Nº de tiles": "Number of tiles",

    // ---- Lentes / throw ratio ----
    "Lente": "Lens",
    "Lente necessária (à distância indicada)": "Lens needed (at the indicated distance)",
    "Modelo de referência": "Reference model",
    "Já sabes a lente? (opcional)": "Already know the lens? (optional)",
    "Da ficha técnica da lente": "From the lens datasheet",
    "Distância até ao ecrã": "Distance to the screen",
    "Distância coberta com a lente escolhida": "Distance covered with the chosen lens",
    "Distância de projeção (com a lente indicada)": "Projection distance (with the indicated lens)",
    "Distância de projeção disponível (lente ao ecrã)": "Available projection distance (lens to screen)",
    "Distância entre a lente e o ecrã": "Distance between the lens and the screen",
    "Medida a partir da lente do projetor — não do centro ou da traseira do corpo do projetor.": "Measured from the projector's lens — not the center or back of the projector body.",
    "Medida a partir da lente do projetor.": "Measured from the projector's lens.",
    "Throw ratio": "Throw ratio",
    "Throw ratio (distância ÷ largura)": "Throw ratio (distance ÷ width)",
    "Throw ratio máximo": "Maximum throw ratio",
    "Throw ratio mínimo": "Minimum throw ratio",
    "Throw ratio necessário": "Required throw ratio",
    "Escolhe a lente pela referência — preenche o throw ratio automaticamente e fica identificada no relatório.": "Choose the lens by its reference — fills in the throw ratio automatically and gets identified in the report.",
    "Escolhe a marca para veres só as lentes compatíveis com esse projetor.": "Choose the brand to see only the lenses compatible with that projector.",
    "Escolhe uma lente pela referência para veres a que distância ela cobre a largura de ecrã indicada acima.": "Choose a lens by its reference to see the distance at which it covers the screen width indicated above.",
    "Sempre que souberes a referência da lente, escolhe-a pelo nome em vez de meter o throw ratio à mão — preenche-se sozinho e fica identificada no relatório.": "Whenever you know the lens reference, pick it by name instead of typing the throw ratio by hand — it fills in on its own and gets identified in the report.",
    "As lentes destacadas a azul na tabela cobrem este ratio.": "The lenses highlighted in blue in the table cover this ratio.",
    "Base de lentes do mercado": "Market lens database",
    "Lentes compatíveis do fabricante do projetor": "Lenses compatible with the projector's manufacturer",
    "Lentes compatíveis na base": "Compatible lenses in the database",
    "Separador informativo — mostra o que existe no mercado em geral, não apenas o que a empresa tem. Para as lentes compatíveis com equipamento próprio, usa o separador": "Informational tab — shows what exists on the market in general, not just what the company owns. For lenses compatible with owned equipment, use the tab",

    // ---- Luminosidade ----
    "Luminosidade": "Brightness",
    "Luminosidade combinada": "Combined brightness",
    "Luminosidade do projetor (100%)": "Projector brightness (100%)",
    "Luminosidade por projetor (100%)": "Brightness per projector (100%)",
    "Luminosidade útil": "Usable brightness",
    "Lux no ecrã": "Lux on screen",
    "Lux no ecrã (somatório)": "Lux on screen (sum)",
    "Útil (80%)": "Usable (80%)",
    "ANSI lumens da ficha técnica.": "ANSI lumens from the datasheet.",
    "Trabalha sempre a 80% da luminosidade nominal (margem para desgaste da lâmpada/laser) — lux = (lumens × 0,8) ÷ área do ecrã.": "Always works at 80% of nominal brightness (margin for lamp/laser wear) — lux = (lumens × 0.8) ÷ screen area.",
    "Trabalha sempre a 80% da luminosidade nominal (um projetor mais gasto obriga os outros a acompanhar) — lux = (lumens × 0,8 × nº total de projetores) ÷ área do ecrã. Assume blending uniforme entre projetores.": "Always works at 80% of nominal brightness (a more worn projector forces the others to match it) — lux = (lumens × 0.8 × total number of projectors) ÷ screen area. Assumes uniform blending between projectors.",

    // ---- Distância de visualização ----
    "Distância da plateia": "Audience distance",
    "Distância de visualização": "Viewing distance",
    "Distância de visualização ideal": "Ideal viewing distance",
    "Distância entre a plateia e o ecrã": "Distance between the audience and the screen",
    "Máxima": "Maximum",
    "Mínima": "Minimum",
    "Regra de distância de visualização": "Viewing distance rule",
    "Standard": "Standard",
    "Standard usado: define-se na aba": "Standard used: set on the",
    "Regra: Espetáculo / entretenimento — concertos, cinema (largura × 1,5–6)": "Rule: Show / entertainment — concerts, cinema (width × 1.5–6)",
    "Espetáculo / entretenimento — concertos, cinema (largura × 1,5–6)": "Show / entertainment — concerts, cinema (width × 1.5–6)",
    "Zona ideal, mais compacta — salas pequenas, reuniões (largura × 1,5–2,5)": "Ideal zone, more compact — small rooms, meetings (width × 1.5–2.5)",
    "O normal — a maioria das apresentações (altura × 6)": "The usual — most presentations (height × 6)",
    "Muito — dados/gráficos densos, decisão analítica (altura × 4)": "A lot — dense data/charts, analytical decision-making (height × 4)",
    "Pouco/nenhum — vídeo, visão passiva (altura × 8)": "Little/none — video, passive viewing (height × 8)",
    "Conteúdo com texto/dados para ler — apresentações, sinalética (AVIXA 4-6-8)": "Content with text/data to read — presentations, signage (AVIXA 4-6-8)",
    "Quanto detalhe o público precisa de ler?": "How much detail does the audience need to read?",
    "Escolhe consoante o tipo de evento e o que o público precisa de ver com nitidez — não precisas de saber os nomes dos standards.": "Choose based on the type of event and what the audience needs to see clearly — you don't need to know the standard names.",
    "Indica o tamanho do ecrã (secção de cima) para saberes a que distância a plateia deve ficar. Mais abaixo, indica a distância disponível para saberes que tamanho de ecrã usar — usa o mesmo formato e standard escolhidos em cima.": "Enter the screen size (top section) to find out how far the audience should sit. Further down, enter the available distance to find out what screen size to use — it uses the same aspect ratio and standard chosen above.",
    "O standard escolhido aqui é também usado pela aba Ecrã LED para calcular a distância de visualização.": "The standard chosen here is also used by the LED Screen tab to calculate viewing distance.",

    // ---- Zonas / ecrã complexo ----
    "✎ Editar": "✎ Edit",
    "Editar zona": "Edit zone",
    "Editar zona — ": "Edit zone — ",
    "Abre a posição, modelo, tamanho e curvatura desta zona num popup próprio": "Opens this zone's position, model, size and curvature in its own popup",
    "Diagrama do conjunto": "Layout diagram",
    "Dimensão do conjunto (com gaps)": "Overall size (with gaps)",
    "Conjunto: 4,10×1,50m — canvas: 1574×576px": "Set: 4.10×1.50m — canvas: 1574×576px",
    "Deslocar X (m)": "Shift X (m)",
    "Nome da zona": "Zone name",
    "Zona": "Zone",
    "Zona 1": "Zone 1",
    "Zona 2": "Zone 2",
    "Medida da zona (m)": "Zone size (m)",
    "Medida do ecrã (m)": "Screen size (m)",
    "Medidas (metros)": "Dimensions (meters)",
    "Posição X (horizontal)": "Position X (horizontal)",
    "Posição Y (vertical)": "Position Y (vertical)",
    "X": "X",
    "Y": "Y",
    "Y (m)": "Y (m)",
    "A posição (": "The position (",
    "= horizontal,": "= horizontal,",
    "= vertical, ambas em metros a partir do canto superior esquerdo do conjunto) desenha o diagrama abaixo à escala e calcula a dimensão total do conjunto já com os gaps entre zonas contemplados. Zonas novas posicionam-se sozinhas ao lado da última, mas a posição é sempre editável à mão — ou arrasta a zona diretamente no desenho para a mover, e usa os campos Posição X/Y para o ajuste fino a seguir. O desenho mostra só o nome de cada zona; o tamanho e o ponto de início/fim em metros ficam na coluna de detalhes ao lado. A lista de cards ordena-se sozinha pela posição (mais à esquerda primeiro) para ser mais fácil encontrar o card certo. Clicar numa zona no desenho (sem arrastar) ou na coluna de detalhes salta logo para o card dela na lista e abre o popup de edição.": "= vertical, both in meters from the top-left corner of the set) draws the diagram below to scale and calculates the total size of the set already accounting for the gaps between zones. New zones position themselves next to the last one, but the position is always editable by hand — or drag the zone directly in the drawing to move it, and use the Position X/Y fields for fine adjustment afterwards. The drawing only shows each zone's name; the size and start/end point in meters are in the details column alongside it. The card list sorts itself by position (leftmost first) to make it easier to find the right card. Clicking a zone in the drawing (without dragging) or in the details column jumps straight to its card in the list and opens the edit popup.",
    "↕ Arrasta uma zona aqui para a mover — os campos Posição X/Y de cada zona ficam para o ajuste fino.": "↕ Drag a zone here to move it — each zone's Position X/Y fields are still there for fine adjustment.",
    "Cópias": "Copies",
    "Gap p/ cópia": "Gap per copy",
    "Direção cópias": "Copy direction",
    "Cor": "Color",
    "Cor desta zona — por omissão as zonas com o mesmo nome-base (ex: \"Lateral\", \"Lateral 2\") partilham cor automática; escolhe aqui para dar uma cor própria só a esta.": "This zone's color — by default zones with the same base name (e.g. \"Lateral\", \"Lateral 2\") share an automatic color; pick here to give just this one its own color.",
    "Repor cor automática (por grupo)": "Reset to automatic color (by group)",
    "auto": "auto",
    "0 selecionadas": "0 selected",
    "Clicar para saltar para esta zona na lista, ou arrastar para mover (os campos Posição X/Y ficam para o ajuste fino)": "Click to jump to this zone in the list, or drag to move it (the Position X/Y fields are still there for fine adjustment)",
    "Zonas incluídas — que ecrã é o quê": "Zones included — which screen is which",
    "Resumo por zona": "Summary per zone",
    "Total combinado": "Combined total",
    "Total de píxeis": "Total pixels",
    "Total de píxeis no ecrã": "Total pixels on screen",
    "Tela combinada (canvas)": "Combined canvas",
    "Peso & energia": "Weight & power",
    "Peso total": "Total weight",
    "Amp total (máx.)": "Total amps (max)",
    "Amp total máx. (por fase)": "Max total amps (per phase)",
    "A/fase": "A/phase",
    "Grelhas sugeridas": "Suggested grids",
    "sugestão de grelha para formato standard": "grid suggestion for a standard aspect ratio",
    "Canvas único em píxeis para importar num media server. Se as zonas tiverem pitches diferentes, a posição/tamanho no canvas é aproximada — usa como referência o pitch da zona com maior área (fica indicado no ficheiro). O \"mapa\" tem legendas com os valores; a \"máscara\" é só preto/branco (uma zona = branco), para usar como matte de conteúdo.": "A single canvas in pixels to import into a media server. If zones have different pixel pitches, the position/size on the canvas is approximate — it uses the pitch of the largest-area zone as reference (noted in the file). The \"map\" has labels with the values; the \"mask\" is just black/white (one zone = white), for use as a content matte.",
    "O total de píxeis fica disponível na aba Projeto para dimensionar switcher/processador de LED (marca \"Usar total das zonas\" lá) — é a soma dos píxeis nativos de cada zona, não o canvas final. A área total também aparece lá — referência interna, não sai no material para o cliente. A \"dimensão do conjunto\" é o retângulo que envolve todas as zonas, já a contar com os gaps entre elas. A \"resolução final do canvas\" é esse mesmo retângulo convertido em píxeis (usando o pitch da zona maior como referência) — é o tamanho real a configurar no media server, incluindo o espaço dos gaps. O amp total é o consumo máximo publicado pelo fabricante de cada tile (pico, não a média em uso real), dividido por 3 fases.": "The total pixel count is available on the Project tab to size the show switcher/LED processor (tick \"Use combined zone total\" there) — it's the sum of each zone's native pixels, not the final canvas. The total area also appears there — internal reference, not shown in client-facing material. The \"overall size\" is the rectangle enclosing all zones, already accounting for the gaps between them. The \"final canvas resolution\" is that same rectangle converted to pixels (using the largest zone's pitch as reference) — it's the actual size to configure on the media server, gaps included. The total amperage is the maximum consumption published by the manufacturer for each tile (peak, not real-world average use), divided across 3 phases.",
    "Valores de amperagem são o consumo máximo publicado pelo fabricante (pico, não a média em uso real) — a margem de segurança correta para dimensionar disjuntores/circuitos. Trifásica: amp por fase = (amp por tile × nº de tiles) ÷ 3.": "Amperage values are the maximum consumption published by the manufacturer (peak, not real-world average use) — the correct safety margin for sizing breakers/circuits. Three-phase: amps per phase = (amps per tile × number of tiles) ÷ 3.",
    "Para abrir espaço a uma zona nova (ex: adicionar um ecrã à esquerda de tudo o resto): marca a caixa": "To make room for a new zone (e.g. add a screen to the left of everything else): tick the",
    "Desmarca a caixa": "Untick the box",
    "nas zonas que já lá estão (ou usa \"Selecionar todas\"), indica quanto deslocar em X/Y no bloco acima da lista e carrega em": "checkbox on the zones already there (or use \"Select all\"), enter how much to shift in X/Y in the block above the list, and press",
    "para criar várias zonas iguais em fila de uma vez. Depois ativa": "to create several identical zones in a row at once. Then enable",
    "numa zona para criar várias cópias iguais em fila de uma vez, com o gap e direção (horizontal/vertical) que definires — o caso direto de várias tiras repetidas. Se depois precisares de mudar o modelo/tamanho dessas cópias, edita só a zona original e usa": "on a zone to create several identical copies in a row at once, with whatever gap and direction (horizontal/vertical) you set — the direct case of several repeated strips. If you later need to change the model/size of those copies, just edit the original zone and use",
    "— aplica a alteração às outras com o mesmo nome-base sem criar novas nem mexer nas posições de cada uma.": "— applies the change to the others with the same base name without creating new ones or touching each one's position.",
    "numa zona para a esconder — sai do diagrama, dos totais e do mapa de píxeis exportado, mas fica guardada (não é apagada). Útil para testar cenários sem uma zona ou para preparar uma zona que ainda não está confirmada.": "on a zone to hide it — it drops out of the diagram, the totals and the exported pixel map, but stays saved (it isn't deleted). Useful for testing scenarios without a zone or preparing a zone that isn't confirmed yet.",
    "— soma esse deslocamento à posição de todas as marcadas de uma vez, sem teres de editar zona a zona.": "— adds that shift to the position of every ticked zone at once, without having to edit zone by zone.",
    "Zonas com o mesmo nome-base (ex: \"Lateral\", \"Lateral 2\", \"Lateral 3\") ficam marcadas automaticamente com a mesma cor no diagrama, no mapa de píxeis exportado e num pontinho junto ao nome de cada zona — só para ajudar a distinguir grupos à vista, não afeta os cálculos.": "Zones with the same base name (e.g. \"Side\", \"Side 2\", \"Side 3\") are automatically marked with the same color in the diagram, in the exported pixel map, and with a small dot next to each zone's name — just to help tell groups apart visually, it doesn't affect the calculations.",
    "As zonas ficam guardadas automaticamente neste aparelho (mesmo que atualizes a página ou feches a app) — não precisas de gravar nada à parte.": "Zones are saved automatically on this device (even if you refresh the page or close the app) — you don't need to save anything separately.",
    "geram um PNG do canvas combinado em píxeis (posição/tamanho reais de cada zona), para levar para um media server — o mapa tem legendas com os valores, a máscara é só preto/branco para usar como matte de conteúdo.": "generate a PNG of the combined canvas in pixels (each zone's real position/size), to bring into a media server — the map has labels with the values, the mask is just black/white for use as a content matte.",
    "Em ecrãs largos (computador), o diagrama fica num card à parte no topo, com a largura toda. O botão": "On wide screens (computer), the diagram sits in its own card at the top, using the full width. The",
    "fica sempre visível fixo no canto — não é preciso descer até ao fim da página com muitas zonas já criadas. Os números (total de tiles, píxeis, peso, etc.) ficam num card próprio ao lado da lista. Para o diagrama ficar mesmo fixo ao scrollar a lista, usa a": "button always stays visible fixed in the corner — no need to scroll to the bottom of the page with many zones already created. The numbers (total tiles, pixels, weight, etc.) sit in their own card next to the list. For the diagram to actually stay fixed while scrolling the list, use the",
    "Em telemóvel/tablet mantém-se a barra fixa condensada em baixo.": "On mobile/tablet the fixed bar stays condensed at the bottom.",
    "ecrã complexo — múltiplas zonas": "multi-zone screen — multiple zones",
    "Para setups com várias secções de LED (ex: central + laterais + tiras espalhadas), possivelmente com pitches diferentes. Adiciona uma zona por secção — cada uma com o seu modelo, nº de tiles e posição.": "For setups with several LED sections (e.g. center + sides + scattered strips), possibly with different pixel pitches. Add one zone per section — each with its own model, tile count and position.",

    // ---- Tiles / LED ----
    "Escolhe o modelo de tile (ou personaliza, incluindo o brilho em nits — se souberes o valor mas não o modelo, a lista filtra-se sozinha para os que correspondem) e o tamanho do ecrã, em nº de tiles ou em metros. Para ecrãs com várias secções diferentes (ex: central + laterais + tiras espalhadas com gaps entre elas), usa a aba": "Choose the tile model (or customize it, including brightness in nits — if you know the value but not the model, the list filters itself down to matching ones) and the screen size, in number of tiles or in meters. For screens with several different sections (e.g. center + sides + scattered strips with gaps between them), use the",
    "Modelo de tile": "Tile model",
    "Tamanho do tile": "Tile size",
    "Largura do módulo": "Module width",
    "Altura do módulo": "Module height",
    "Largura módulo": "Module w.",
    "Altura módulo": "Module h.",
    "Pixel pitch": "Pixel pitch",
    "Pixel size (densidade)": "Pixel size (density)",
    "Brilho": "LED brightness",
    "Brilho do tile": "Tile brightness",
    "Esta é a base de conhecimento que os modelos acima filtra — se não a souberes o valor mas não o modelo, a lista filtra-se sozinha para os que correspondem.": "This is the knowledge base the models above filter through — if you don't know the value but not the model, the list filters itself down to matching ones.",
    "Edita à mão se souberes o valor mas não o modelo — a lista de modelos acima filtra-se para os que correspondem.": "Edit by hand if you know the value but not the model — the model list above filters itself down to matching ones.",
    "O nº de tiles arredonda sempre para cima, para garantir que cobre pelo menos esta medida — o tamanho real fica no resultado. Para modelos com meio-tile disponível (ex: 100×50 + 50×50), a medida é afinada automaticamente com um meio-tile na borda quando isso bate mais certo.": "The tile count always rounds up, to guarantee it covers at least this size — the actual size ends up in the result. For models with a half-tile option available (e.g. 100×50 + 50×50), the size is automatically fine-tuned with a half-tile at the edge when that fits better.",
    "O nº de tiles arredonda sempre para cima, para garantir que cobre pelo menos esta medida.": "The tile count always rounds up, to guarantee it covers at least this size.",
    "Para modelos com meio-tile disponível (ex: 100×50 + 50×50), o modo \"Medida do ecrã (m)\" afina automaticamente a medida final com um meio-tile na borda quando isso bate mais certo que arredondar sempre para o tile inteiro.": "For models with a half-tile option available (e.g. 100×50 + 50×50), the \"Screen size (m)\" mode automatically fine-tunes the final size with a half-tile at the edge when that fits better than always rounding up to a whole tile.",
    "Como queres indicar o tamanho desta zona?": "How do you want to specify this zone's size?",
    "Como queres indicar o tamanho?": "How do you want to specify the size?",
    "Nº de tiles": "Number of tiles",
    "Tiles na horizontal": "Tiles horizontally",
    "Tiles na vertical": "Tiles vertically",
    "Área": "Area",
    "Área total (tiles)": "Total area (tiles)",
    "Área total (uso interno)": "Total area (internal use)",
    "Peso & energia por tile": "Weight & power per tile",
    "Peso por tile": "Weight per tile",
    "Amp máx. por tile": "Max amps per tile",
    "Amp por fase (máx.)": "Amps per phase (max)",
    "Usa o tamanho de módulo (largura/altura definidas acima em \"Tamanho do tile\") para sugerir a grelha de tiles mais próxima deste formato. Os dois campos ajustam-se automaticamente um ao outro.": "Uses the module size (width/height set above in \"Tile size\") to suggest the closest tile grid for this aspect ratio. The two fields adjust to each other automatically.",
    "Junto com o formato acima, calcula a diagonal/altura do ecrã.": "Together with the aspect ratio above, calculates the screen's diagonal/height.",
    "Junto com o formato acima, calcula a diagonal/largura do ecrã.": "Together with the aspect ratio above, calculates the screen's diagonal/width.",
    "Junto com o formato acima, calcula a largura/altura do ecrã.": "Together with the aspect ratio above, calculates the screen's width/height.",

    // ---- Curvatura ----
    "Curvatura": "Curvature",
    "Ecrã curvo": "Curved screen",
    "Zona curva": "Curved zone",
    "Como queres indicar a curvatura?": "How do you want to specify the curvature?",
    "Ângulo por tile": "Angle per tile",
    "Raio desejado": "Desired radius",
    "Corda desejada (espaço a preencher)": "Desired chord (space to fill)",
    "Corda desejada": "Desired chord",
    "Direção": "Direction",
    "Côncavo (para o público)": "Concave (towards the audience)",
    "Convexo (para fora)": "Convex (outwards)",
    "Vista de cima (referência — não afeta o desenho do conjunto nem as contas)": "Top view (reference only — doesn't affect the combined drawing or numbers)",
    "A curvatura é sempre ao longo da horizontal (tiles na horizontal), assumindo hinges/locks que dobram em incrementos fixos entre tiles — cada tile fica reto, o \"arco\" é o conjunto deles em polígono.": "The curvature always runs along the horizontal (tiles horizontally), assuming hinges/locks that bend in fixed increments between tiles — each tile stays flat, the \"arc\" is the set of them forming a polygon.",
    "Raio": "Radius",
    "Ângulo total do arco": "Total arc angle",
    "Largura de corda": "Chord width",
    "Flecha (profundidade)": "Sagitta (depth)",
    "Largura desenvolvida (soma dos tiles)": "Developed width (sum of tiles)",
    "∞ (reto)": "∞ (straight)",
    "Esse raio é fisicamente impossível para esta largura de tile (o tile seria mais largo que o diâmetro) — aumenta o raio ou reduz a largura do tile.": "That radius is physically impossible for this tile width (the tile would be wider than the diameter) — increase the radius or reduce the tile width.",
    "Esse raio é fisicamente impossível para esta largura de tile.": "That radius is physically impossible for this tile width.",
    "esse raio é fisicamente impossível para esta largura de tile.": "that radius is physically impossible for this tile width.",
    "Essa corda não é alcançável com este nº de tiles/largura de tile, mesmo dobrando até meia-volta — aumenta a corda, o nº de tiles ou reduz a largura do tile.": "That chord isn't reachable with this number of tiles/tile width, even bending up to half a turn — increase the chord, the tile count, or reduce the tile width.",
    "Curvatura: essa corda não é alcançável com este nº de tiles/largura de tile, mesmo dobrando até meia-volta.": "Curvature: that chord isn't reachable with this number of tiles/tile width, even bending up to half a turn.",
    "desligada": "off",
    "Ângulo total do arco (": "Total arc angle (",
    "°) passa de 360° — o ecrã dá mais que uma volta completa; confirma os valores.": "°) is over 360° — the screen wraps more than a full circle; check the values.",
    "Curvatura: ": "Curvature: ",
    "°/tile, raio ": "°/tile, radius ",
    ", arco total ": ", total arc ",
    "°, corda ": "°, chord ",
    " m, flecha ": " m, sagitta ",
    "côncavo": "concave",
    "convexo": "convex",

    // ---- Blending ----
    "Sobreposição (overlap)": "Overlap (blending)",
    "Overlap por junção": "Overlap per join",
    "Overlap por junção — horizontal": "Overlap per join — horizontal",
    "Overlap por junção — vertical": "Overlap per join — vertical",
    "Overlap total": "Total overlap",
    "Overlap % do total": "Overlap % of total",
    "Overlap % por projetor": "Overlap % per projector",
    "Como queres definir os projetores?": "How do you want to set up the projectors?",
    "Em Blending, escolhe": "In Blending, choose",
    "para a app decidir o nº de projetores e o overlap sozinha a partir do tamanho desejado, ou": "to let the app decide the number of projectors and the overlap on its own from the desired size, or",
    "para controlares tu mesmo. Tal como em Distância de Projeção, personalizar os lumens filtra a lista de projetores para os que correspondem.": "to control it yourself. Just like in Projection Distance, customizing the lumens filters the projector list down to matching ones.",
    "Até 9 m de altura usa 1 projetor na vertical; acima disso, 2 (mesma regra do separador Blending). O formato desta resolução define a largura de cada projetor.": "Up to 9 m tall uses 1 projector vertically; above that, 2 (same rule as the Blending tab). This resolution's aspect ratio sets each projector's width.",
    "Até 9 m de altura usa 1 projetor na vertical; acima disso, 2. A largura de cada projetor sai da altura de cada fiada × este formato.": "Up to 9 m tall uses 1 projector vertically; above that, 2. Each projector's width comes from each row's height × this aspect ratio.",
    "Serve para juntar vários projetores num ecrã maior do que um único projetor consegue cobrir. Escolhe": "Used to combine several projectors into a screen bigger than a single projector can cover. Choose",
    "para a app decidir o nº de projetores sozinha, ou": "to let the app decide the number of projectors on its own, or",
    "para controlares tu.": "to control it yourself.",
    "Diâmetro do círculo": "Circle diameter",
    "Largura entre as pontas (corda)": "Width between the ends (chord)",
    "Largura da superfície (arco)": "Surface width (arc)",
    "A \"Largura\" acima passa a ser a corda — a distância reta entre as duas pontas do ecrã (o espaço que ocupa no local). Junto com o diâmetro do círculo, dá a largura real da superfície curva (o arco) — é essa que conta para a resolução, nº de projetores e luminosidade, não a corda.": "The \"Width\" field above becomes the chord — the straight-line distance between the screen's two ends (the space it occupies on site). Together with the circle diameter, it gives the real width of the curved surface (the arc) — that's what counts for resolution, number of projectors, and brightness, not the chord.",
    "Essa corda é fisicamente impossível para esse diâmetro (maior que o próprio círculo) — aumenta o diâmetro ou reduz a largura entre as pontas.": "That chord is physically impossible for that diameter (bigger than the circle itself) — increase the diameter or reduce the width between the ends.",
    "Curvatura: corda ": "Curvature: chord ",
    " m, raio ": " m, radius ",
    " m, largura da superfície (arco) ": " m, surface width (arc) ",

    // ---- Sinal & Data Rate ----
    "Sinal de vídeo": "Video signal",
    "Resultado": "Result",
    "Switcher & processo de LED": "Switcher & LED processing",
    "Switchers de show — capacidade e ligações a usar": "Show switchers — capacity and connections to use",
    "Opções de switcher de show (cobrem o total)": "Show switcher options (cover the total)",
    "Processo de LED — portas a usar": "LED processing — ports to use",
    "Opções de processo de LED (só o ecrã LED, a este refresh/cor)": "LED processing options (LED screen only, at this refresh/color)",
    "Modo avançado (configurações por confirmar — unidades ligadas, placas alternativas não montadas)": "Advanced mode (configurations to confirm — linked units, alternate cards not fitted)",
    "Tenho um pré-switch antes do switcher principal (ex: para juntar/selecionar só algumas fontes antes de entrarem no switcher principal)": "I have a pre-switch before the main switcher (e.g. to combine/select only some sources before they reach the main switcher)",
    "Resolução horizontal (pré-switch)": "Horizontal resolution (pre-switch)",
    "Resolução vertical (pré-switch)": "Vertical resolution (pre-switch)",
    "Só a resolução que passa pelo pré-switch (ex: as fontes que ele seleciona/junta antes do switcher principal), não o total do ecrã final.": "Only the resolution that goes through the pre-switch (e.g. the sources it selects/combines before the main switcher), not the final screen's total.",
    "Marca aqui o(s) mesmo(s) processo(s) de LED já escolhido(s) na aba Sinal & Data Rate": "Tick here the same LED processing option(s) already chosen on the Signal & Data Rate tab",
    "Marca aqui o(s) mesmo(s) switcher(s) já escolhido(s) na aba Sinal & Data Rate": "Tick here the same switcher(s) already chosen on the Signal & Data Rate tab",
    "Tile de referência (para contar em tiles, não só píxeis)": "Reference tile (to count in tiles, not just pixels)",
    "Preenche com o modelo de tile configurado na aba Projeto": "Fills in with the tile model configured on the Project tab",
    "Junta o sinal, o(s) switcher(s) e o processo de LED escolhidos acima num texto só, pronto a copiar para a ficha técnica.": "Combines the signal, switcher(s) and LED processing chosen above into a single text, ready to copy into the spec sheet.",
    "Resumo do setup": "Setup summary",
    "Frame rate": "Frame rate",
    "Refresh rate": "Refresh rate",
    "Profundidade de cor": "Color depth",
    "8-bit": "8-bit",
    "10-bit": "10-bit",
    "12-bit": "12-bit",
    "8-bit por canal": "8-bit per channel",
    "10-bit por canal": "10-bit per channel",
    "12-bit por canal": "12-bit per channel",
    "Amostragem de cor (chroma sampling)": "Color sampling (chroma subsampling)",
    "RGB / YCbCr 4:4:4 (3 amostras/píxel)": "RGB / YCbCr 4:4:4 (3 samples/pixel)",
    "YCbCr 4:2:2 (2 amostras/píxel)": "YCbCr 4:2:2 (2 samples/pixel)",
    "YCbCr 4:2:0 (1,5 amostras/píxel)": "YCbCr 4:2:0 (1.5 samples/pixel)",
    "Data rate (ativo)": "Data rate (active)",
    "Pixel clock (com blanking, CVT-RB2)": "Pixel clock (with blanking, CVT-RB2)",
    "Ligação mínima recomendada": "Minimum recommended connection",
    "Pixel clock calculado com blanking real (VESA CVT-RB2), não uma percentagem fixa — não muda com a amostragem de cor, só o data rate muda. A ligação mínima recomendada abaixo é baseada só no pixel clock (timing); confirma sempre também se o link aguenta o data rate a RGB/YCbCr 4:4:4.": "Pixel clock calculated with real blanking (VESA CVT-RB2), not a fixed percentage — it doesn't change with color sampling, only the data rate does. The minimum recommended connection below is based only on the pixel clock (timing); always also confirm the link can handle the data rate at RGB/YCbCr 4:4:4.",
    "DisplayPort não define um limite único de pixel clock (é um link empacotado) — a 24,0bpp (8-bit RGB/YCbCr 4:4:4), o máximo teórico é ≈360MHz em DP1.1a, ≈720MHz em DP1.2, ≈1080MHz em DP1.4 (valores derivados do débito, não publicados pela VESA em MHz).": "DisplayPort doesn't define a single pixel clock limit (it's a packetized link) — at 24.0bpp (8-bit RGB/YCbCr 4:4:4), the theoretical maximum is ≈360MHz on DP1.1a, ≈720MHz on DP1.2, ≈1080MHz on DP1.4 (values derived from throughput, not published by VESA in MHz).",
    "DSM e delay somam ao total de píxeis para escolher o switcher de show. Só o ecrã LED entra na conta dos processadores de LED.": "DSM and delay screens add to the total pixel count for choosing the show switcher. Only the LED screen counts toward the LED processor calculation.",
    "Em baixo também mostra, para o total de píxeis acima: quantos switchers de show da casa aguentam esse total (capacidade em megapíxeis, não só o pixel clock de um único sinal) e, se for para um ecrã LED, quantas unidades e exatamente quantas portas de cada processo de LED seriam precisas — a mesma conta usada na aba Projeto.": "Below it also shows, for the total pixel count above: how many of the company's show switchers can handle that total (capacity in megapixels, not just a single signal's pixel clock), and, if it's for an LED screen, how many units and exactly how many ports of each LED processor would be needed — the same math used on the Project tab.",
    "Indica a resolução, frame rate e profundidade de cor do sinal de vídeo para saberes o data rate e a ligação mínima (HDMI/DisplayPort/SDI) necessária, e que switchers ou processadores aguentam esse sinal na entrada.": "Enter the video signal's resolution, frame rate and color depth to find out the data rate and the minimum connection (HDMI/DisplayPort/SDI) needed, and which switchers or processors can take that signal as an input.",
    "Os três blocos abaixo (Sinal de vídeo, Resultado, Switchers disponíveis e ligações a usar) abrem/fecham ao clicar no título — fecha o que não precisares para ver a página toda de relance.": "The three blocks below (Video signal, Result, Available switchers and connections to use) open/close by clicking their title — close whichever you don't need to see the whole page at a glance.",

    // ---- Media Server ----
    "Necessidade": "Requirement",
    "Necessidade de saída": "Output requirement",
    "Media servers compatíveis": "Compatible media servers",
    "Indica a resolução total de saída necessária (o canvas final, já com todos os ecrãs/zonas combinados) e o frame rate — a lista mostra os media servers cuja capacidade de saída cobre esse total.": "Enter the total output resolution needed (the final canvas, with all screens/zones already combined) and the frame rate — the list shows the media servers whose output capacity covers that total.",
    "Preenche a resolução acima com a da aba Sinal & Data Rate": "Fills in the resolution above with the one from the Signal & Data Rate tab",
    "Preenche a resolução acima com o canvas final (com gaps) da aba Ecrã Complexo": "Fills in the resolution above with the final canvas (with gaps) from the Multi-Zone Screen tab",
    "Preenche a resolução acima com o ecrã atual da aba Projeto": "Fills in the resolution above with the current screen from the Project tab",
    "Preenche a resolução acima com a da aba Media Server": "Fills in the resolution above with the one from the Media Server tab",
    "↙ Media Server": "↙ Media Server",

    // ---- Projeto ----
    "Como criar um projeto": "How to create a project",
    "Como navegar": "How to navigate",
    "Como usar esta calculadora": "How to use this calculator",
    "Itens do projeto": "Project items",
    "Checklist do projeto": "Project checklist",
    "Texto combinado": "Combined text",
    "Nome do projeto": "Project name",
    "Data de início": "Start date",
    "Data de fim": "End date",
    "Opcional — fica registada no relatório. Útil já agora para referência; mais tarde vai servir para cruzar disponibilidade de equipamento entre projetos.": "Optional — it gets recorded in the report. Already useful now for reference; later it'll help cross-check equipment availability between projects.",
    "Tipo de projeto": "Project type",
    "Misto": "Mixed",
    "Misto (Ecrã LED + Projeção)": "Mixed (LED Screen + Projection)",
    "Ecrã LED + Projeção": "LED Screen + Projection",
    "Ecrã LED (múltiplas zonas)": "LED Screen (multiple zones)",
    "Ecrã LED": "LED Screen",
    "ecrã led + projeção": "led screen + projection",
    "ecrã led (múltiplas zonas)": "led screen (multiple zones)",
    "ecrã led": "led screen",
    "ecrã (projeção)": "screen (projection)",
    "ecrã (blend)": "screen (blend)",
    "Distância disponível (por projetor)": "Available distance (per projector)",
    "Distância disponível": "Available distance",
    "Um projeto misto mostra os dois tipos de ecrã ao mesmo tempo e soma os píxeis dos dois para o switcher de show — as portas de processo de LED continuam a contar só o ecrã LED.": "A mixed project shows both screen types at once and adds up both pixel counts for the show switcher — LED processor ports still only count the LED screen.",
    "(por preencher)": "(to be filled in)",
    "Total de píxeis (LED + projeção): ": "Total pixels (LED + projection): ",
    "— ECRÃ LED —": "— LED SCREEN —",
    "— PROJEÇÃO —": "— PROJECTION —",
    "Relatório": "Report",
    "Relatório completo": "Full report",
    "Resumo do projeto": "Project summary",
    "Resumo para ficha técnica": "Summary for spec sheet",
    "Todos os valores são para conferência antes de enviar ao cliente — a app não substitui medir no local.": "All values are for review before sending to the client — the app doesn't replace measuring on site.",
    "Junta tudo numa ficha técnica única para um evento. Podes preencher os campos aqui à mão, ou marcar": "Puts everything together into a single spec sheet for an event. You can fill in the fields here by hand, or tick",
    "nas calculadoras de Distância de Projeção, Ecrã LED ou Blending para os campos correspondentes virem preenchidos sozinhos — marcar uma dessas três desliga automaticamente as outras, porque um projeto só tem um tipo de ecrã de cada vez.": "on the Projection Distance, LED Screen or Blending calculators so the corresponding fields fill in on their own — ticking one of those three automatically switches off the others, since a project only has one screen type at a time.",
    "Marca \"Adicionar ao projeto\" no resumo de Distância de Projeção, Ecrã LED ou Blending para preencher automaticamente os campos correspondentes abaixo — não precisas de copiar nada à mão, e o relatório do projeto não repete o que essa calculadora já mostra. Distância de Visualização e Sinal & Data Rate (sem \"tipo de ecrã\" próprio aqui) ficam registados nesta checklist, à parte.": "Tick \"Add to project\" on the Projection Distance, LED Screen or Blending summary to automatically fill in the corresponding fields below — you don't need to copy anything by hand, and the project report doesn't repeat what that calculator already shows. Viewing Distance and Signal & Data Rate (with no \"screen type\" of their own here) get logged in this checklist, separately.",
    "Marca a(s) opção(ões) escolhida(s) para o relatório sair limpo — sem marcar nenhuma, entram todas as compatíveis.": "Tick the chosen option(s) so the report comes out clean — with none ticked, every compatible one is included.",
    "Opção 1 — direto na aba Projeto": "Option 1 — directly on the Project tab",
    "Opção 2 — partir das calculadoras": "Option 2 — starting from the calculators",
    "e preenche lá os campos (tipo de ecrã, projetor ou tile, tamanho, processamento). É mais rápido quando já sabes os números de cor.": "and fill in the fields there (screen type, projector or tile, size, processing). It's faster when you already know the numbers by heart.",
    "para calcular essa parte com calma. Quando estiveres satisfeito, marca": "to work out that part calmly. Once you're happy with it, tick",
    "Quando estiveres satisfeito com o resultado, marca": "Once you're happy with the result, tick",
    "no resumo para levar esta configuração para a aba Projeto.": "on the summary to bring this setup into the Project tab.",
    "no resumo para levar este ecrã para a aba Projeto.": "on the summary to bring this screen into the Project tab.",
    "no resumo para levar o total das zonas para a aba Projeto (equivale a ativar lá \"Usar total das zonas\").": "on the summary to bring the zone total into the Project tab (same as enabling \"Use combined zone total\" there).",
    "no resumo — os valores passam sozinhos para a aba Projeto.": "on the summary — the values carry over to the Project tab on their own.",
    "no resumo — os valores passam sozinhos para os campos da aba Projeto, não precisas de copiar nada à mão. Marcar uma destas três desliga automaticamente as outras, porque um projeto só tem um tipo de ecrã de cada vez.": "on the summary — the values carry over to the Project tab's fields on their own, you don't need to copy anything by hand. Ticking one of these three automatically switches off the others, since a project only has one screen type at a time.",
    "não tem campos próprios no projeto (o standard usado é geral, não é por projeto) — marcar \"Adicionar ao projeto\" aí só deixa uma nota de referência no topo da aba Projeto.": "has no fields of its own in the project (the standard used is general, not per-project) — ticking \"Add to project\" there just leaves a reference note at the top of the Project tab.",
    "e continuar de onde ficaste.": "and pick up where you left off.",
    "Usa": "Uses",
    "Usa a": "Use the",
    "para enviar a ficha técnica, e": "to send the spec sheet, and",
    "para gravar um ficheiro que podes reabrir depois com": "to save a file you can reopen later with",
    "para gravar um ficheiro que podes reabrir mais tarde com": "to save a file you can reopen afterwards with",
    "Cada aba no topo é uma calculadora independente — muda entre elas a qualquer momento sem perder o que já preencheste. No telemóvel, desliza a barra de abas para o lado para ver todas.": "Each tab at the top is an independent calculator — switch between them at any time without losing what you've already filled in. On mobile, swipe the tab bar sideways to see them all.",
    "Há duas formas — usa a que fizer mais sentido para o que estás a fazer:": "There are two ways — use whichever makes more sense for what you're doing:",
    "Usa os atalhos \"Usar resolução de\" para preencher automaticamente a partir de outra aba já calculada, em vez de copiar à mão.": "Use the \"Use resolution from\" shortcuts to fill in automatically from another already-calculated tab, instead of copying by hand.",
    "para preencher a resolução acima com o canvas final já calculado nessas abas, em vez de a escreveres à mão — útil para veres já a ligação mínima e os switchers/processadores compatíveis para o ecrã real do projeto.": "to fill in the resolution above with the final canvas already calculated on those tabs, instead of typing it by hand — useful to already see the minimum connection and the compatible switchers/processors for the project's actual screen.",
    "Na aba Projeto podes ainda somar ecrãs DSM/delay e escolher os switchers de show compatíveis. Usa": "On the Project tab you can also add DSM/delay screens and choose compatible show switchers. Use",
    "na aba Projeto para somar tudo.": "on the Project tab to add it all up.",
    "Ecrã LED com várias secções (ex: central + laterais + tiras espalhadas): usa a aba": "LED screen with several sections (e.g. center + sides + scattered strips): use the",
    "Queres saber que tamanho de ecrã é ideal para uma distância de visualização específica (em vez do throw ratio do projetor)? Usa a aba": "Want to know what screen size is ideal for a specific viewing distance (instead of the projector's throw ratio)? Use the",
    "disponível, mostra as lentes que a cobrem; se souberes a": "available, it shows the lenses that cover it; if you know the",
    "distância": "distance",
    "ou calcular a partir da distância disponível": "or calculate from the available distance",
    "Para esta largura de ecrã": "For this screen width",
    "Ecrãs DSM (monitores de palco)": "DSM screens (stage monitors)",
    "Ecrãs delay (repetidores para salas/espaços maiores)": "Delay screens (repeaters for larger rooms/spaces)",
    "Modelo de TV": "TV model",
    "Modelo de TV (atalho, opcional)": "TV model (shortcut, optional)",
    "Modelo de TV para os DSM (opcional)": "TV model for DSM screens (optional)",
    "Modelo de TV para os delay (opcional)": "TV model for delay screens (optional)",
    "Resolução de cada DSM": "Resolution of each DSM screen",
    "Resolução de cada delay": "Resolution of each delay screen",
    "Resolução de cada projetor": "Resolution of each projector",
    "Processamento": "Processing",
    "Pixel usage total (ecrã + DSM + delay)": "Total pixel usage (screen + DSM + delay)",
    "Vai à aba": "Go to the",

    // ---- TVs / Lentes tab extras ----
    "Escolhe um modelo de TV do inventário da AVK (ou personaliza a diagonal) para saberes o tamanho do ecrã e a distância de visualização ideal. Nem todos os modelos têm a resolução confirmada — quando não tiver, ajusta à mão se precisares para o relatório.": "Choose a TV model from the AVK inventory (or customize the diagonal) to find out the screen size and the ideal viewing distance. Not every model has a confirmed resolution — when it doesn't, adjust it by hand if you need to for the report.",
    "Escolhe um modelo do inventário da AVK para preencher o formato e a diagonal abaixo.": "Choose a model from the AVK inventory to fill in the aspect ratio and diagonal below.",
    "Estes modelos também ficam disponíveis para escolher nos ecrãs DSM/delay da aba Projeto, e como atalho na aba Distância de Visualização.": "These models are also available to choose from on the Project tab's DSM/delay screens, and as a shortcut on the Viewing Distance tab.",
    "Inventário da AVK — escolher preenche a diagonal (e a resolução, quando confirmada) abaixo.": "AVK inventory — choosing one fills in the diagonal (and the resolution, when confirmed) below.",
    "Inventário da AVK — preenche a resolução quando confirmada; se não tiver, ajusta à mão abaixo.": "AVK inventory — fills in the resolution when confirmed; if it doesn't have one, adjust it by hand below.",
    "não confirmada": "not confirmed",

    // ---- Grafismo px↔cm ----
    "Introduz a resolução do ecrã (largura × altura em píxeis) e o DPI/PPI do ecrã. Se não souberes o DPI, preenche a diagonal em polegadas e a app calcula-o automaticamente.": "Enter the screen's resolution (width × height in pixels) and its DPI/PPI. If you don't know the DPI, fill in the diagonal in inches and the app calculates it automatically.",
    "O resultado dá-te o tamanho físico real do ecrã em centímetros e polegadas, e as referências de conversão para criares apresentações e grafismos à medida exata desse ecrã.": "The result gives you the screen's real physical size in centimeters and inches, and the conversion references to build presentations and graphics at that screen's exact size.",
    "Ecrã & DPI": "Screen & DPI",
    "Largura (px)": "Width (px)",
    "Altura (px)": "Height (px)",
    "(opcional — preenche para calcular DPI)": "(optional — fill in to calculate DPI)",
    "DPI / PPI": "DPI / PPI",
    "Tamanho do slide": "Slide size",
    "Tamanho físico (DPI configurado acima)": "Physical size (DPI configured above)",
    "Referências de conversão": "Conversion references",
    "1 cm =": "1 cm =",
    "1 in =": "1 in =",
    "1 px =": "1 px =",
    "Conversor rápido": "Quick converter",
    "Centímetros → píxeis": "Centimeters → pixels",
    "Píxeis → centímetros": "Pixels → centimeters",
    "Resumo para grafismo": "Summary for graphics",
    "DPI calculado a partir da diagonal e da resolução.": "DPI calculated from the diagonal and the resolution.",
    " — referência física para criação de grafismo: dada a resolução e o DPI do ecrã, converte píxeis ↔ centímetros para criar apresentações e layouts à medida real do ecrã.": " — physical reference for graphics work: given the screen's resolution and DPI, converts pixels ↔ centimeters to build presentations and layouts at the screen's real size.",
    "Tamanho físico: ": "Physical size: ",
    " DPI\n": " DPI\n",
    "polegadas": "inches",
    "Se o tamanho físico ultrapassar o limite máximo de slide personalizado do PowerPoint (56×56 polegadas / 142,2×142,2 cm), aparece um aviso — nesse caso é preciso reduzir a escala ou dividir o grafismo em várias peças.": "If the physical size exceeds PowerPoint's maximum custom slide size (56×56 inches / 142.2×142.2 cm), a warning appears — in that case you'll need to reduce the scale or split the graphic into multiple pieces.",
    "⚠ Este tamanho ultrapassa o limite máximo de slide personalizado do PowerPoint (": "⚠ This size exceeds PowerPoint's maximum custom slide size (",
    " in / ": " in / ",
    " cm) — vais precisar de reduzir a escala do grafismo ou dividi-lo em várias peças.": " cm) — you'll need to reduce the graphic's scale or split it into multiple pieces.",
    "Fonte: Microsoft Support": "Source: Microsoft Support",
    "Tamanho a definir no PowerPoint (96 DPI fixo): ": "Size to set in PowerPoint (fixed 96 DPI): ",
    "Tamanho a definir no PowerPoint": "Size to set in PowerPoint",
    "O PowerPoint usa sempre 96 DPI fixo para converter resolução (px) ↔ polegadas nos slides e na exportação de imagem — independentemente do DPI real do ecrã acima. É este o valor a escrever no tamanho do slide para exportares exatamente esta resolução. ": "PowerPoint always uses a fixed 96 DPI to convert resolution (px) ↔ inches in slides and when exporting as an image — regardless of the screen's real DPI above. This is the value to enter as the slide size to export exactly this resolution. ",
    "Fonte: Microsoft Learn ↗": "Source: Microsoft Learn ↗",
    "⚠ O tamanho a definir no PowerPoint (a 96 DPI fixo — ": "⚠ The size to set in PowerPoint (at fixed 96 DPI — ",
    " in) também ultrapassa esse limite.": " in) also exceeds that limit.",

    "Modelo de tile": "Tile model",
    "Escolhe o projetor (ou personaliza os lumens — se souberes o light output mas não o modelo, a lista filtra-se sozinha para os que correspondem) e o tamanho do ecrã. A app calcula os dois sentidos ao mesmo tempo: se souberes a": "Choose the projector (or customize the lumens — if you know the light output but not the model, the list filters itself down to matching ones) and the screen size. The app calculates both directions at once: if you know the",
    "Indica a distância até ao ecrã e a largura desejada para veres o throw ratio necessário — as lentes destacadas na tabela em baixo cobrem esse ratio. Se já souberes a lente, escolhe-a para veres a que distância ela cobre essa largura.": "Enter the distance to the screen and the desired width to see the required throw ratio — the lenses highlighted in the table below cover that ratio. If you already know the lens, choose it to see the distance at which it covers that width.",

    // ---- Rácio blend ----
    "Rácio — altura": "Ratio — height",
    "Rácio — largura": "Ratio — width",
    "Diagonal aproximada": "Approximate diagonal",

    // ---- Ajuda / índice ----
    "Dicas rápidas": "Quick tips",
    "— dado um projetor e um ecrã, diz que lente/distância precisas (ou o inverso).": "— given a projector and a screen, tells you which lens/distance you need (or the reverse).",
    "— junta vários projetores num ecrã maior, com overlap.": "— combines several projectors into a bigger screen, with overlap.",
    "— tamanho de ecrã ideal consoante a distância da plateia (e vice-versa).": "— ideal screen size based on the audience distance (and vice versa).",
    "— resolução, tamanho físico, peso e amperagem de um único ecrã LED.": "— resolution, physical size, weight and amperage for a single LED screen.",
    "— o mesmo, mas para setups com várias secções (central + laterais + tiras), cada uma com posição, para ver o diagrama à escala e a dimensão total já com os gaps contemplados.": "— the same, but for setups with several sections (center + sides + strips), each with its own position, to see the diagram to scale and the total size with the gaps already accounted for.",
    "— largura de banda e ligação mínima para um sinal de vídeo.": "— bandwidth and minimum connection for a video signal.",
    "— consulta as lentes do mercado e o que cada uma cobre.": "— browse market lenses and what each one covers.",
    "— junta tudo numa ficha técnica única para um evento.": "— puts everything together into a single spec sheet for an event.",
    "— lista de TVs/monitores da empresa com diagonal, resolução (quando confirmada) e distância de visualização ideal; serve também de atalho para preencher DSM/delay na aba Projeto.": "— list of the company's TVs/monitors with diagonal, resolution (when confirmed) and ideal viewing distance; also serves as a shortcut to fill in DSM/delay screens on the Project tab.",
    "nos menus é o que a empresa já tem — prioriza sempre que der.": "in the menus is what the company already owns — always prioritize it when possible.",
    "Não é equipamento da AVK — mostrado só como referência de mercado": "Not AVK equipment — shown only as a market reference",
    "Capacidade estimada, não é um teto de hardware fixo publicado pelo fabricante — depende da configuração real (ex: GPU da máquina). Ver nota.": "Estimated capacity, not a fixed hardware ceiling published by the manufacturer — it depends on the actual configuration (e.g. the machine's GPU). See note.",

    // ---- Zonas — títulos avançados ----
    "Aplica o modelo/tamanho desta zona às outras zonas com o mesmo nome-base (ex: \"Lateral 2\", \"Lateral 3\"), sem criar novas nem mexer nas posições delas": "Applies this zone's model/size to the other zones with the same base name (e.g. \"Side 2\", \"Side 3\"), without creating new ones or touching their positions",
    "Cria o nº de zonas indicado em Cópias, iguais a esta, em fila com o gap e direção indicados": "Creates the number of zones set in Copies, identical to this one, in a row with the given gap and direction",
    "Incluir esta zona no desenho, nas contas do conjunto e nos PNG exportados — desmarca para a esconder sem apagar": "Include this zone in the drawing, the set's totals and the exported PNGs — untick to hide it without deleting it",
    "Limpar seleção": "Clear selection",
    "Selecionar esta zona para mover em bloco": "Select this zone to move it as a block",
    "Selecionar todas": "Select all",
    "Soma o deslocamento X/Y às zonas com a caixa 'Sel.' marcada — útil para abrir espaço para uma zona nova": "Adds the X/Y shift to the zones with the 'Sel.' box ticked — useful to make room for a new zone",
    "Usar o pitch desta zona como referência do canvas combinado (posições/tamanhos das outras zonas convertidos para este pitch). Sem nenhuma marcada, usa-se a zona mais alta (m) — que pode mudar sozinha ao adicionar/remover zonas.": "Use this zone's pixel pitch as the reference for the combined canvas (other zones' positions/sizes converted to this pitch). With none ticked, the tallest zone (m) is used — which can change on its own when adding/removing zones.",

    // ---- Fonte / dados ----
    "Fonte": "Source",

    // ---- Calculadora simples (js/calc-widget.js) ----
    "Calculadora": "Calculator",
    "Fechar": "Close",
    "Aplicar": "Apply",
    "Calculadora — soma, subtrai, multiplica ou divide e aplica o resultado aqui": "Calculator — add, subtract, multiply or divide and apply the result here",

    // ---- Resolução declarada/nativa (usado nos resumos gerados) ----
    " (nativo)": " (native)",
    " (declarado — pixel-shift)": " (declared — pixel-shift)",
    "painel nativo": "native panel",
    "chip nativo": "native chip",

    // ---- projectors.json — resolucaoNota (únicas) ----
    "4K nativo (sem pixel-shift)": "Native 4K (no pixel-shift)",
    "4K nativo (sem pixel-shift); 44 500 lm ANSI (50 000 lm ISO, valor de marketing)": "Native 4K (no pixel-shift); 44,500 ANSI lm (50,000 ISO lm, marketing figure)",
    "4K nativo, projetor de cinema digital (DCI); 47 000 lm ANSI com lente HB, 35 000 lm com lente UHC": "Native 4K, digital cinema projector (DCI); 47,000 ANSI lm with HB lens, 35,000 lm with UHC lens",
    "4K via pixel-shift; painel nativo 1920×1080": "4K via pixel-shift; native panel 1920×1080",
    "4K+ via pixel-shift; chip nativo 2560×1600": "4K+ via pixel-shift; native chip 2560×1600",
    "\"4K UHD\" (16:10) via pixel-shift; DMD nativo 2560×1600": "\"4K UHD\" (16:10) via pixel-shift; native DMD 2560×1600",
    "DLP single-chip": "Single-chip DLP",
    "DLP single-chip, SXGA+ nativo": "Single-chip DLP, native SXGA+",
    "HD+ nativo (não é 1920×1080)": "Native HD+ (not 1920×1080)",
    "Modelo exato da série CP-AW não confirmado na folha de inventário; resolução válida para toda a série": "Exact CP-AW series model not confirmed in the inventory sheet; resolution valid for the whole series",
    "\"4K Ready\" só aceita sinal 4K de entrada, não gera saída 4K": "\"4K Ready\" only accepts a 4K input signal, it doesn't produce 4K output",
    "Folha de inventário indica \"PLC-XV100\", modelo provavelmente inexistente — assumido PLC-XU100 (lumens coincidem exatamente)": "Inventory sheet lists \"PLC-XV100\", a model that likely doesn't exist — assumed PLC-XU100 (lumens match exactly)",

    // ---- Frases adicionais encontradas na verificação final ----
    "Usa o standard escolhido acima e o mesmo formato de ecrã.": "Uses the standard chosen above and the same screen aspect ratio.",
    "Valores de fichas técnicas públicas — confirma sempre com o fabricante antes de produção. O modelo escolhido preenche tamanho, resolução, peso e amp abaixo (podes ajustar à mão).": "Values from public datasheets — always confirm with the manufacturer before production. The chosen model fills in size, resolution, weight and amps below (you can adjust by hand).",
    "Em blend, o tamanho é sempre em metros (largura x altura livres) — igual ao separador Blending. Um ecrã no mesmo formato do projetor cabe sempre num só projetor, seja qual for o tamanho.": "In blend, the size is always in meters (free width x height) — same as the Blending tab. A screen in the same aspect ratio as the projector always fits in a single projector, whatever the size.",
    "Opções de switcher de show (cobrem o total)": "Show switcher options (cover the total)",
    "Os três blocos abaixo (Sinal de vídeo, Resultado, Switchers disponíveis e ligações a usar) abrem/fecham ao clicar no título — fecha o que não precisares para ver a página toda de relance.": "The three blocks below (Video signal, Result, Available switchers and connections to use) open/close by clicking their title — close whichever you don't need to see the whole page at a glance.",
    "Ecrã LED com várias secções (ex: central + laterais + tiras espalhadas): usa a aba": "LED screen with several sections (e.g. center + sides + scattered strips): use the",
    "adiciona uma zona por secção com a sua posição X/Y para ver o diagrama e a dimensão total com gaps, e usa": "add one zone per section with its X/Y position to see the diagram and the overall size with gaps, and use",
  };

  // ---- Fragmentos recorrentes do catálogo (specs de equipamento) — cobrem
  // centenas de entradas de marca/modelo com poucas dezenas de chaves. ----
  var CATALOG_EN = {
    "(stock)": "(owned)",
    "(mercado)": "(market)",
    " fixo": " fixed",
    "(fixo)": "(fixed)",
    "antigo, lâmpada": "older, lamp",
    "laser": "laser",
    "lente fixa integrada": "integrated fixed lens",
    "lente fixa": "fixed lens",
    "ultra short throw": "ultra short throw",
    "curvo, sob consulta": "curved, on request",
    "sob consulta": "on request",
    "não curva": "not curved",
    "outdoor": "outdoor",
    "indoor": "indoor",
    "touchscreen": "touchscreen",
    "confirmado no inventário interno": "confirmed in internal inventory",
    "consumo/voltagem não confirmados": "power draw/voltage not confirmed",
    "marca sem ficha técnica acessível": "brand with no accessible datasheet",
    "peso não disponível": "weight not available",
    "peso/amp não disponíveis": "weight/amps not available",
    "amp estimado (dobro do módulo 50×50)": "estimated amps (double the 50×50 module)",
    "cabinet duplo": "double cabinet",
    "tiles/caixa": "tiles/unit",
    "cx vermelha": "red box",
    "cx verde": "green box",
    "variante": "variant",
    "série exata": "exact series",
    "não confirmada, valor herdado": "not confirmed, legacy value",
    "valor herdado": "legacy value",
    "também pista de LED": "also an LED strip",
    "linha transparente distinta da Traulux": "transparent line distinct from Traulux",
    "fonte com valores conflituosos": "source with conflicting values",
    "usado o menor": "used the lower value",
    "fonte oficial": "official source",
    "ficha oficial": "official datasheet",
    "existe no grupo AVK": "exists within the AVK group",
    "grupo Euro Algarve": "Euro Algarve group",
    "grupo Global Espanha": "Global Espanha group",
    "no lote": "in the batch",
    "módulos": "modules",
    "módulo": "module",
    "totem publicitário, não é marca": "advertising totem, not a brand",
    "transp.": "transp.",
    "consumo não confirmado (ficha da INFiLED não acessível)": "power draw not confirmed (INFiLED datasheet not accessible)",
    "módulo curvável": "curvable module",
    "módulo suspenso": "suspended module",
    "revisão": "revision",
    "painel Sapphire SP1.5 real da ROE não é 500×500mm, é 494,4×278,1mm (formato 16:9); confirmar se é este o modelo certo antes de usar": "ROE's actual Sapphire SP1.5 panel isn't 500×500mm, it's 494.4×278.1mm (16:9 aspect ratio); confirm this is the right model before using it",
  };

  // Junta os dois dicionários — o do catálogo entra primeiro para dar
  // prioridade a frases mais compridas quando há sobreposição.
  Object.keys(CATALOG_EN).forEach(function (k) { DICT_EN[k] = CATALOG_EN[k]; });

  // Rótulos fixos usados dentro dos blocos de resumo (".sumbox"), gerados em
  // JS por concatenação de string — não são nós de texto isolados, por isso
  // a tradução por substring (em vez de nó-a-nó) é essencial aqui.
  var SUMMARY_EN = {
    "Ecrã: ": "Screen: ",
    "Standard: ": "Standard: ",
    "Distância de visualização ideal: ": "Ideal viewing distance: ",
    "Resolução do projetor: ": "Projector resolution: ",
    "Distância disponível indicada: ": "Indicated available distance: ",
    "Throw ratio necessário a essa distância: ": "Throw ratio required at that distance: ",
    "Lentes compatíveis a essa distância": "Compatible lenses at that distance",
    " — melhor: ": " — best: ",
    "Luminosidade: ": "Brightness: ",
    "lumens úteis": "usable lumens",
    "lux no ecrã": "lux on screen",
    "Blending: ": "Blending: ",
    "projetores": "projectors",
    " cada)": " each)",
    " mm cada, ": " mm each, ",
    "  —  formato ": "  —  aspect ratio ",
    "Overlap: ": "Overlap: ",
    "horizontal, ": "horizontal, ",
    "vertical": "vertical",
    "Resolução combinada: ": "Combined resolution: ",
    " do total": " of total",
    " por projetor": " per projector",
    "Ecrã físico: ": "Physical screen: ",
    "Pixel size: ": "Pixel size: ",
    "Luminosidade: 2 projetores x ": "Brightness: 2 projectors x ",
    " a 80%: ": " at 80%: ",
    "Ecrã LED: ": "LED screen: ",
    " tiles cada, ": " tiles each, ",
    " tiles) ": " tiles) ",
    "Resolução total: ": "Total resolution: ",
    "Tamanho físico: ": "Physical size: ",
    "Distância de visualização: ": "Viewing distance: ",
    " (mín. – máx.)": " (min. – max.)",
    "Peso total: ": "Total weight: ",
    " — Amps (máx.): ": " — Amps (max): ",
    " total, ": " total, ",
    " por fase (trifásica)": " per phase (three-phase)",
    "MEDIA SERVER": "MEDIA SERVER",
    "Resolução de saída: ": "Output resolution: ",
    "Media servers escolhidos:": "Chosen media servers:",
    "nenhum escolhido": "none chosen",
    "sem capacidade máxima publicada": "no published maximum capacity",
    "SINAL & DATA RATE": "SIGNAL & DATA RATE",
    "Resolução: ": "Resolution: ",
    "Total de píxeis: ": "Total pixels: ",
    "Data rate: ": "Data rate: ",
    "Pixel clock (CVT-RB2): ": "Pixel clock (CVT-RB2): ",
    "Ligação mínima recomendada: ": "Minimum recommended connection: ",
    "Switchers escolhidos: ": "Chosen switchers: ",
    "Processo de LED escolhido: ": "Chosen LED processing: ",
    "PROJETO: ": "PROJECT: ",
    "Projeto sem nome": "Unnamed project",
    "Tipo: ": "Type: ",
    "Modelo de tile: ": "Tile model: ",
    "Tiles: ": "Tiles: ",
    " no total)": " in total)",
    "Tamanho real: ": "Actual size: ",
    "Peso total: ": "Total weight: ",
    "Amp total (máx.): ": "Total amps (max): ",
    " por fase (trifásica)": " per phase (three-phase)",
    "Área total (uso interno): ": "Total area (internal use): ",
    "Processamento (": "Processing (",
    "Pixel usage total (ecrã led + DSM + delay): ": "Total pixel usage (LED screen + DSM + delay): ",
    "Switchers de show compatíveis: ": "Compatible show switchers: ",
    "Processo de LED: ": "LED processing: ",
    "TV: ": "TV: ",
    "Resolução: não confirmada": "Resolution: not confirmed",
    "Conjunto: ": "Set: ",
    " canvas: ": " canvas: ",
    "TOTAL: ": "TOTAL: ",
    " tiles, ": " tiles, ",
    " (soma dos píxeis nativos de cada zona)": " (sum of each zone's native pixels)",
    "soma dos píxeis nativos de cada zona)": "sum of each zone's native pixels)",
    " (soma das zonas)": " (sum of the zones)",
    " máx. ": " max. ",
    " A/fase)": " A/phase)",
    "Dimensão do conjunto (com gaps): ": "Overall size (with gaps): ",
    "Resolução final do canvas (com gaps): ": "Final canvas resolution (with gaps): ",
    "PGM + Preview": "PGM + Preview",
    "só PGM (sem Preview)": "PGM only (no Preview)",
    "entradas": "inputs",
    "saídas": "outputs",
  };
  Object.keys(SUMMARY_EN).forEach(function (k) { DICT_EN[k] = SUMMARY_EN[k]; });

  // Palavras curtas/ambíguas de mais para entrar no dicionário de substring
  // acima (ex: "e" e "ou" aparecem dentro de imensas outras palavras) — só
  // traduzem quando são o conteúdo INTEIRO de um nó de texto isolado (ex:
  // "<a>...</a> e <a>...</a>"), nunca como substring dentro de frases.
  var DICT_EXACT_EN = {
    "e": "and",
    "ou": "or",
  };
  var dictExactRev = {};
  Object.keys(DICT_EXACT_EN).forEach(function (k) { dictExactRev[DICT_EXACT_EN[k]] = k; });

  // ---- Motor ----
  var LANG_KEY = "calc-lang";
  var lang = "pt";
  var dictRev = null;
  var keysFwd = null;
  var keysRev = null;
  var observer = null;
  var applying = false;

  function buildReverse() {
    dictRev = {};
    Object.keys(DICT_EN).forEach(function (k) { dictRev[DICT_EN[k]] = k; });
  }
  function sortedKeys(dict) {
    return Object.keys(dict).sort(function (a, b) { return b.length - a.length; });
  }

  // \b do JS só reconhece [A-Za-z0-9_] como "letra" — não sabe que "ã", "ç",
  // "é" etc. também fazem parte de uma palavra. Sem isto, substituir
  // "Result" dentro de "Resultado" (ou "Project" dentro de "Projector")
  // passaria despercebido: a fronteira de palavra tem de ser calculada à
  // mão com uma classe de caracteres que cobre acentos latinos.
  var WORD_CHAR_RE = /[A-Za-zÀ-ÖØ-öø-ÿ0-9]/;
  function isWordChar(ch) { return !!ch && WORD_CHAR_RE.test(ch); }

  function translateString(s, dict, keys) {
    if (!s) return s;
    var out = s;
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      if (!k) continue;
      var keyStartsWord = isWordChar(k.charAt(0));
      var keyEndsWord = isWordChar(k.charAt(k.length - 1));
      var idx = out.indexOf(k);
      while (idx !== -1) {
        var before = idx > 0 ? out.charAt(idx - 1) : "";
        var after = idx + k.length < out.length ? out.charAt(idx + k.length) : "";
        var boundaryOk = (!keyStartsWord || !isWordChar(before)) && (!keyEndsWord || !isWordChar(after));
        if (boundaryOk) {
          var repl = dict[k];
          out = out.slice(0, idx) + repl + out.slice(idx + k.length);
          idx = out.indexOf(k, idx + repl.length);
        } else {
          idx = out.indexOf(k, idx + 1);
        }
      }
    }
    return out;
  }

  function currentDict() {
    if (lang === "en") return { dict: DICT_EN, keys: keysFwd };
    return { dict: dictRev, keys: keysRev };
  }

  function shouldSkip(el) {
    return !!(el && (el.closest("script") || el.closest("style")));
  }

  function translateNode(node) {
    if (node.nodeType === 3) {
      if (shouldSkip(node.parentElement)) return;
      var v = node.nodeValue;
      if (!v || !v.trim()) return;
      var trimmed = v.trim();
      var exactDict = lang === "en" ? DICT_EXACT_EN : dictExactRev;
      if (Object.prototype.hasOwnProperty.call(exactDict, trimmed)) {
        node.nodeValue = v.replace(trimmed, exactDict[trimmed]);
        return;
      }
      var c = currentDict();
      var t = translateString(v, c.dict, c.keys);
      if (t !== v) node.nodeValue = t;
      return;
    }
    if (node.nodeType !== 1) return;
    if (shouldSkip(node)) return;
    var walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT, null);
    var n;
    var nodes = [];
    while ((n = walker.nextNode())) nodes.push(n);
    nodes.forEach(translateNode);
    var c2 = currentDict();
    translateAttrs(node, c2);
    if (node.querySelectorAll) {
      node.querySelectorAll(I18N_ATTR_SELECTOR).forEach(function (el) {
        if (shouldSkip(el)) return;
        translateAttrs(el, c2);
      });
    }
  }

  var I18N_ATTRS = ["placeholder", "title", "aria-label"];
  var I18N_ATTR_SELECTOR = I18N_ATTRS.map(function (a) { return "[" + a + "]"; }).join(", ");
  function translateAttrs(el, c2) {
    if (!el.hasAttribute) return;
    I18N_ATTRS.forEach(function (attr) {
      if (!el.hasAttribute(attr)) return;
      var v = el.getAttribute(attr);
      var t = translateString(v, c2.dict, c2.keys);
      if (t !== v) el.setAttribute(attr, t);
    });
  }

  function applyAll(root) {
    translateNode(root || document.body);
  }

  function ensureObserver() {
    if (observer) return;
    observer = new MutationObserver(function (mutations) {
      if (applying || lang !== "en") return;
      applying = true;
      mutations.forEach(function (m) {
        if (m.type === "characterData") {
          translateNode(m.target);
        } else if (m.type === "childList") {
          m.addedNodes.forEach(translateNode);
        } else if (m.type === "attributes" && I18N_ATTRS.indexOf(m.attributeName) !== -1) {
          translateNode(m.target);
        }
      });
      applying = false;
    });
    var root = document.querySelector(".wrap") || document.body;
    observer.observe(root, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: I18N_ATTRS });
  }

  function updateToggleUI() {
    document.querySelectorAll("#lang-toggle .seg-btn").forEach(function (btn) {
      btn.classList.toggle("active", btn.dataset.lang === lang);
    });
  }

  // Nunca aplicámos EN ainda → o DOM já está em PT original, não há nada
  // para reverter. Correr a passagem inversa nesse estado é perigoso: uma
  // chave inglesa curta (ex: "Result", de "Resultado"→"Result") pode bater
  // como substring dentro da própria palavra PT original ("Resultado"
  // contém "Result") e corrompê-la mesmo sem o utilizador alguma vez ter
  // tocado no botão EN.
  var hasAppliedEn = false;

  function setLang(next) {
    lang = next === "en" ? "en" : "pt";
    try { localStorage.setItem(LANG_KEY, lang); } catch (e) {}
    document.documentElement.lang = lang;
    if (lang === "en" || hasAppliedEn) {
      applying = true;
      applyAll(document.body);
      applying = false;
    }
    if (lang === "en") { hasAppliedEn = true; ensureObserver(); }
    else { hasAppliedEn = false; }
    updateToggleUI();
  }

  function init() {
    buildReverse();
    keysFwd = sortedKeys(DICT_EN);
    keysRev = sortedKeys(dictRev);
    var saved = "pt";
    try { saved = localStorage.getItem(LANG_KEY) || "pt"; } catch (e) {}
    var toggle = document.getElementById("lang-toggle");
    if (toggle) {
      toggle.addEventListener("click", function (e) {
        var btn = e.target.closest(".seg-btn");
        if (!btn) return;
        setLang(btn.dataset.lang);
      });
    }
    setLang(saved);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  window.i18nSetLang = setLang;
  // Para textos que nunca passam pelo DOM (ex: confirm() nativo) e por
  // isso o MutationObserver não consegue traduzir sozinho — quem os gera
  // consulta isto para escolher a versão certa à mão.
  window.i18nGetLang = function () { return lang; };
})();
