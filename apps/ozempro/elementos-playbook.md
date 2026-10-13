# Playbook de elementos — OzemPro

> Síntese das 6 referências (`analise/criativos/ref-elementos-01..06.md`), traduzida para a nossa
> marca. **Base, não regra:** misturar as técnicas conforme a cena pedir, nunca copiar um estilo
> inteiro nem encaixar peça pronta.

---

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

## 3. Identidade: o que muda em relação às referências

| Elemento da referência | Nosso equivalente |
|---|---|
| acento amarelo (01), verde (02), azul (03/06), laranja (04/05) | **roxo `#8630E4`** |
| fundo bege / branco / navy | **`#12091F`** (escuro) ou **off-white `#F6F2FC`** |
| mascote pixel laranja | **panda 3D** |
| prints de terminal e GitHub | **telas reais do app** no mockup |
| fonte sans genérica | **Montserrat** (negrito nos títulos, semibold no resto) |

**Cores com significado**, válidas em todo criativo:

| Cor | Hex | Significa |
|---|---|---|
| Roxo | `#8630E4` | o app, a solução, o acerto |
| Vermelho | `#E53935` | erro, desperdício, dose perdida, cancelado |
| Verde | `#1FA84F` | confirmado, resolvido, grátis |
| Amarelo | `#FFD600` | alerta e destaque (marca-texto, pílula de atenção) |
| Branco | `#FFFFFF` | dado neutro, superfície de cartão |

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
