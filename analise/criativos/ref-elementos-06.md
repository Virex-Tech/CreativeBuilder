# ref_elementos-06 — estilo editorial minimalista

29,5s · 720x1280 · pessoa falando em cadeira de escritório, fundo bege claro · só voz, sem música.
Analisado quadro a quadro em 12/10/2026.

**Tema:** "esse vídeo foi editado por IA". Serve como modelo de **linguagem visual**, não de assunto.

## A assinatura visual

Três cores e nada mais: **bege claro** (fundo), **preto** (texto) e **azul** (acento). Toda inserção
usa esse azul, sempre o mesmo.

Dois maneirismos que se repetem o vídeo inteiro:

- **Chaves e setas:** `← { a ideia sempre } →`, `{ legenda, número, gráfico }`.
- **Alças de seleção:** quatro pontinhos azuis nos cantos do elemento, como se ele estivesse
  selecionado num editor. É o que dá o ar de "feito dentro de uma ferramenta".

## Os três níveis de texto

| Nível | Onde | Como é |
|---|---|---|
| **Legenda** | topo, pequena | preta, minúscula; a palavra já dita fica preta e **a próxima aparece em cinza claro** antes de ser falada |
| **Palavra-chave** | meio, gigante | preta, pesada, sobre a pessoa: "editado", "criador", "impossível", "vídeo", "agora." — uma só por vez, com sublinhado ou cursor azul |
| **Tela gráfica** | tela cheia, sem a pessoa | fundo bege, preto ou azul, com um dado grande no centro |

## Catálogo de elementos (tempo aproximado)

| Tempo | Elemento |
|---|---|
| 0–2s | legenda no topo com a próxima palavra em cinza |
| 2s | palavra gigante "editado" sobre a pessoa |
| 3–4s | lista azul entre chaves que cresce: `{ legenda, número }` → `{ legenda, número, gráfico }`, com alças de seleção |
| 5–6s | tela cheia bege: rótulo "• faturamento em R$" e número gigante **99.583** subindo |
| 7s | cartão de perfil do Instagram: avatar, 48 posts, 1,2 mil seguidores, 312 seguindo, botão azul "Seguir" |
| 8–9s | tela cheia preta: "explodindo ↑" com sublinhado ondulado e **gráfico de barras azul crescendo** (16%, 30%, 47%, 70%, 100%) |
| 10s | "a palavra é" + **"impossível"** gigante, riscada |
| 11–12s | setinhas azuis marcando o começo da fala |
| 14s | "criador" gigante com sublinhado azul |
| 19s | tela cheia azul: `← { a ideia sempre } →` |
| 20s | "vídeo" gigante com cursor de texto azul piscando |
| 22s | tela cheia preta: a palavra "revolução" repetida em várias linhas com opacidades diferentes (efeito roleta), mosaico de fotos e botão azul "começar" |
| 28–29s | tela cheia bege: `← { Por que não você? } →` e botão "me segue para mais →" com alças |

## Ritmo

Inserção nova a cada 1 a 2 segundos, e a cada 6 a 8 segundos o vídeo **sai da pessoa e vai para uma
tela gráfica cheia** por 2 a 3 segundos. É isso que segura a atenção: a alternância, não o acúmulo
de enfeite sobre a cena.

## Como traduzir para o OzemPro

- Acento azul → **roxo da marca**. Fundo bege → pode virar off-white ou o roxo escuro.
- Palavra-chave gigante no meio: "errada", "no lixo", "travada", "25 UI".
- Tela gráfica cheia no lugar de cartãozinho sobre a cena: número grande ("R$ 1.200 por mês"),
  barra crescendo, lista que se monta.
- Legenda no topo com a próxima palavra em cinza é uma mudança grande em relação ao que fizemos
  (legenda no centro, palavra falada em roxo) — decidir qual manter.
- As alças de seleção e as chaves podem virar nossa assinatura, mas aí têm que aparecer em **todos**
  os criativos, senão viram ruído.

## O que precisa ser construído no renderer

Tela gráfica cheia (fundo + rótulo + número), contador animado, gráfico de barras que cresce,
palavra gigante com sublinhado/cursor, lista entre chaves que cresce item a item, alças de seleção,
cartão de perfil, texto repetido com opacidades, botão com seta.
