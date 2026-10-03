---
name: aprender-mike
description: Revisão das perguntas e respostas reais do Better call Mike para o "Mike virtual" aprender — junta as que se repetem e as propostas "📘 Propor como nota", propõe fichas ao mike e só grava as que ele aprovar. Usar quando pedido ("o que aprendeu o Mike virtual", "revê as perguntas", "fichas novas") ou na revisão semanal.
---

# Aprender — o "Mike virtual"

Nasceu de um pedido do mike (4 out 2026): *"como se fosse uma ai do Mike, em
que as questões são pensadas com base no que te tenho exposto e podes ir
aprendendo juntando perguntas e respostas que encontras"*.

Três camadas, cada uma num sítio:

| Camada | Onde | Muda como |
| --- | --- | --- |
| Quem é e como pensa | `conhecimento/perfil-mike.md` (lido pelo Worker em todas as perguntas, fora do `indice.json`) | Só a pedido do mike |
| O que sabe | `conhecimento/*.md` do `indice.json` | Regras do `CLAUDE.md` |
| O que aprende | `conhecimento/perguntas-e-respostas.md` | Esta skill, sempre com o ok dele |

## 1. Ir buscar o que foi perguntado

```
curl -sS "https://calculadores-assistente.avkvideoshare.workers.dev/registos" \
  -H "Authorization: Bearer $ASSISTENTE_ADMIN_TOKEN"
```

O token nunca fica no repositório: se a sessão não o tiver, pedir ao mike.
Interessam dois tipos de registo:

- `tipo: "pergunta"` — pergunta, resposta, `origem`, `notasUsadas`, `fontes`
  (ficam 30 dias);
- `tipo: "proposta-nota"` — alguém carregou em "📘 Propor como nota" depois de
  confirmar no terreno (ficam 120 dias). Pesam mais do que uma pergunta solta.

## 2. Encontrar candidatas a ficha

- **A mesma dúvida, várias vezes** (palavras diferentes, mesmo assunto). Uma
  só pergunta não chega, salvo se veio como proposta.
- **Respostas com origem `geral`** sobre uma dúvida que se repete: a IA não
  tinha fonte. É exatamente o que uma ficha deve resolver.
- **Respostas com `web`** a confirmar o mesmo dado de fabricante vezes sem
  conta: uma ficha com a fonte poupa a pesquisa.
- Ignorar pedidos de um caso concreto (um orçamento, um evento): cada caso é
  único e não se aprende dados de clientes. Aprende-se o conhecimento que o
  caso mostrou, nunca o caso.

## 3. Propor ao mike — nunca gravar sem o ok

Mostrar as candidatas numa lista curta, cada uma com: a pergunta como as
pessoas a fazem, a resposta proposta, a fonte (registo de terreno, manual com
link, nota), e quantas vezes apareceu. Perguntar uma a uma: aprova, corrige ou
descarta.

**Nunca:**
- gravar uma resposta da IA como ficha sem o ok explícito do mike — senão um
  erro dela passa a "facto" e começa a ser repetido como fonte "notas";
- pôr numa ficha valores técnicos sem fonte (regra do `CLAUDE.md`);
- copiar nomes de pessoas, clientes ou eventos dos registos para a ficha.

## 4. Gravar as aprovadas

1. Acrescentar a ficha a `conhecimento/perguntas-e-respostas.md` no formato
   que lá está; tirar a linha "Ainda não há fichas aprovadas" na primeira.
2. Atualizar `atualizado` dessa entrada em `conhecimento/indice.json`.
3. Bump de versão (`index.html` + `sw.js`), PR para `main`, como sempre.
4. Não é preciso publicar o Worker: ele lê as notas do GitHub Pages a cada
   pergunta (cache de 5 minutos).
5. Entrada datada no topo de `PARA-CONTINUAR.md`.

## 5. Reportar ao mike

Curto: quantas perguntas e propostas houve, quantas fichas propostas,
quantas aprovou, e o que ficou por decidir.
