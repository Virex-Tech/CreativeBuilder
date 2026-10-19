# CreativeBuilder — guia do agente (Claude Code / Codex)

Este arquivo dá a um agente de IA (Claude Code, Codex ou outro) o mesmo fluxo que o skill
`.claude/skills/criativo/SKILL.md` dá ao Claude. As ferramentas são scripts `node` puros —
não dependem de nenhum agente específico. Rode da raiz do repositório.

## O que é

Produz criativos de vídeo para apps. O criativo é um **`CreativeSpec`** (JSON) renderizado
pelo Remotion. Você nunca "edita vídeo": você escreve e reescreve o spec.

- Contrato do spec (fonte da verdade): `render/src/spec.ts` — leia antes de escrever um spec.
- Specs de exemplo: `render/specs/*.json`
- Direção por app (ritmo, transições, legendas): `directors/<app>.yaml`

## Regra que não se quebra

**Texto e UI nunca vêm de modelo generativo.** Todo texto, mockup de app, legenda, CTA e
logo é renderizado pelo Remotion. Higgsfield/fal entregam só imagem em movimento (b-roll).
Modelo generativo erra letra, e uma letra errada denuncia o anúncio como IA.

## Fluxo 1 — Referência → criativo

Referência pode ser um arquivo de vídeo ou um link.

```bash
# arquivo local:
node tools/ingest-reference.mjs "<caminho do vídeo>"
# link (baixe antes com yt-dlp, depois ingira o arquivo):
yt-dlp -f "bv*+ba/b" --merge-output-format mp4 -o /tmp/ref.mp4 "<link>"
node tools/ingest-reference.mjs /tmp/ref.mp4
```

Isso extrai frames nos cortes reais + áudio em `.cache-ingestao/<nome>/` e escreve um
`manifest.json`. Então:

1. **Leia os frames** (cada `.jpg`) e o `manifest.json`.
2. Escreva o **blueprint**: para cada beat, o papel (`HOOK`/`PROBLEM`/`DEMO`/`PROOF`/`CTA`),
   o intervalo em ms, o que aparece na tela e o texto. Use `avgShotSec` como ritmo alvo.
3. **Copie só a estrutura e o ritmo — nunca frames, áudio ou marca da referência.**
4. Preencha o `CreativeSpec` com o conteúdo do app, respeitando o `DirectorProfile`.
5. Mostre o blueprint ao usuário antes de renderizar.

Fala da referência: `python tools/transcribe.py .cache-ingestao/<nome>/audio.wav --lang pt` dá o texto
falado (sem tom, música ou efeitos). Views/curtidas não vêm da ingestão.

## Os três arquivos que mandam no criativo (leia ANTES de escrever roteiro ou spec)

Não existe "criativo rápido" que pule isto. Em ordem de precedência:

1. `apps/<slug>/contexto.md` — produto, público, dores, oferta, provas, tom, marca e
   **compliance**. Compliance vence brief, referência e ângulo de concorrente.
2. `apps/<slug>/roteiro-ugc.md` — como o roteiro é escrito: os formatos, os hooks, o que é
   proibido dizer, onde cada coisa fica na tela.
3. `apps/<slug>/elementos-playbook.md` — o que pode aparecer na tela como elemento, e o que a
   equipe já reprovou (inclui os **moldes de interface**: nota, conversa, busca, aviso…).

Junto com esses três, desde 18/10/2026 (OzemPro):

- `apps/<slug>/formatos.md` — as **embalagens** (os 100 formatos do PDF filtrados pelo
  compliance: 65 entram, 35 fora com o motivo), estático e carrossel, método de teste e as
  etiquetas do nome do anúncio. Todo criativo escolhe dor + hook + embalagem + produção.
- `apps/<slug>/mercados.md` — o que muda por **país e idioma** além da tradução (apelido,
  prática de uso, dores, mocks, moeda, regulação). O que está "a definir" é pergunta para a
  equipe, não regra.
- `apps/<slug>/pauta-gravacao.md` — o que gravar com cada pessoa, os takes do panda a gerar e as
  telas do app que faltam, por embalagem.
- Etiquetas na ficha: `analise/criativos/_modelo-ficha.md`, seção "Etiquetas".

As regras da equipe que mais foram quebradas por agente novo — todas detalhadas no
`roteiro-ugc.md`:

- **Frase de efeito é proibida.** Slogan, antítese, frase genérica bonita: não existe, em nenhum
  formato, em nenhum idioma, nunca. No lugar: **conexão**, **fator uau**, **polêmica**.
- **O hook de texto não repete a narração.** Ele é a linha de impacto, e fica até ~4 s na tela.
- **Três posições na vertical, e só três:** inferior y≈75, centro y≈50, topo y≈25. Nada acima de
  y 18 nem abaixo de y 82 (a interface da rede social cobre).
- **Elemento nunca com legenda por cima**, e **cena com a tela do app não leva legenda**.
- **O panda nunca fala em primeira pessoa** — ele é personagem. Primeira pessoa só com pessoa
  real.
- **A Calculadora de Doses entra em todo criativo**, exceto quando o pedido é recriar uma
  referência exatamente como ela é — aí a referência manda.
- **Nunca presumir a condição de quem assiste** (peso, corpo, se usa caneta).
- Elemento reprovado não volta: círculo à mão (`scribble` circle), emoji solto, cartão com
  frase solta.

## Contexto do app

Antes de escrever qualquer spec, leia `apps/<slug>/contexto.md`: produto, público, dores,
oferta, provas, tom, marca (`brandKit`) e **compliance** — as regras de compliance vencem brief
e referência. App sem contexto: copie `apps/_modelo/contexto.md`, pergunte o essencial ao
usuário e salve antes de seguir. Nunca invente provas.

## Fluxo 2 — Brief → criativo

Sem referência, use um spec de `render/specs/` como esqueleto e troque o conteúdo. Pergunte
só o que muda o resultado (app, oferta, duração, idioma); o resto, assuma e diga o que
assumiu.

## Fluxo 3 — Renderizar (sempre preview antes do MP4)

```bash
node tools/spec-tool.mjs validate render/specs/<spec>.json     # gap/overlap, texto vazio, hook longo
node tools/spec-tool.mjs props    render/specs/<spec>.json      # embrulha p/ --props
cd render && npx remotion still  src/index.ts Creative out/preview.png --frame=<n> --props=./specs/props/<spec>.json
cd render && npx remotion render src/index.ts Creative out/<nome>.mp4     --props=./specs/props/<spec>.json
```

**Olhe os PNGs (Read).** Renderizar "com sucesso" não é validar — texto pode estar
sobreposto, fora da safe area, ilegível.

## Fluxo 4 — Variações (uma dimensão por vez)

Dimensões: `hook_rewrite` · `hook_visual` · `pacing` · `cta` · `voice` · `persona` ·
`format` · `locale_swap`.

```bash
node tools/spec-tool.mjs variant <pai.json> --mutation hook_rewrite --patch <patch.json>
node tools/spec-tool.mjs diff <pai.json> <filho.json>
```

O patch contém só as cenas que mudam (casadas por id); `variant` refaz o `startMs` de todas
(reflow) e grava `lineage`. Mostre o diff antes de renderizar. Em `locale_swap`, mantenha o
`assetId` do b-roll; PT/ES ficam 20–30% mais longos que EN — encurte cenas `flex`, nunca as
`locked`.

## Fluxo 5 — Takes gravados (conteúdo orgânico / UGC)

Quando o usuário mandar vídeos **gravados por uma pessoa** (takes) + referência + instrução, você é o
editor: escolhe os trechos, ordena, corta o que não presta e legenda. Nada é gerado — a fala dos
takes é o conteúdo.

```bash
node tools/takes.mjs preparar entrada/<pasta> [outros arquivos ou links] --lang pt
node tools/takes.mjs listar          # relê a fala de todos os takes já preparados
```

`preparar` converte cada take para `render/public/takes/<nome>.mp4` (H.264 30fps — vídeo HEVC/HDR de
iPhone não abre no render), transcreve com o tempo de cada palavra (`<nome>.words.json`), tira 2
frames (`takes/<nome>/f1.jpg`, `f2.jpg`) e imprime a fala como `[início–fim] palavra@segundo ...`.

1. **Leia os frames** e a fala. Com referência, ingira (Fluxo 1) e siga o ritmo dela (`avgShotSec`,
   onde entra texto, duração) — nunca o conteúdo.
2. Spec: **cada cena = um trecho de um take**. A 1ª layer da cena é
   `{ "type": "footage", "takeId": "<nome>", "src": "takes/<nome>.mp4", "startFromMs": <entrada> }`
   (sem `startMs`/`durationMs`): a cena toca `take[startFromMs .. startFromMs + durationMs]`. Escolha
   pelos tempos das palavras.
3. Corte silêncio, "é…", "hã", frase repetida (fique com a **melhor** tentativa, geralmente a
   última), erro, fim de take. O **hook** é a frase mais forte, mesmo que tenha sido gravada depois.
   Jump cut do mesmo take: alterne `zoom` 1 e 1.12. Take de câmera frontal espelhado: `mirror: true`.
4. Título fixo no topo: layer `text` com preset `title_top`. **Não escreva a legenda da fala**: deixe
   `"autoCaptions": { "enabled": true, "maxWords": 4 }` no spec.
5. B-roll gerado só se pedirem; para cobrir mantendo a voz, na mesma cena: `footage` (com a fala) e
   depois `generative_video`.
6. **Sempre** depois de escrever ou mudar o spec:
   `node tools/spec-tool.mjs footage render/specs/<spec>.json` — puxa cada corte para a fronteira de
   palavra, tira sobreposição entre clipes do mesmo take e refaz a legenda da fala real em blocos.
7. Depois, o de sempre: `validate`, `check`, stills (Read), render, `review.mjs`.

A plataforma web faz este mesmo fluxo em `/estudio` (calendário por conta, aprovação e publicação
no Instagram) — ver `docs/ESTUDIO.md`.

### Onde o rosto está (posição do texto/elemento)

```bash
python tools/rosto.py render/specs/<spec>.json [--amostras 5] [--json saida.json]
```

Dependência: `pip install opencv-python` (modelo YuNet baixado sozinho para `tools/modelos/`, fora do
git). Por cena: faixa vertical do rosto (% da altura), quais das três posições (topo 18-32, centro
42-58, inferior 68-82) ficam livres e a recomendada. PNGs com a caixa em `render/out/_rosto/<cena>.png`
(**olhe**). Cena marcada INCERTO (vídeo borrado, rosto de lado) não vale: confira no PNG.

## Ajustes em linguagem natural

| Pedido | Ação |
|---|---|
| "encurta o hook pra 1.8s" | `durationMs` da cena hook + reflow (`variant` já faz) |
| "troca a cena 3 por X" | novo `prompt` na layer generativa |
| "legenda maior / mais pra cima" | trocar `preset` do texto |
| "faz em espanhol" | `locale_swap` |
| "versão 4:5 de 15s" | mutação `format` |
| "título fixo no topo" | layer `text` preset `title_top` |
| "[0:03] corta essa parte" (takes) | tira/encurta a cena desse trecho + `spec-tool footage` |
| "legenda com 3 palavras" (takes) | `autoCaptions.maxWords: 3` + `spec-tool footage` |

## Geração de b-roll e voz

> **Decisão da equipe (13/10/2026), vale para os criativos do OzemPro:**
> **vídeo → Higgsfield** (seção "Alternativa: Higgsfield" abaixo) e
> **voz → Google AI Studio** (`node tools/tts-gemini.mjs`, vozes Achernar e Orus).
> A Kie.ai documentada abaixo continua valendo para a plataforma e para quem preferir pré-pago.

### Kie.ai

O b-roll de IA (camadas `generative_video`) e a voz são gerados **por este agente**, pela chave
`KIE_API_KEY` do computador de quem está usando (pré-paga, sob demanda — cada pessoa cria a
própria conta e chave em https://kie.ai, nunca no repositório). Ferramenta: `node tools/kie.mjs`
(leia o topo do arquivo e `tools/kie-precos.json` antes de escrever).

```bash
node tools/kie.mjs saldo
node tools/kie.mjs modelos
node tools/kie.mjs custo   kling3 --duracao 5 --resolucao 720p
node tools/kie.mjs gerar   kling3 --prompt "..." --saida render/public/broll/<spec>-<scene-id>.mp4 \
  --duracao 5 --resolucao 720p --proporcao 9:16 --sim
```

Modelos: `kling3` (b-roll, com/sem som via `--audio`), `kling3-turbo` (b-roll rápido, sem som), `seedance-1.5` (b-roll barato p/ cena curta de fundo, 4–12s),
`veo3-fast` (pessoa falando — padrão UGC, 8s, fala/som nativos), `veo3-lite` (mais barato),
`veo3-quality` (caro, só com pedido explícito). `gerar`/`voz` só gastam saldo com `--sim` — rode
primeiro sem, mostre o custo em dólares ao usuário, peça ok e só então repita com `--sim`. O
script baixa o arquivo na hora (o link da Kie expira em 24h) e grava `<arquivo>.kie.json`. Na
layer: `src` (caminho relativo a `render/public/`), `assetId` (taskId), `provider: "kie"`.

**Limitação de áudio:** clipe gerado com som (Kling `--audio` ou fala do Veo) toca em volume
cheio — sem mixagem ainda. Cena com clipe de som próprio não leva locução nem música por cima;
cenas com locução usam clipe sem som.

**Testado em 21/09/2026 (conta real):**
- **Veo 3.1 Fast** funcionou: 8s, 720×1280, com fala em português e áudio, ~2 min para gerar,
  60 créditos (US$ 0,30) exatos — resultado de selfie UGC muito realista.
- **Prompt com fala entre aspas:** grave o prompt num arquivo e use `--prompt-arquivo <arquivo.txt>`
  (voz: `--texto-arquivo`). No PowerShell, aspas duplas no meio do argumento cortam o prompt — o
  primeiro teste saiu com a fala inventada por isso. Rodar sem `--sim` mostra início, fim e
  tamanho do prompt: confira antes de gastar.
- **Voz ElevenLabs pela Kie** falhou 3 vezes com erro interno deles ("Internal Error", sem
  cobrança). Até voltar: use a fala nativa do Veo (pessoa falando), gravação própria em
  `render/public/audio/`, ou a alternativa Higgsfield (`text2speech_v2`). Tente de novo de vez em quando.
- **Seedance 1.5 Pro** funcionou: 5s, 720×1280, 42s para gerar, 17,5 créditos (US$ 0,09) exatos.
  Luz e comida realistas, mas com defeitos de IA (mãos de duas pessoas, objeto fora do prompt):
  use só como fundo de 1–2s, não como cena principal.
- **Kling 3.0** ainda não foi gerado de verdade (usa o mesmo endpoint da voz, que respondeu
  normalmente à criação da tarefa).

### Alternativa: Higgsfield

Guardado para quem preferir mensalidade fixa com créditos (zeram todo mês) em vez do pré-pago da
Kie.ai. Setup uma vez: `npm i -g @higgsfield/cli && higgsfield auth login`; o MCP
(`https://mcp.higgsfield.ai/mcp`) é opcional — o CLI basta.

```bash
higgsfield account status                                  # login + créditos
higgsfield model get       kling3_0                         # params aceitos (duration varia por modelo)
higgsfield generate cost   kling3_0 --prompt "..." --aspect_ratio 9:16 --duration 5 --sound off
higgsfield generate create kling3_0 --prompt "..." --aspect_ratio 9:16 --duration 5 --sound off --wait --json
```

Mostre o custo e peça ok antes do `create` (gasta créditos). `--sound off` por padrão; com
som só quando a cena pede (ver a limitação de áudio acima). Baixe o resultado para
`render/public/broll/<spec>-<scene-id>.mp4` e preencha a layer com `src` (esse caminho),
`assetId` (job id) e `provider: "higgsfield"`. Não deixe a URL do provedor no `src`: expira em
~7 dias.

## Material do app (gravação de tela e prints)

Arquivos do app ficam em `render/public/app/<app>/<idioma>/` — **só o material do app é separado
por idioma** (`br`, `ltm`, `en`, `fr`, `tr`); panda, filmagens, referências, músicas e sfx são compartilhados.
Na layer `app_screen_recording`, use `"src": "app/<app>/<idioma>/<arquivo>"` — vídeo (`.mp4/.mov/.m4v/.webm`, toca mudo no mockup) ou
imagem (`.png/.jpg`). Sem material do app, não use essa layer: faça o criativo com b-roll +
texto + CTA. Nunca gere a tela do app com modelo generativo.

## Borrar o nome dos medicamentos nas gravações (regra da equipe, 16/10/2026)

**Todo nome de medicamento tem de ficar ilegível em toda gravação de tela, em todos os idiomas.**
**Só o nome**: mg, números, botões e o resto da interface ficam legíveis. Tela meio borrada não
se entrega.

### A REGRA (definida pela equipe em 18/10/2026 — vale para sempre, em todos os idiomas)

**Ler a palavra. É medicamento? Borra aquela palavra. Não é? Não borra. Lê a próxima. Fim.**

Uma caixa por palavra, do tamanho da palavra. **Palavra inteira**: fragmento não conta, e
**palavra incompleta** (chip cortado pela margem da tela) não é identificada, logo não é borrada.

Está proibido, em qualquer idioma e por qualquer motivo:

- juntar as palavras de uma linha num borrão só;
- esticar o borrão até a margem, até o vizinho ou até a próxima palavra;
- cobrir "o chip que o OCR não leu";
- reaproveitar a caixa do quadro anterior;
- fragmento de nome na lista de `--nomes` (foi assim que "lie", de *Lié*, casou dentro de
  "ca**lie**nte" e de "app**lie**d" e borrou palavra inocente — 18/10/2026).

A única folga é **erro de leitura**: o OCR troca letra em texto de baixo contraste ("Mounjaro" →
"Mouniaro"), então vale uma letra errada a cada cinco — **só** para nome de 7 letras ou mais,
senão "Olire" aceitaria "Olive" de uma receita. Nome curto exige grafia exata.

Toda vez que essa regra foi "melhorada", o resultado foi borrar o que tinha de ficar legível.
Não melhore.

Ferramenta: `tools/borrar-ocr.mjs`. Ela lê **cada quadro** com OCR (tesseract.js, roda na
máquina, sem API e sem crédito), acha onde está escrito o nome e borra exatamente ali. Sem
interpolar, sem rastrear: por isso o borrão acompanha a rolagem sozinho e some quando o nome sai
da tela.

```bash
node tools/borrar-ocr.mjs <video> --so-ler --idioma fra        # só relata o que achou
node tools/borrar-ocr.mjs <video> --saida <out.mp4> --idioma fra
node tools/borrar-ocr.mjs <out.mp4> --so-ler --idioma fra      # VALIDAR: tem de achar 0 nomes
```

`--idioma` usa os códigos do tesseract (`por`, `fra`, `eng`, `spa`, `tur`; vários com `+`).
`--nomes` troca a lista de marcas. `--raio` muda a força do borrão.

**A validação é automática e não se pula:** rodar `--so-ler` no vídeo **de saída**. Se ele achar
qualquer nome, o borrão falhou naquele quadro.

### Custo medido (16/10/2026, gravação de 10s a 30fps)

- ~3,5 s por quadro (três leituras) × número de passadas. Medido em 18/10/2026: tela de 7 s
  (210 quadros) = 26 min de borrão + 6 min de validação; tela de 10 s = ~31 min + 7 min. Quando
  a primeira passada não acha nada novo, para na primeira e sai pela metade do tempo.
- **Resolução cheia é obrigatória.** Em `--escala 0.5` o texto fica com 18 px e o OCR acha o nome
  em só 36 de 300 quadros. Em resolução cheia, 290 de 300.
- **Não dá para pular quadros parados.** Em br, medido, 0% dos quadros são idênticos ao
  anterior (ruído de compressão). Em latam a miniatura acusou 185 de 285 "iguais" — e estava
  errada: 18 deles tinham um chip que os anteriores não tinham. O atalho foi removido.

### Mais de uma ocorrência por quadro

Borra todas, cada uma na sua caixa — inclusive a tabela no fim do vídeo.

### Como o quadro é entregue ao OCR (16 e 18/10/2026)

O Tesseract tem duas limitações que decidem tudo aqui:

1. ele converte a imagem para preto e branco com **um único corte de brilho**, escolhido para a
   tela inteira, e isso acontece ANTES de tentar reconhecer letra;
2. ele só lê **texto escuro em fundo claro**.

Por isso o quadro passa por três preparos e **a palavra lida em qualquer um deles conta**:

| Leitura | Filtro | Pega |
|---|---|---|
| `c100i` | achatado, corte 100, invertido | chip selecionado (texto branco em fundo colorido) |
| `c190` | achatado, corte 190 | texto cinza claro em fundo cinza |
| `inv` | cinza invertido, sem achatar | o que o achatamento apaga dentro de chip colorido |

**Achatar** = dividir o quadro por uma cópia bem borrada dele mesmo. Remove qualquer variação
suave de luz (o escurecimento de um modal, o fundo colorido de um chip) e deixa só o desenho das
letras:

```
[0:v]format=gray,split=2[a][b];[b]gblur=sigma=60[bg];
[a][bg]blend=all_mode=divide,eq=contrast=1.6:brightness=-0.25
```

Medido no quadro 45 da aplicação em inglês (modal escurecendo a tela): 6 palavras lidas no
quadro cru, 50 no achatado, e o nome escurecido **só** aparece no achatado.

E no estoque em turco, com os três chips na tela — nenhuma leitura sozinha acha os três:

| | quadro 48 | quadro 164 |
|---|---|---|
| corte 100 invertido | Mounjaro | Mounjaro, Ozempic |
| corte 190 | Ozempic, Ozivy | Ozempic |
| cinza invertido | — | Ozempic, Ozivy |

**O preparo é só para LER.** O borrão é aplicado nos pixels originais; o vídeo entregue é a
imagem real, sem nenhum tratamento.

**O que foi tentado e não acrescenta nada:** faixas horizontais, fatias com sobreposição,
ampliar 2x, PNG no lugar de JPEG, e os modos de segmentação do Tesseract (psm 4, 6, 11, 12).
`rectangle` do tesseract.js não serve: a binarização continua sendo da imagem toda.

### Passadas: ler de novo até não achar palavra nova (18/10/2026)

O Tesseract lê um chip conforme os vizinhos. No quadro 164 do estoque em turco ele lia só
"Ozempic"; **depois que o "Ozempic" foi borrado, passou a ler o "Ozivy" ao lado**. Uma passada
só nunca ia achar os dois.

Então a mesma regra roda de novo: lê, acha a palavra, guarda a caixa dela; aplica o que já tem
num vídeo **provisório**; lê esse provisório; o que aparecer de novo vira mais uma caixa. Para
quando uma passada não acha nada novo (`--passadas`, padrão 4).

As caixas se **acumulam** e o vídeo entregue é gravado **uma vez só, a partir do original** — o
provisório serve só para ler e é descartado, então não há perda de qualidade empilhada.

### Cada quadro é lido por si (sem exceção)

Duas versões tentaram economizar leitura e as duas vazaram:

- reaproveitar a caixa do quadro anterior quando o nome não era achado. A caixa fica parada
  enquanto o conteúdo rola e passa a borrar o que não deve — cobriu "Constipação" no histórico
  do tratamento (16/10/2026);
- **pular quadro "igual ao anterior"** (comparação por miniatura). A miniatura dizia igual e não
  era: na calculadora em latam, 18 quadros saíram com o chip "Oziv" **legível**, porque a caixa
  reaproveitada era de antes do chip entrar na tela (18/10/2026).

Ler todo quadro custa ~1,4 s por quadro e é o preço da regra. Nenhum atalho de leitura entra
aqui de novo.

### Quais telas têm nome (levantado em 16/10/2026, nas 18 gravações em br)

**Só 5 das 18 telas mostram nome de medicamento.** Nos outros idiomas, rode o borrão completo
**só nessas cinco** e confirme as demais com `--amostra`, que é 5x mais rápido:

| Tela | Onde o nome aparece |
|---|---|
| `calculadora-...` | seletor "Medicamento (opcional)" |
| `comunidade-...` | manchetes das notícias e posts do feed |
| `estoque-...` | seletor de medicamento da unidade |
| `aplicacao-...` | campo "Medicamento" do registro |
| `tratamento-...` | histórico "Aplicado ▓▓▓" |

Sem nome: chat, água, atividade, efeitos colaterais, evolução, intestino, medidas, página
inicial, peso, receitas, registro refeição, resumo, suplementos.

```bash
node tools/borrar-ocr.mjs <tela com nome> --saida <out> --idioma por     # borrão completo
node tools/borrar-ocr.mjs <tela sem nome> --so-ler --amostra 10 --idioma por   # só confirmar
```

**Quando o resultado é zero, use o arquivo ORIGINAL** em vez do recodificado — recodificar sem
borrar nada só perde qualidade.

**Confirme olhando, mesmo com zero.** A validação por OCR compartilha os pontos cegos do OCR.
Em 16/10/2026 a página inicial deu 1 quadro com nome e era **falso positivo** (fragmento curto
da lista casando com outra palavra).

**Só canetinhas** (decisão da equipe, 16/10/2026). A tela de suplementos mostra o texto de
exemplo "Ex: Ômega 3, Metformina" — Metformina **não** se borra: não é GLP-1.

### As duas versões de cada gravação

```
render/public/app/ozempro/<idioma>/
  tela-cheia/<nome>.mp4   ← borrada, canto reto — para app em tela cheia (device: "none")
  mockup/<nome>.mp4       ← borrada + cantos arredondados — para device: "iphone15_mock"
```

Os cantos saem de `render/public/mockups/cantos-1080x2340.png` (raio 135, medido a partir do
recorte do mockup: tela de 845 px com raio ~62, e a gravação entra em escala 0,782). Aplicar é
um passe de ffmpeg:

```bash
ffmpeg -i <borrada>.mp4 -i render/public/mockups/cantos-1080x2340.png   -filter_complex "[0:v][1:v]overlay=0:0" -c:v libx264 -crf 18 -pix_fmt yuv420p -an <mockup>.mp4
```

Gravação de iPhone não traz o canto arredondado; a de Android trazia. Sem a máscara, o conteúdo
claro encosta na curva da moldura e denuncia o encaixe.

### O que NÃO funciona (tentado e descartado em 16/10/2026)

- **Medir a posição em alguns pontos e interpolar.** Falhou três vezes. A tela não só rola, ela
  muda, e 2% de erro já deixa o nome legível.
- **Caixa alta para cobrir o caminho da rolagem.** Borra metade da tela. Reprovado.
- **Rastrear o deslocamento da tela** (`tools/borrar.mjs rastrear`). Confunde-se quando o
  conteúdo muda, não só rola.
- **Procurar um rótulo vizinho** ao nome (`tools/borrar.mjs seguir`). Perde a âncora na rolagem
  rápida e quando ela passa sob o cabeçalho fixo.
- **`find_rect`/`cover_rect` do ffmpeg.** O chip muda de aparência ao ser selecionado e o filtro
  só acha um objeto por quadro.
- **Esticar o borrão para cobrir o que o OCR não leu** (até a margem, até o vizinho, até a
  próxima palavra). Reprovado pela equipe em 18/10/2026: borrou "Applied", "caliente" e a dose
  do histórico. Ver "A REGRA" no começo desta seção.

`tools/borrar.mjs` continua para borrão manual de região fixa, quando a tela não rola.

## A tela tem que ser a tela que a narração diz

Escolher `startFromMs` pelo começo do arquivo é erro. A gravação não segue a ordem da fala: a da
calculadora começa pelo **resultado** e só depois desce para o formulário; a de registrar
aplicação só mostra o **corpo e o local** aos ~7s; a de estoque só mostra a **caneta carregada**
nos últimos 0,8s.

Antes de escrever o `startFromMs` de cada cena:

```bash
node tools/recorte.mjs amostra render/public/app/<app>/<idioma>/<gravacao>.mp4
```

A grade de 6 quadros vem com os tempos. Escolha o trecho **pelo que ele mostra**, casando com a
frase daquela cena.

**Se o trecho certo for mais curto que a cena**, congele o quadro como imagem e use na mesma
layer (`app_screen_recording` aceita `.png`), com `anim: "punch_in"` para não ficar parado:

```bash
node tools/recorte.mjs cortar <gravacao>.mp4 --em 7.85 --saida render/public/app/<app>/<idioma>/<nome>.png
```

Erros desse tipo passam no `check` e no `validate` — só aparecem olhando o still com a legenda
em cima. Foi o que aconteceu em 15/10/2026, duas vezes no mesmo criativo.

## Imagem como elemento (Pexels e recorte do app)

Elemento de imagem usa o layer `image` (`radius`, `border`, `label`). Duas fontes:

```bash
node tools/pexels.mjs buscar foto "<termo>" --n 5 --orientacao portrait
node tools/recorte.mjs amostra <gravacao do app>.mp4          # grade de 6 quadros com tempos
node tools/recorte.mjs cortar  <gravacao do app>.mp4 --em 2.14 --area 4,11,92,30   --saida render/public/elementos/<nome>.png
```

Recorte de tela só entra em cena **sem** o mockup: quando o celular está em quadro, nada vai por
cima dele. Detalhes e o que está reprovado: `apps/<app>/elementos-playbook.md`.

## Material anexado (`entrada/` ou Google Drive)

O usuário anexa arquivos na pasta `entrada/` (fora do git) ou pelo Drive para computador, que
aparece como unidade (`G:\My Drive`, `G:\Shared drives`) — trate os dois como pasta local. Para o
que é falado num vídeo/áudio, `python tools/transcribe.py <arquivo>`. Para pular o começo de um
vídeo sem cortar, `startFromMs` na layer (`generative_video` e `app_screen_recording`). Analise imagens direto e vídeos com `tools/ingest-reference.mjs`. Nunca referencie
`G:\` no spec: copie só o trecho usado para `render/public/app/<slug>/` (tela do app, ou imagem em
tela cheia com `device: "none"`) ou `render/public/broll/` (vídeo real em tela cheia, layer
`generative_video` com `src` + `prompt` descritivo). Como base para a Kie.ai: `--imagem <arquivo>`
em `node tools/kie.mjs gerar <modelo> ...` (Kling: primeiro quadro; Veo: primeiro/último) —
alternativa Higgsfield: `kling3_0 --start-image/--end-image <arquivo>` ou `seedance_2_0
--image-references/--video-references <arquivo>` — custo e ok antes. Rosto real só com
autorização; sem música de terceiros.

## A transcrição pode truncar sem avisar (19/10/2026)

O `transcribe.py` (faster-whisper) às vezes **para antes do fim do áudio e não reclama**. Na
locução francesa do criativo do platô ele devolveu 138 palavras terminando em 24,4s para um áudio
de 29,6s — os últimos 5 segundos simplesmente não vieram. Como as fronteiras das cenas saem desses
tempos, o criativo inteiro cairia errado do meio para o fim.

**Confira sempre** que o `endMs` da última palavra bate com a duração do arquivo:

```bash
ffprobe -v error -show_entries format=duration -of csv=p=0 <audio>
node -e 'const w=require("./<audio>.words.json").words; console.log(w[w.length-1].endMs)'
```

Faltando pedaço, transcreva só o trecho que faltou (`ffmpeg -ss <seg> -i <audio> <fim>.wav`) e
emende somando o deslocamento aos tempos. O áudio está inteiro; quem falhou foi a leitura.

## Locução e legenda sincronizada (karaokê)

1. Locução: áudio do usuário em `render/public/audio/`, ou gere na Kie.ai (custo e ok antes):
   `node tools/kie.mjs voz --texto "..." --saida render/public/audio/<spec>-vo.mp3 --voz "Ana Rita" --sim`
   (alternativa Higgsfield: `text2speech_v2 --prompt "..." --variant elevenlabs --voice_id <id de hf voices list> --voice_type preset`
   ou `inworld_text_to_speech --prompt "..." --voice "Maitê (pt)"`).
2. Spec: `audio.voiceover` com `src`, `atMs`, `durationMs`, `script`; uma layer `karaoke` por cena com
   o trecho falado.
3. `python tools/transcribe.py render/public/audio/<arquivo> --lang pt`
4. `node tools/spec-tool.mjs sync-captions render/specs/<spec>.json --words render/public/audio/<arquivo>.words.json --fit-scenes --chunk 4`
   → preenche `wordEndsMs` e ajusta as cenas ao ritmo da voz; depois `check` (clipes ainda cobrem as cenas).
5. Stills em momentos da fala para conferir a palavra destacada.

## Criativos que deram certo (Meta Ads MCP oficial)

Servidor `meta-ads` em `.mcp.json` (`https://mcp.facebook.com/ads`, OAuth por usuário via `/mcp`,
sem app nem chave). **Somente leitura** — nunca criar/editar/pausar anúncios nem mexer em orçamento
sem autorização explícita (as ferramentas de escrita estão em `deny` no `.claude/settings.json`; só
subir vídeo, criar criativo e criar anúncio ficam em `ask`, para o rascunho pausado da seção TrendTrack).
**Regras e métricas de análise: só as de `analise/regras-meta-ads.md`** — nenhuma outra.
Fluxo: `ads_get_ad_entities` (nível anúncio, as métricas daquela página) → diagnóstico pelas regras
da equipe (Fase Zero, kill-switch, validação, escala) → detalhes do criativo → baixar o vídeo para
`entrada/<slug>/meta-ads/` → `ingest-reference` + `transcribe.py` → ficha em
`analise/criativos/<ad_id>.md` → variações de uma dimensão, respeitando o compliance do app.
Biblioteca de Anúncios da Meta: só consulta pontual pedida pelo usuário (termos proíbem coleta
automatizada), sem métricas.

## Concorrentes vencedores → criativo → rascunho na Meta

Pipeline em 3 etapas: **01** achar os anúncios vencedores dos concorrentes →
**02** recriar a estrutura para o app (Fluxo 1 + Kie.ai + render) → **03** subir o MP4 para a Meta
como anúncio **pausado** (rascunho). Chave `TRENDTRACK_API_KEY` no computador de cada pessoa
(TrendTrack → configurações do workspace → API; o admin precisa ter habilitado a Public API).
O TrendTrack é um serviço pago com API própria — diferente de raspar a Biblioteca de Anúncios.

**Três fontes para a etapa 01** (mesmo `concorrentes.json`; use a que estiver configurada):

| Fonte | Comando | Cobre | Custo |
|---|---|---|---|
| Biblioteca da Meta **oficial** (API) | `node tools/biblioteca.mjs vencedores --app <slug>` | só anúncio comercial veiculado na **UE/UK** (limite da Meta); dias no ar + alcance UE | grátis — `META_AD_LIBRARY_TOKEN` (verificação em facebook.com/ID) |
| **Manual** | `node tools/biblioteca.mjs baixar "<link do anúncio>" --app <slug>` | qualquer anúncio que o usuário escolher (inclusive só-Brasil) | grátis |
| TrendTrack | `node tools/trendtrack.mjs vencedores --app <slug>` (abaixo) | tudo, inclusive Brasil; alcance, transcrição | pago, por anúncio devolvido |

Nunca raspe o site da Biblioteca em lote (termos da Meta): só a API oficial e downloads pontuais
de anúncios que o usuário escolheu. O id da página de um concorrente está na URL da Biblioteca
(`view_all_page_id=`) ou sai do `trendtrack.mjs buscar`.

```bash
node tools/trendtrack.mjs saldo                                  # grátis
node tools/trendtrack.mjs buscar "nome, domínio ou @instagram"   # grátis → id da página
node tools/trendtrack.mjs vencedores --app <slug>                # gasta crédito POR anúncio devolvido
node tools/trendtrack.mjs baixar <adId> --app <slug>             # → entrada/<slug>/trendtrack/<adId>.mp4
```

1. **Concorrentes:** `apps/<slug>/concorrentes.json` (modelo em `apps/_modelo/`): páginas
   (`competitors[].pageId`, achadas com `buscar`), termos de copy (`keywords`), `countries`,
   `minDaysRunning` (vencedor = ativo há ≥ N dias, padrão 14) e `perSource` (máx. por fonte,
   padrão 5). Mesmo formato do pipeline "Concorrentes" da plataforma web.
2. **Vencedores:** rode `vencedores`, mostre a tabela (dias no ar, alcance, copy) e peça ao usuário
   quais recriar. Não baixe/recrie tudo por conta própria.
3. **Referência:** `baixar` → `node tools/ingest-reference.mjs <mp4> --out references/<slug>-tt-<adId>`
   → leia os frames. A fala vem em `entrada/<slug>/trendtrack/<adId>.json` (`ad.content.transcript`);
   se estiver vazia, `python tools/transcribe.py <mp4>`. Grave a ficha em
   `referencias/<slug>/tt-<adId>.md` (fonte: TrendTrack, sinais = dias no ar + alcance, sem métricas
   de conversão).
4. **Recriar:** Fluxo 1 — **só estrutura, ângulo do hook e ritmo**. Nunca a marca, o produto, o texto
   literal, rostos ou imagens do concorrente. O compliance de `apps/<slug>/contexto.md` vence o ângulo
   do concorrente. B-roll pela Kie.ai (custo e ok antes), render, `check` e `review.mjs`.
5. **Rascunho na Meta** (só com pedido do usuário): pelo Meta Ads MCP — `ads_creative_upload_video`
   → `ads_create_creative` → `ads_create_ad` com **status PAUSED** num conjunto que o usuário indicar
   (cada chamada pede confirmação). Nunca ative, nunca crie campanha/conjunto, nunca mexa em
   orçamento — publicar é sempre clique humano no Gerenciador. Informe o id do anúncio criado.

## Escopo: local e plataforma

Dois jeitos de usar, com o **mesmo contrato de spec** (`render/src/spec.ts`) e o mesmo renderer:

- **Local** (este guia): Claude Code (ou outro agente) + Kie.ai (vídeo e voz, chave só no
  computador de cada pessoa) + Remotion.
- **Plataforma web** (`web/` + `server/`, no ar): **Estúdio** `/estudio` — contas, calendário,
  takes, edição pela IA, aprovação e publicação no Instagram (`docs/ESTUDIO.md`) — e o pipeline
  **Concorrentes** `/apps/<id>/concorrentes` (TrendTrack → IA + b-roll + render → Meta pausado,
  `server/src/lib/pipeline.ts`; o formato de `concorrentes.json` é o mesmo).

O acabamento de takes tem **uma implementação só**: `render/src/footage.ts` (engine). O CLI
(`tools/spec-tool.mjs footage`) usa `render/lib/engine.mjs` e a plataforma usa
`server/src/lib/engine/footage.ts` — as duas são **geradas** dela por `cd render && npm run build:lib`
(commitadas; `npm run check:lib` falha se estiverem velhas, e o build Docker do render também). Mude
só `render/src/footage.ts`, rode `build:lib` e `npm test` em `render/`. O mesmo acabamento está no
serviço de render como `POST /footage/finalize` (contrato em `render/README.md`).
Antes de entregar qualquer criativo: `node tools/spec-tool.mjs check` e
`node tools/review.mjs` no MP4 (ver skill `criativo`, seção "Validar antes de entregar").
