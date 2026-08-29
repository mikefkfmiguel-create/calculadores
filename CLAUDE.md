# Calculadores (AVK Calculadores)

PWA estática para cálculos de AV/produção de eventos, uso interno da AVK Portugal.

## Convenções

- Publicar sempre: fazer merge do trabalho terminado diretamente para `main` via PR, sem pedir confirmação extra (draft → ready → merge).
- Bump de versão em cada alteração visível ao utilizador: `<span class="mark">vX.Y</span>` em `index.html` (~linha 24) e `const CACHE = "calculadores-vNN";` em `sw.js` — sempre os dois juntos, inteiro incrementado.
- Nunca inventar dados técnicos (specs, capacidades, etc.) — só usar valores reais, com fonte.
- Prioridade: simplicidade para produção não-técnica.

## Ideias futuras (por explorar, não iniciar sem pedido explícito)

- **Versão "global" para venda**: separar o motor de pesquisa/cálculo (throw ratio, pixel pitch, data rate, etc. — genérico, reutilizável) do inventário/stock específico da AVK (equipamento próprio, badges "Mercado"/"Estimado", filtros de posse). Uma edição para venda a outras empresas manteria só os motores de pesquisa e cálculo, sem os filtros de stock da AVK, com versões traduzidas para outras línguas.
