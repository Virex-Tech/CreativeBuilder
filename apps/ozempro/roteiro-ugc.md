# Diretriz estrita de roteiro — UGC curto (OzemPro)

> Regra da equipe (07/10/2026). Vale para **todo** roteiro de criativo do OzemPro, inclusive os de
> animação com o panda. Vence qualquer referência: se o vídeo de referência fugir disso, segue-se
> esta diretriz.

## Duração

**Média de 30 a 40 segundos** — é referência, não regra de cronômetro. Passar 1 ou 2 segundos não
é problema; não vale gastar tempo ajustando detalhe para fechar na casa exata. O mesmo vale para a
virada: por volta dos 10s.

## Linha do tempo

| Tempo | O que acontece |
|---|---|
| **0–10s** | **Hook + desenvolvimento da dor.** O gancho bate na dor com fator "uau" e pânico imediato, misturando os Tiers da Masterlist. O desenvolvimento da dor é extremamente breve: no máximo 10 segundos no total. |
| **10s** | **Ponto de virada.** O OzemPro é apresentado como solução exatamente no segundo 10. |
| **10s → CTA** | **Regra das 3 funcionalidades**, em formato "flash" (telas rápidas, uma ideia por tela). |
| **final** | **CTA rápido**, sempre direcionando a ação. |

## Os 4 hooks (regra da equipe, 11/10/2026)

Todo criativo abre com **quatro hooks ao mesmo tempo**, nos primeiros segundos. Um não substitui
o outro: quem assiste sem som precisa ser fisgado pelo visual e pelo texto; quem assiste com som
precisa ser fisgado pela fala e pelo som.

| Hook | O que é | Onde vive |
|---|---|---|
| **Falado** | a primeira frase da narração, começando no quadro 0 | roteiro / `audio.voiceover` |
| **Visual** | o que acontece na imagem: cena forte, elemento, desenho, gráfico entrando | take do panda, b-roll ou elemento desenhado no renderer |
| **Texto** | a frase na tela, alinhada com a fala (não precisa ser idêntica) | layer `text`/`karaoke` |
| **Sonoro** | impacto, riser, alerta ou notificação marcando a abertura | `audio.sfx` em `render/public/sfx/` |

Regras:

- Os quatro entram **nos primeiros 3 segundos** e falam da mesma dor — nada de texto dizendo uma
  coisa e imagem mostrando outra.
- O hook sonoro é **um só**, curto, no primeiro corte. Dois sons brigando viram ruído.
- O hook visual precisa ser **ancorado** na cena (ver seção de elementos), nunca enfeite solto.

## Inserções e legenda (padrão das referências, 11/10/2026)

Tirado das 5 referências em `analise/criativos/ref-elementos-0*.md`. **O formato de gravação não
importa** — selfie, POV, animação, tela cheia, tanto faz. O que define o estilo é onde as coisas
entram e com que ritmo.

**Duas zonas fixas:**

- **topo (até ~35% da altura):** é onde entram as inserções. Nenhuma legenda aqui.
- **rodapé:** legenda, sempre no mesmo lugar.
- Elemento nunca cobre a tela do app nem o rosto de quem fala.

**Ritmo:** uma inserção nova a cada **2 a 4 segundos** (as referências ficam entre 22 e 70 por
minuto). Pode respirar 2 ou 3 segundos sem nada, não mais que isso.

**O elemento ilustra a palavra dita naquele instante** — entra com a fala e sai quando o assunto
muda. Se não ilustra nada, não entra.

**Vocabulário permitido** (o que as referências usam): cartão com título e dado, chip, selo de
check/X, marca-texto, tachado, carimbo, círculo à mão, contador que sobe, gráfico que se desenha,
barra que cresce, barra de progresso, calendário, pódio com confete, campo de comentário digitando,
print do app dentro de cartão.

**Proibido:** emoji solto flutuando, seta genérica, tremida, zoom animado como efeito. Emoji só
dentro de um cartão próprio, raramente.

**Entrada e saída:** pop de ~0,2s para entrar; fade de ~0,3s ou corte seco para sair.

**Legenda:**

- Montserrat, caixa alta, **no máximo 3 palavras** por tela.
- A palavra sendo falada fica **roxa** (`accent`); as outras, brancas.
- Contorno por **sombra preta difusa** em camadas — nada de traço duro, que dá cara de adesivo.

**Áudio:** as referências usam **só voz**, sem música. Efeitos sonoros pontuais, dos que estão em
`render/public/sfx/`.

## Regra das 3 funcionalidades

1. **Função principal** — a solução direta e lógica para a dor levantada no hook.
2. **Função complementar 1** — uma função extra para gerar valor. Não precisa ter ligação com a
   dor principal.
3. **Função complementar 2** — mais uma utilidade, para mostrar o quanto o app é completo.

## CTA

Fechamento rápido, sempre com a ação:

> "Clica no link aqui embaixo, baixa o OzemPro e..."

## Roteiro que escalou (use de modelo)

Dor do hook: **erro no fracionamento** (Tier 1), encadeada com flacidez, queda de cabelo e fadiga
(Tier 2). Repare: empilha dores, tira a culpa da pessoa, apresenta o app e só então dispara as 3
funções em flash.

> "O que acontece com seu corpo se você usar as canetas incorretamente? Primeiro vem o pânico de
> errar a matemática da dose e perder dinheiro ou ir parar no hospital. Depois, se não come
> proteína, seu músculo desaparece, o cabelo cai aos chumaços e a fadiga crônica te impede de sair
> da cama. Mas a culpa não é do medicamento, e sim de tentar fazer tudo às cegas sem ajuda. E por
> isso existe OzemPro. Tem uma calculadora exata para saber quantos 'risquinhos' puxar. Usa
> inteligência artificial para ler a foto do seu prato e calcular sua meta de proteína. Além de
> registrar o local da aplicação e te avisar a hora exata da sua próxima injeção. Clique no link
> abaixo, baixe o OzemPro e assuma o controle do seu tratamento."

O que esse roteiro faz, na ordem: pergunta de pânico → consequência financeira/hospital →
consequências físicas em cadeia → **tira a culpa** ("a culpa não é do medicamento") → nome do app →
função principal → complementar 1 → complementar 2 → CTA.

Dores disponíveis para o hook: `masterlist-dores.md`.

## Cuidado com promessa e afirmação (regra da equipe, 07/10/2026)

A moderação da Meta reprova anúncio que afirma o que vai acontecer com o corpo de quem assiste.
Ao escrever:

- troque afirmação por possibilidade: "a balança **trava**" → "a balança **pode** travar";
- descreva **o que o app faz**, nunca o resultado que a pessoa terá;
- nada de "exato", "garantido", "sempre", nem número de quilos ou prazo;
- a dor pode ser dura, mas em forma de pergunta ou cenário, não de diagnóstico de quem assiste.

## O que isso NÃO muda

- A regra de compliance continua: nunca falar nem escrever o nome do medicamento (ver
  `contexto.md`). Use canetinha, moun, tirze, picadinha.
- Defeito visual em animação (número distorcido, objeto que some, mão estranha) **não é motivo para
  cortar** — ver `material-panda.md`.

## Elementos na tela (regra da equipe, 07/10/2026)

**Emoji solto flutuando sobre a cena não serve** — mesmo que combine com o assunto, fica jogado e
sem sentido. Testado em 07/10/2026 e reprovado.

Elemento só entra quando está **ancorado** em algo da cena:

- aponta para um objeto que está no quadro (seta até a balança, círculo na caneta);
- sai de dentro da ação (o dinheiro voa junto com o que foi jogado no lixo);
- reage a um movimento do personagem, no mesmo instante;
- ou é texto curto que continua a frase falada, no mesmo ritmo da legenda.

**Como usar elemento: `elementos-playbook.md`** — a síntese das 6 referências com a nossa marca
(molde de cartão, cores com significado, os 4 lugares onde o elemento pode viver, o que faz ele
parecer vivo e o ritmo de alternância). Base, não regra: misturar conforme a cena pedir.
