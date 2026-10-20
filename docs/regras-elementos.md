# Elementos na tela — vale para TODOS os apps

O vocabulário de elementos do renderer, como eles entram e saem, o que a equipe já reprovou.
Cores e fonte saem do `brandKit` de cada app; a gramática é a mesma para todos.

## 1. As três leis

**1. O elemento ilustra a palavra dita naquele instante.** Entra com a fala, sai quando o assunto
muda. Se não ilustra nada, não entra.

**2. O dado se constrói na tela.** Em nenhuma referência o número aparece pronto: ele conta, a barra
enche, a linha desenha, o risco corta, os itens entram um a um. É isso que separa "tem gráfico" de
"tem movimento".

**3. O ritmo é alternância, não acúmulo.** Troca a cada 1 a 3 segundos, e a cada 6 a 8 segundos
muda o *layout* inteiro.

---

## 2. Gramática de layout

Quatro posições possíveis. Alternar entre elas é o que segura a atenção.

| Sigla | Layout | Quando usar | Referência |
|---|---|---|---|
| **P** | cena cheia (panda/pessoa), sem elemento | respiro, frase de emoção, CTA falado | 04 usa 30% do tempo assim |
| **S** | painel em cima (40–50%) + cena embaixo | dado e cena precisam andar juntos | 04, 05 |
| **T** | tela gráfica cheia, sem a cena | o dado **é** o assunto | 02, 04, 05, 06 |
| **O** | elemento sobre a cena | apoio curto sem sair do plano | 01, 02, 03 |

**Cadência medida nas referências:** 22 a 70 inserções por minuto. Trecho sem nenhum elemento: de
3 a 9 segundos, e no máximo 30% do vídeo.

---

## 4. Catálogo de elementos

Cada um com o parâmetro de verdade: tamanho em % da largura do quadro (1080), posição em % da
altura, tempo de entrada e saída. Tudo medido nas referências.

### 4.1 Cartão de dado (molde base)
- **Tamanho:** 85–90% larg. · **Posição:** topo, y 6–28%
- **Forma:** fundo `#12091F` a 92%, cantos 32px, sombra `0 24px 60px rgba(0,0,0,.45)`
- **Conteúdo:** kicker em caixa alta (28px, roxo) + título negrito (46px) + dado grande (88px)
- **Entra:** pop de 0,15–0,2s · **Sai:** fade de 0,3–0,4s
- **Regra de ouro (ref 03):** trocar o conteúdo do mesmo cartão em vez de entrar e sair vários.
  Entre um conteúdo e outro, 0,3s "vazio" dá sensação de carregamento.
- **No OzemPro:** `DOSE DA SEMANA · Você puxou · 25 UI`

### 4.2 Cartão de alerta (molde invertido)
- Mesmo molde, fundo **amarelo** `#FFD600`, texto preto extra-bold, 14% da altura
- Usar no máximo **uma vez por vídeo**, no ponto de virada da dor (ref 02: "! EMPREENDEDOR PRESTA ATENÇÃO")
- **No OzemPro:** `! ERROU O RISQUINHO`

### 4.3 Contador numérico
- **Tamanho:** 88–120px · Sobe ou desce em 0,8–1,5s, com casas decimais travadas
- Sempre com um rótulo pequeno em cima (`• faturamento em R$` na ref 06)
- **No OzemPro:** `R$ 1.200 → R$ 0` (o que foi pro lixo) · `10 UI → 25 UI` (a conta certa)

### 4.4 Barra que cresce
- **Tamanho:** 70–88% larg. · **Tempo:** 1,5s · Número ao lado contando junto
- Comparação de duas barras (ref 02: Bradesco verde vs. Ibovespa cinza)
- **No OzemPro:** `conta de cabeça` (cinza, curta) vs. `app` (roxa, cheia)

### 4.5 Barra de progresso
- **Tamanho:** 70% larg., 10–14px de altura · Enche em 1,6s, com **flash** no fim (ref 04)
- **No OzemPro:** caneta acabando, semana até a próxima dose

### 4.6 Linha de gráfico que desenha
- **Tamanho:** cartão de 88% larg. · Linha se desenha da esquerda para a direita em 1s
- Com área em degradê embaixo, ponto final com halo e linha de referência pontilhada
- **No OzemPro:** nível do medicamento ao longo da semana (tela que já existe no app)

### 4.7 HUD de progresso com slots
- **Tamanho:** 90% larg., y 2–8% · Fica o vídeo inteiro
- Rótulo + selo `0/3` + slots que enchem um a um, cada um com pop pequeno
- **No OzemPro:** `O QUE O APP RESOLVE 0/3` enchendo a cada funcionalidade mostrada
- É o único elemento que pode conviver com o mockup, porque mora acima dele

### 4.8 Chips em sequência
- **Tamanho:** 25–35% larg. cada, 3,5% da altura · Entram um a um, 0,25s entre eles
- Cada chip cai exatamente na palavra correspondente da narração
- **No OzemPro:** `náusea` `azia` `constipação` entrando enquanto a narração lista

### 4.9 Lista tipo recibo com riscos
- **Tamanho:** 35–76% larg. · Desce do topo em 0,25s
- **Riscos vermelhos** que se desenham da esquerda para a direita, 0,25s por linha
- **No OzemPro:** o que o erro custa, linha por linha

### 4.10 Carimbo
- **Tamanho:** 70% do cartão · Girado −12°, vazado, vermelho
- **Entra:** escala 140% → 100% com tremida curta (slam) em 0,25s
- **No OzemPro:** `PERDIDA` sobre a dose, `RESOLVIDO` sobre a dúvida

### 4.11 Círculo à mão
- **Tamanho:** 25% larg. · Traço de 3px, desenha-se em 0,3s
- Sempre **em volta de algo que já está na tela** (número, botão, palavra)
- **No OzemPro:** em volta do `25 UI` na tela da calculadora

### 4.12 Marca-texto que varre
- Pinta da esquerda para a direita em 0,3s, atrás da palavra
- **No OzemPro:** roxo ou amarelo atrás da palavra-chave da frase

### 4.13 Tachado animado
- Linha cresce da esquerda em 0,3s sobre a palavra, que fica cinza claro em seguida
- **No OzemPro:** ~~conta de cabeça~~ → app

### 4.14 Selo
- **Tamanho:** 14% larg. · Inclinado, pop com batida
- Verde `GRÁTIS`, roxo `NO AR`, estrela de destaque
- **No OzemPro:** `TESTE GRÁTIS`, `✓ REGISTRADO`

### 4.15 Cantoneiras de enquadramento
- **Tamanho:** 30% larg. × 20% alt. · Pop de 0,15s
- Ancoradas no que importa na cena: rosto, caneta, balança
- **No OzemPro:** em volta da caneta na mão do panda

### 4.16 Palavra gigante
- **Tamanho:** 40–50% larg., y 10–14% · Preta ou branca, extra-bold
- Com sublinhado roxo, cursor piscando, ou efeito 3D leve
- Uma só por vez, trocando com a fala (ref 06: "editado", "criador", "impossível")
- **No OzemPro:** `errada`, `no lixo`, `travada`, `25 UI`

### 4.17 Sticker de frase
- **Tamanho:** 38% larg. · Branco com **contorno preto grosso**, girado −4°
- **Entra:** pop com overshoot
- **No OzemPro:** `NINGUÉM TE EXPLICA ISSO`

### 4.18 Print dentro de moldura
- Print do app com moldura roxa de 3–4px e cantos arredondados, fundo desfocado atrás
- Zoom lento de 1,05 ao longo do plano
- Variação (ref 05): print **inclinado em perspectiva 3D**, entrando pela lateral em 0,4s

### 4.19 Equação de blocos
- Cartão branco de 72% larg. com blocos de 118–168px: `A + B = C`
- O resultado entra **depois** dos operandos, 0,3s de atraso
- **No OzemPro:** `frasco + água = 25 UI`

### 4.20 Comparação lado a lado
- Dois blocos de 30% larg. cada, com `=` pulsando no meio
- Um se preenche enquanto o outro já está pronto
- **No OzemPro:** `errado` vs `certo`, `antes` vs `com o app`

### 4.21 Mock de campo de comentário
- **Tamanho:** 92% larg., 7% alt. · Avatar + texto digitado letra a letra + botão `Publicar`
- Variação (ref 05): ícone de avião de papel com badge vermelho `1` voando para a DM
- **No OzemPro:** só se o CTA for de comentário

### 4.22 Mosaico / grade que se monta
- Itens aparecem um a um em grade (ref 05: 3 → 7 → 11 mascotes; ref 06: fotos)
- **No OzemPro:** as telas do app se montando em grade no fecho

### 4.23 Pódio e confete
- Pódio com 1º e 2º lugar, coroa, holofote, confete caindo por 1,5s
- **No OzemPro:** usar com parcimônia, e nunca comparando resultado de tratamento

### 4.24 Cursor que clica
- Cursor animado que se move e clica em botões do print, um clique por palavra citada
- **No OzemPro:** ótimo para mostrar fluxo do app sem gravar de novo

### 4.25 Typewriter
- Texto digitado letra a letra em 0,6–1s, com cursor piscando
- **No OzemPro:** o nome do app, o termo do CTA, o campo de busca

---

## 5. Entradas e saídas (padrão)

| Movimento | Duração | Onde se usa |
|---|---|---|
| pop (escala 0,85 → 1) | 0,15–0,2s | cartão, chip, selo |
| pop com overshoot | 0,25s | sticker, carimbo |
| fade | 0,3–0,4s | saída da maioria |
| corte seco | 0 | troca de assunto |
| desce do topo | 0,25s | recibo, lista |
| desenha-se (stroke) | 0,3s | risco, círculo, linha, tachado |
| cai e quica | 0,4s | título, logo |
| zoom lento | plano inteiro | print, foto estática |

---

## 6. Som (o que as referências fazem)

Nenhuma das 6 tem música. Só voz e efeitos pontuais — e poucos. Efeitos que aparecem: pop na
entrada do elemento, tick no contador, risco, carimbo, clique de cursor, notificação no CTA.

No nosso caso, usar o que está em `render/public/sfx/`, com **um som por momento**, nunca dois
juntos.

---

## 7. Elemento se constrói por criativo (regra da equipe, 13/10/2026)

**Não montar biblioteca de componentes prontos para usar depois.** Cada elemento nasce do roteiro
daquele criativo: primeiro entender o que a frase precisa mostrar, depois construir a peça para
aquilo. Componente pronto vira muleta — encaixa-se o que existe em vez de pensar o que a cena pede.

Este catálogo é **vocabulário de consulta**, não estoque.

Já construído alguma vez: cartão, equação, lista com risco, HUD, sticker, imagem, legenda karaokê,
fundo desfocado, mockup de celular.

## O que o renderer sabe fazer (14/10/2026)

Até 14/10 este playbook descrevia elementos que **o renderer não sabia desenhar** — contador,
gráfico que se traça, barra que cresce, círculo à mão, tachado ao vivo, cor por significado.
Estavam aqui porque saíram das referências, não porque existiam. Agora existem. Esta é a lista
real; o que não está aqui, não dá para pedir.

| Layer | O que faz | Campos que importam |
|---|---|---|
| `syringe_ruler` | **régua da seringa**: traços numerados, com faixa acesa no intervalo da dose. Os números são desenhados pelo renderer, nunca saem tortos | `from`/`to`, `step`, `labelEvery`, `highlightFrom`/`highlightTo`, `label`, `drawMs` |
| `scribble` | **traço desenhado à mão** que nasce da ponta e corre até o fim | `shape`: circle · arrow · underline · cross · bracket · zigzag; `drawMs`, `color`, `stroke` |
| `counter` | número que **corre** de um valor a outro | `from`, `to`, `decimals`, `prefix`/`suffix`, `countMs`, `chip` |
| `bar` | barra que **cresce** até a porcentagem | `value`, `valueText`, `growMs`, `color` |
| `line_chart` | gráfico de linha que **se desenha**; linha reta = platô | `points` (0..100), `endLabel`, `drawMs` |
| `list_card` | recibo; linhas entram **uma a uma** e o tachado **risca ao vivo** | `staggerMs`, `strikeAtMs`, `variant` (light/dark), item com `check`/`icon`/`color` |
| `hud` | barra com slots que **acendem um a um** | `fillStaggerMs`, `color`, `x`, `y` |
| `card` | cartão de dado | `variant`: dark · light · accent · alert · **ok** (verde) · **warn** (amarelo), ou `color` livre |
| `sticker` | selo/chip de texto | `color`, `textColor`, `icon` |
| `equation` | A + B = C | `tiles` |
| `badge`, `image`, `text` | selo do topo, imagem solta, texto com preset | `color` no badge |

**Cor agora é livre em todo elemento** (`color`), então a gramática de cor desta página vale de
verdade: roxo `#8630E4` solução · vermelho `#E53935` erro · verde `#1FA84F` confirmado ·
amarelo `#FFD600` alerta.

**Todo elemento pode sair animado**: `animOut` = `fade_out` · `pop_out` · `slide_down` ·
`wipe_out`. Sem isso o elemento corta seco, que é o que separa criativo montado de criativo
editado — nas referências nada desaparece de um quadro para o outro.

**A legenda varia por cena** (`karaoke`): `style` = `plain` (padrão da casa) · `box` (caixa cheia
atrás da palavra falada) · `pop` (a palavra cresce no instante em que é dita); mais `size`
(corpo em px), `maxWords`, `activeColor` e `emphasis` (palavras que ficam maiores e coloridas o
tempo todo, mesmo sem estarem sendo ditas). Hook pede corpo maior e `pop`; texto corrido pede
`plain` menor.

## Imagem como elemento (14/10/2026)

Duas fontes, as duas pelo layer `image` (`radius`, `border`, `label`, `color`):

**1. Foto do Pexels** — b-roll parado, licença livre para uso comercial:

```bash
node tools/pexels.mjs buscar foto "fita metrica cintura" --n 5 --orientacao portrait
node tools/pexels.mjs baixar foto <id> --out render/public/elementos/<nome>.jpg
```

**2. Recorte da tela do app** — mostra UMA coisa do app (o número da dose, o card da refeição,
o gráfico) numa cena em que o celular não está em quadro:

```bash
node tools/recorte.mjs amostra render/public/app/ozempro/<gravacao>.mp4
node tools/recorte.mjs cortar render/public/app/ozempro/<gravacao>.mp4   --em 2.14 --area 4,11,92,30 --saida render/public/elementos/<nome>.png
```

`amostra` monta uma grade de 6 quadros com os tempos, para escolher o instante; `--area` é
x,y,largura,altura **em % da origem**. O comando imprime o trecho de spec pronto.

No spec:

```json
{ "type": "image", "src": "elementos/ozempro-calc-25ui.png", "x": 50, "y": 30,
  "width": 64, "radius": 26, "border": true, "label": "quanto puxar", "anim": "pop_in" }
```

**Regra:** recorte de tela é elemento para cena **sem** o mockup. Quando o celular está em
quadro, o foco é ele e nada entra por cima — a tela do app é a prova do produto.

**Vídeo dentro de elemento não existe** e não é para usar por enquanto (decisão de 14/10). Só
imagem.

## Vocabulário novo (19/10/2026) — apontadores, aparências de texto e painéis

Entrou a partir da leitura do catálogo do `editonny` (MIT, de onde veio só a **referência**: nada
do código, dos assets nem da GSAP dele está aqui). Tudo desenhado pelo renderer, com Montserrat e
a cor da marca. Demonstrações renderizáveis em `render/specs/_vocabulario/`.

### `pointer` — o "olha aqui" (16 formas)

`curved_arrow` · `side_arrow` · `down_arrow` · `tap` · `highlighter` · `underline` · `box` ·
`banner` · `number` · `check` · `cross` · `exclamation` · `question` · `rays` · `spotlight` ·
`toggle`

Campos: `shape`, `x`, `y`, `size` (% da largura), `color`, `rotate`, `text` (só `banner` e
`number`), `drawMs`. O apontador **encosta** na coisa, não fica em cima dela — e nada entra sobre
o mockup do celular. O círculo à mão continua reprovado e não existe aqui.

### `look` — aparência do texto (9), no `text` e no `sticker`

`plain` (padrão) · `impact` · `outline_glow` · `translucent_box` · `chromatic` · `glitch` ·
`doodle` · `red_word` · `spotlight_off`

Em `red_word`, a palavra entre `*asteriscos*` sai colorida (`lookColor`). `doodle` usa a fonte
**Caveat**, que precisa estar instalada na máquina que renderiza.

A aparência é separada da animação, então combina com qualquer `anim`. Entraram cinco entradas
novas, que valem em qualquer layer: `typewriter`, `spring`, `twist`, `exhale`, `rising_glow`.

### Painéis de saúde e comida (6 layers)

| Layer | Para quê |
|---|---|
| `body_map` | corpo de frente com os pontos de aplicação; o escolhido acende |
| `plate` | prato dividido em fatias com nome e proporção |
| `swap` | "isto sai, aquilo entra" — dois cartões, seta e nota |
| `units` | N unidades aparecendo uma a uma (cubos de açúcar, gotas, comprimidos) |
| `limit_gauge` | medidor com faixa de limite: verde, amarelo, vermelho |
| `warning_signs` | sinais de alerta em lista, entrando em sequência |

Os seis usam a mesma caixa de vidro dos cartões, para não parecerem de outro kit.

## Reprovado pela equipe

- **Círculo à mão (`scribble` com `shape: "circle"`)** — testado em 14/10/2026 e reprovado: não
  acrescenta sentido à cena. Não usar. As outras formas do `scribble` (seta, sublinhado, X,
  colchete, zigue-zague) ainda não foram testadas com a equipe.
- **Emoji solto flutuando** — reprovado em 07/10/2026 (ver acima).
- **Cartão com frase solta** — reprovado em 11/10/2026: lê como legenda extra, não como elemento.

## Armadilha: elemento que atravessa mais de uma cena (15/10/2026)

Layer é por cena. Um elemento que precisa ficar na tela durante **duas ou mais cenas** é
repetido — uma cópia em cada cena. Quando isso acontece:

**Só a última cópia leva `animOut`.** Se todas levarem, o elemento desaparece e reaparece a cada
corte, e lê como bug de render. Foi exatamente o que aconteceu em 15/10/2026 com o hook de texto
que atravessava `hook-a` e `hook-b`: ele piscava no corte.

Mesma lógica para `anim` de entrada: só a **primeira** cópia anima a entrada; as seguintes
entram com `anim: "none"`, senão o elemento "nasce" de novo a cada corte.

---

## Moldes de interface (embalagens do PDF, 18/10/2026)

Cada molde abaixo é **vocabulário de consulta**, não componente de estoque: a regra da seção 7
vale. Primeiro se entende o que a frase do criativo precisa mostrar; só então se desenha o mock
daquele criativo. Todo mock é desenhado pelo Remotion (texto e interface nunca vêm de modelo
generativo) e nenhum print real de terceiro entra sem autorização por escrito. O número é o da
embalagem em `formatos.md`.

A coluna "Com o que já existe" descreve um **esboço aceitável hoje**, montado só com as layers da
lista "O que o renderer sabe fazer". Não é o mock fiel. A coluna "O que falta" diz o que
precisaria existir para ficar fiel; onde diz "não existe", não existe.

| Molde | Embalagens | Com o que já existe | O que falta no renderer | Cuidado |
|---|---|---|---|---|
| Nota do iPhone | 4, 42 | `card` variant `light` (amarelo-papel via `color`) com `title` = título da nota e `kicker` = data; texto da nota em `text` preset `sub` por cima; `list_card` variant `light` se a nota for lista | Moldura do app Notas (barra com "< Notas", ícones de compartilhar) e texto digitado letra a letra: o typewriter do catálogo 4.25 **não existe** como layer nem como `anim` | Conteúdo é cena vivida, com detalhe miúdo. Sem bordão, sem frase de efeito. Sem logo até o CTA |
| Conversa de WhatsApp | 5 | `card` `light` e `card` `ok` (verde) empilhados em `y` diferentes, um por mensagem, cada um com `startMs` próprio; `sticker` com `chip` para a hora | **Não existe layer para isso.** Faltam balões alinhados à esquerda e à direita, cauda do balão, avatar, nome do contato, tique de lido e cabeçalho do app. Os `card` são centrados por `x` e a altura varia com o texto, então o esboço lê como dois cartões, não como conversa | Encenação declarada (selo "simulação") ou conversa real autorizada. Nome e foto fictícios. Pergunta de dor com apelido da caneta |
| Barra de busca do Google com autocompletar | 7 | `card` `light` com `title` = termo digitado; `list_card` `light` logo abaixo com as sugestões (`staggerMs` faz entrarem uma a uma, até 6 linhas) | Campo arredondado com lupa e logo, lista de sugestões colada ao campo, cursor piscando e digitação. Hoje campo e lista são dois elementos separados | Sugestões com apelido (canetinha, moun, tirze), tiradas da masterlist de dores. Não afirmar nada sobre quem pesquisa |
| Thread / pergunta em grupo com respostas | 8 | `card` `light` para a pergunta e 2–3 `card` menores abaixo, um por resposta, com `startMs` escalonado; a resposta que aponta a calculadora usa `variant` `accent` | Avatar redondo, nome, hora, recuo da resposta, contador de curtidas. Layer de post ou comentário com avatar não existe (o 4.21 do catálogo também não) | Nomes e avatares fictícios. Nunca post real sem autorização. Carrossel: um cartão por resposta |
| Caixinha de pergunta do story | 10 | `card` `accent` com `kicker` = "Faça uma pergunta" e `title` = a pergunta; `card` `light` ou `image` (recorte da calculadora) como resposta | Fundo em degradê do story, caixa branca arredondada com a pergunta, moldura do story (barra de progresso no topo, avatar). Nada disso é layer | A faixa acima de y 18 é coberta pela interface da rede: o mock fica nas três faixas. Pergunta = dor com apelido; resposta = tela do app |
| Faixa de aviso amarela | 12 | `card` `warn` (ou `alert`) com `kicker` = "Atenção" e `title` = o erro da prática; `sticker` com ícone de alerta; `anim: "shake"`. Montável por inteiro | Nada essencial. Uma faixa de largura total ajudaria (hoje o `card` vai até 96% e tem cantos arredondados) | Uma vez por vídeo (playbook 4.2). O erro é da prática ("dose contada de cabeça"), nunca de quem lê. Sfx `error.mp3` |
| Caixa "quebre o vidro em caso de emergência" | 14 | `card` `alert` (vermelho) com `title` = "Em caso de dúvida na dose" e `image` = ícone do app dentro do cartão; `sticker` com `rotate` pequeno | Moldura de vidro (reflexo, rachadura) e o martelo preso na corrente. Sem isso, lê como cartão vermelho com ícone | Dor: dúvida de dose na hora de aplicar. Sfx `click_hook.mp3`. Ícone do app é o oficial, nunca refeito |
| Tela de chamada recebida | 29 | `solid` escuro de fundo, `image` com `radius` alto (ícone do app ou panda), `text` preset `title_top` com o nome, dois `sticker` com `chip` (verde e vermelho) para atender e recusar | Layout de chamada (nome grande, "chamando…", botões circulares com ícone de telefone, rótulos) e animação de toque. Os botões são `sticker` soltos, sem ícone de telefone | Nome da marca ou "Pandinha do OzemPro". Nunca nome ou rosto de pessoa real. Em vídeo, 5 s e corta para o app. Sfx de toque ainda não existe em `sfx/` |
| Mock de manchete de portal | 1, 2, 26 | `card` `light` com `kicker` = veículo genérico e data, `title` = manchete, `value` = dado; `image` do Pexels acima | Cabeçalho de portal (logo, menu), foto com crédito, fonte de manchete. O renderer só tem Montserrat | **Só fato real e verificável, fonte e data na tela.** Nunca inventar notícia. Veículo genérico, nunca a marca de um portal real. Dado de estudo: ok da equipe antes |
| Mock de e-mail | 6 | `card` `light` com `kicker` = remetente, `title` = assunto, `value` = primeira linha do corpo | Linha de caixa de entrada (avatar, remetente em negrito, prévia em cinza, hora, marca de não lido). Layer de e-mail não existe | Prioridade baixa (o público do app não vive no e-mail). Remetente fictício |
| Mock de comentário de anúncio | 35, 47, 20 | `card` `light` com `kicker` = nome coberto e `title` = o comentário; `image` com `radius` alto como avatar; a resposta em `card` `accent` ou `ok` | Layer de comentário: avatar redondo à esquerda, balão cinza, "Curtir · Responder · 3 h", resposta recuada. É o mesmo buraco do 4.21 | Só comentário real dos **nossos** anúncios, nome e foto cobertos. Comentário de terceiro só com autorização. Se for encenação, selo "simulação" |
| Diagrama de Venn | 30 | `equation` com dois blocos e o app no meio (`op: "plus"`, `op: "equals"`) como esboço; ou uma arte de Venn feita à parte entrando como `image`, com os rótulos em `text` | Dois círculos translúcidos sobrepostos, rótulo em cada um, interseção destacada. Não existe layer de forma geométrica (círculo preenchido, opacidade). O `scribble` circle é traço à mão e está **reprovado** | Rótulos sobre o app, não sobre quem assiste ("o que quero registrar" / "o que o médico pergunta") |
| Mito x fato / duas colunas | 16, 37, 40, 67 | Dois `card` lado a lado, `x` 27 e 73, `width` 44, um `alert` (mito) e um `ok` (fato); ou dois `list_card` com `check` e `icon` por item; `equation` para o 4.20 | Layer `two_columns` com cabeçalho por coluna, divisória e itens alinhados linha a linha. Com dois `card` o alinhamento depende de acertar `y` na mão, e as alturas variam com o texto | Mito e fato sobre a **rotina e o app**, nunca afirmação médica. #67: o que o app faz, nunca descrevendo quem assiste. Sem concorrente pelo nome |
| Tabela com checks e X | 58, 37, 39 | `list_card` `light` com `icon` e `color` por linha ("✓" verde, "✕" vermelho), uma linha por critério; para colunas, dois `list_card` lado a lado | Tabela de verdade: cabeçalho de colunas, grade, células alinhadas por linha. O `list_card` tem uma só coluna de valor | **Nunca planos nem preço.** Tabela dos jeitos de calcular (cabeça, tabela do WhatsApp, calculadora) ou das abas do app. Sem citar concorrente |
| Outdoor com texto em perspectiva | 27 | `image` do Pexels (outdoor ou ponto de ônibus) em tela cheia + `text` preset `title_top`, ou `sticker` com `rotate` e `width` estreita | Transformação de perspectiva (corner pin) para casar texto com o plano do outdoor. `rotate` é só giro no plano: o texto fica colado na foto, não dentro do outdoor | Texto curto, com apelido. Foto do Pexels sem marca legível de terceiro nem rosto reconhecível |
| Celular com o app em fundo limpo (foto do produto) | 77, 78 | `app_screen_recording` com `device: "iphone15_mock"` e `src` de um print (`.png`); fundo `solid` `#F6F2FC` ou `#12091F`; `text` preset `title_top` com uma frase; `image` com o ícone. Montável por inteiro: é o molde do criativo 95 (validado). Para o 78, `image` do Pexels de bancada ao fundo | Sombra de contato, reflexo, inclinação em perspectiva e fundo de estúdio em degradê. O molde sai sem isso | Sem preço. Tela do app sem nome de medicamento legível (regra do borrão). Uma frase só |
| Carta longa (estático com muito texto) | 53 | `card` `light` com `color` amarelo-papel, `width` 90, `rotate` de 1 a 2 graus; texto em `title` | Bloco de texto corrido, com quebra de linha e fonte manuscrita ou de post-it. O `card` serve para 3–4 linhas; mais que isso exige dividir em cartões (carrossel) | Conexão, detalhe miúdo, zero frase de efeito. Primeira pessoa só de pessoa real; sem ela, impessoal. É a exceção declarada à regra de 6–12 palavras |
| Carta de término (nota em tom de despedida) | 42 | O esboço da nota do iPhone: `card` `light` + `text`; o jeito antigo riscado com `list_card` e `strikeAtMs` | Os mesmos buracos da nota do iPhone | Despedida do **jeito antigo** (caderno, tabela), nunca de pessoa. Precisa de detalhe vivido; frase de efeito é proibida |

**Montáveis hoje só com o que existe:** faixa de aviso amarela (12); celular com o app em fundo
limpo (77/78); caixa de emergência (14, sem moldura de vidro); mito x fato e tabela com checks e
X (16/37/39/40/58/67, com `card` e `list_card`); mock de manchete (1/2/26); nota do iPhone e
carta de término (4/42, sem moldura do app); carta longa (53, só curta); busca do Google (7,
em dois elementos); outdoor (27, sem perspectiva).

**Precisam de layer nova para ficar fiéis:** conversa de WhatsApp (5), thread (8), comentário de
anúncio (35/47), caixinha do story (10), tela de chamada (29), e-mail (6), Venn (30), e o
outdoor (27) para a perspectiva.

### Regras que valem para todo mock

- **Tipografia e cor da marca:** Montserrat (negrito no título, semibold no resto), roxo
  `#8630E4`, fundo `#12091F` ou off-white `#F6F2FC`. As cores com significado da seção 3 valem
  (vermelho erro, verde confirmado, amarelo alerta). O mock imita a **estrutura** da interface,
  nunca a identidade visual de terceiro (logo do WhatsApp, do Google, de portal).
- **Três faixas verticais, só três:** inferior y≈75, centro y≈50, topo y≈25. Nada acima de y 18
  nem abaixo de y 82. Mock alto (conversa, thread) ocupa **uma** faixa; se não cabe, divide em
  duas cenas.
- **Texto curto:** 6 a 12 palavras por bloco, como no viral. Mock que precisa de mais vira
  carrossel ou fica de fora (a carta longa, 53, é a única exceção).
- **Nome e foto fictícios.** Nada de nome real, foto real, telefone ou @ de perfil real.
  Comentário real dos nossos anúncios só com nome e foto cobertos.
- **Selo pequeno "simulação"** (`sticker` ou `disclaimer`) sempre que for encenação: conversa,
  thread, comentário, chamada e e-mail.
- **Nada sobre quem assiste:** o mock mostra a dúvida como comum, nunca presume peso, corpo,
  tratamento ou sintoma. Nome de medicamento só por apelido (canetinha, moun, tirze).
- **Sem frase de efeito dentro do mock.** Conexão, fator uau ou polêmica.
- **O mock some antes de a tela do app entrar:** a regra "legenda sai quando a tela do app
  entra" vale para mock também. Saída com `animOut`; nunca mock por cima do mockup do celular.
- **Elemento nunca com legenda por cima:** cena de mock sem `karaoke` sobre ele; estático não
  leva legenda.

### Pedidos para o renderer

Em ordem de prioridade (o que destrava mais embalagens vem primeiro). Nada disto existe; é só a
lista.

1. **`chat`** (balões). Mensagens com lado (esquerda ou direita), avatar, nome, hora, tique de
   lido e entrada uma a uma (`staggerMs`). Variantes `whatsapp`, `comment` (avatar, balão,
   resposta recuada) e `thread`. Destrava: #5 conversa de WhatsApp, #8 thread, #35 e #47
   (comentário de anúncio), #20 (comentário atrás da pessoa).
2. **`phone_ui`** com variantes `notes`, `search`, `call`, `story_box` e `email`. Moldura do app
   (cabeçalho, campo, botões) mais conteúdo em texto, com digitação letra a letra (`typeMs`).
   Destrava: #4 e #42 (notas), #7 (Google com autocompletar), #29 (chamada), #10 (caixinha),
   #6 (e-mail).
3. **`two_columns`**. Duas colunas com cabeçalho, divisória e itens alinhados linha a linha, cada
   item com ✓ ou ✕. Destrava: #16 mito x fato, #37 nós contra eles, #39 jeito antigo × novo,
   #40 problema × solução, #58 tabela, #67 pra quem é / pra quem não é.
4. **Campo `perspective`** (corner pin, quatro cantos em % do quadro) em `image` e `text`.
   Destrava: #27 outdoor, #78 foto de estúdio e o print inclinado do 4.18.
5. **`shape`** (círculo e retângulo com `fill`, `opacity` e rótulo) e `anim: "type_in"` no
   `text`. Destrava: #30 Venn, sem usar o círculo à mão reprovado, e a digitação do 4.25 nos
   moldes que já têm esboço (#4, #42, #7).
