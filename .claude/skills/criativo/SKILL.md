---
name: criativo
description: Cria, varia e renderiza criativos de vídeo para apps a partir de uma referência ou de um brief. Use quando o usuário pedir para fazer um vídeo/criativo/anúncio, mandar uma referência (link ou arquivo de vídeo), pedir variações de um criativo existente, ajustar um vídeo já feito (encurtar hook, trocar cena, outro idioma, outro formato), ou analisar performance de criativos a partir de métricas exportadas.
---

# Criativo

Produz criativos de vídeo para marketing de apps. O criativo é descrito por um
**`CreativeSpec`** (JSON) e renderizado pelo Remotion. Você nunca "edita vídeo": você
escreve e reescreve o spec.

**Raiz do projeto**: a pasta onde o repositório foi clonado (rode os comandos a partir dela).
Se algo falhar por ferramenta ausente, rode `node tools/doctor.mjs` e siga o que ele indicar.
**Renderer**: `render/` · **Ferramentas**: `tools/` · **Specs**: `render/specs/`
**Contrato do spec**: leia `render/src/spec.ts` antes de escrever um spec — é a
fonte da verdade dos campos, presets e tipos de layer aceitos.

## Princípio que não se quebra

**Texto e UI nunca vêm de modelo generativo.** Todo texto na tela, mockup de app, legenda,
CTA e logo é renderizado pelo Remotion. Higgsfield e fal entregam só imagem em movimento —
b-roll, atores, lip-sync. Modelo generativo erra letra, e uma letra errada denuncia o
anúncio como IA.

## Fluxos

### 1. Referência → criativo

Quando o usuário mandar um vídeo de referência (arquivo ou link):

```bash
node tools/ingest-reference.mjs "<caminho do vídeo>"
```

Isso detecta os cortes reais e extrai um frame em cada um, mais o áudio, em
`references/<nome>/`. Então:

1. **Leia os frames** (Read em cada `.jpg` do manifest) e o `manifest.json`.
2. Escreva o **blueprint**: para cada beat, o papel (`HOOK`/`PROBLEM`/`DEMO`/`PROOF`/`CTA`),
   o intervalo em ms, o que aparece na tela e o texto. Use `avgShotSec` do manifest como
   ritmo alvo.
3. **Copie só a estrutura e o ritmo — nunca frames, áudio ou marca da referência.**
4. Preencha o `CreativeSpec` com o conteúdo do app do usuário, respeitando o
   `DirectorProfile` (abaixo).
5. Mostre o blueprint ao usuário antes de renderizar.

**Fala da referência:** você não ouve o `audio.wav`, mas pode transcrever:
`python tools/transcribe.py references/<nome>/audio.wav --lang pt` → use o `text` (hook falado,
narração). A transcrição não traz tom de voz, música nem efeitos — pergunte se forem relevantes.
Views/curtidas não vêm da ingestão — use os números que o usuário der.

**Contexto do app:** antes de escrever qualquer spec, leia `apps/<slug>/contexto.md` (o que o
app faz, público, dores, funcionalidades, oferta, provas, tom, marca e **compliance**). As
regras de "Compliance — NUNCA" vencem brief e referência, como o bloco `never` do director.
Use as cores/fonte da seção "Marca" no `brandKit`. Se o arquivo não existir, copie
`apps/_modelo/contexto.md`, pergunte ao usuário o essencial (o que faz, público, dor, oferta)
e salve antes de seguir. Nunca invente provas (números, avaliações, depoimentos).

### 2. Brief → criativo

Sem referência, use um spec existente em `render/specs/` como esqueleto e
substitua o conteúdo. Pergunte o que faltar (app, oferta, duração, idioma) apenas se a
resposta mudar o resultado — caso contrário assuma e diga o que assumiu.

### 3. Renderizar

Sempre nesta ordem — **preview antes de MP4**:

```bash
# 1. validar (pega gap/overlap de cena, texto vazio, hook longo demais)
node tools/spec-tool.mjs validate render/specs/<spec>.json

# 2. embrulhar para --props (o Remotion recebe {"spec": {...}}, não o spec cru)
node tools/spec-tool.mjs props render/specs/<spec>.json

# 3. preview: um frame por cena, segundos em vez de minutos
cd render && npx remotion still src/index.ts Creative out/preview-<n>.png \
  --frame=<n> --props=./specs/props/<spec>.json

# 4. só então o vídeo
cd render && npx remotion render src/index.ts Creative out/<nome>.mp4 \
  --props=./specs/props/<spec>.json
```

**Olhe os PNGs com Read.** Um vídeo pode renderizar "com sucesso" e estar visualmente
quebrado — texto sobreposto, fora da safe area, ilegível. Renderizar sem olhar não é
validar.

### 4. Variações

Uma variação muda **uma dimensão** e registra qual. É isso que permite atribuir um
resultado a uma causa depois.

Dimensões: `hook_rewrite` · `hook_visual` · `pacing` · `cta` · `voice` · `persona` ·
`format` · `locale_swap`

```bash
# o patch contém SÓ as cenas que mudam (casadas por id); o resto vem do pai
node tools/spec-tool.mjs variant <pai.json> --mutation hook_rewrite --patch <patch.json>
node tools/spec-tool.mjs diff <pai.json> <filho.json>
```

`variant` refaz o `startMs` de todas as cenas automaticamente (reflow) e grava
`lineage.parentId` + `mutation`. **Mostre o diff ao usuário antes de renderizar.**

Para `locale_swap`: troque só textos e o `locale`. Mantenha `assetId` de b-roll e screen
recording — reaproveitar o asset caro é o que faz a versão em outro idioma custar ~10%.
Atenção: PT e ES ficam 20–30% mais longos que EN; se estourar, encurte cenas `flex`,
nunca as `locked`.

### 5. Ajustes em linguagem natural

| Pedido | Ação |
|---|---|
| "encurta o hook pra 1.8s" | `durationMs` da cena hook + reflow (o `variant` já faz) |
| "troca a cena 3 por X" | novo `prompt` na layer generativa |
| "legenda maior / mais pra cima" | trocar `preset` do texto |
| "faz em espanhol" | `locale_swap` |
| "versão 4:5 de 15s" | mutação `format` |
| "gera 4 variações do hook" | 4 filhos com `hook_rewrite`, cada um com ângulo diferente |

### 6. Análise de performance

Enquanto não houver integração com a Meta, o usuário exporta CSV do Gerenciador de
Anúncios. Cruze com os specs pelo `creativeId`.

Calcule e **diagnostique por posição**:

- **Hook rate** = `video_continuous_2_sec_watched_actions` ÷ `impressions` → os 2s iniciais
- **Hold rate** = `video_p75_watched_actions` ÷ `video_play_actions` → corpo e ritmo
- **CTR outbound** → oferta e CTA
- Quartis `p25→p50→p75→p95` → em qual trecho o público cai

Regra de leitura:

| Sintoma | Diagnóstico | Mutação |
|---|---|---|
| hook rate baixo | ninguém passa dos 2s | `hook_rewrite` (4 ângulos) |
| hook ok, cai no p25–p50 | ritmo/corpo | `pacing` |
| chega ao p75 e não clica | oferta | `cta` |
| frequência alta + CPM subindo | fadiga | `hook_visual` |

**Nunca decida por CPA/instalação por criativo**: no iOS a Meta só atribui instalação no
nível de campanha. Use CPA da campanha como trava, nunca como critério de matar/escalar um
criativo.

Antes de qualquer conclusão, exija volume mínimo: ~2.000 impressões, ~$20 de gasto e 24h.
Abaixo disso, diga que ainda não dá para concluir.

## DirectorProfile

Regras de edição por app, em `directors/<app>.yaml`. Leia antes de escrever qualquer spec e
respeite o bloco `never` — ele vence brief e referência. Se não existir para o app, pergunte
se quer criar ou use os defaults do renderer.

## Estado atual — o que ainda não existe

Saída de imagem e carrossel, publicação e ingestão automática de métricas. (Já existem: transições,
efeitos sonoros, zoom em imagem estática e legenda sincronizada com a voz — veja as seções acima.)

**Áudio já funciona**: `spec.audio.voiceover` (com `atMs` e `durationMs`) e `spec.audio.music`
(com `duckingDb`). Arquivos locais em `render/public/`. Sempre declare a duração da
voz — sem ela a música fica abafada até o fim. Layers de mídia sem asset
renderizam um placeholder com o prompt — é o esperado enquanto o spec é rascunho.

Se houver arquivo local de vídeo ou screen recording, use `src` na layer — vale mais que
gerar.

## Material do app (gravação de tela e prints)

O usuário coloca os arquivos em `render/public/app/<app>/` (ex: `render/public/app/tapfit/`).
Na layer `app_screen_recording`, `src` aponta para o caminho relativo a `public/`
(ex: `"src": "app/tapfit/treino-aleatorio.mp4"`). Aceita **vídeo** (`.mp4/.mov/.m4v/.webm`,
toca mudo dentro do mockup) ou **imagem** (`.png/.jpg`). `device: "none"` tira o mockup.

Dois modos, escolha pelo que existe na pasta:

- **Com material do app** → cenas de demo com `app_screen_recording` + `src`. Corte a
  gravação para o trecho da cena (ffmpeg) se ela for longa.
- **Sem material do app** → não use `app_screen_recording` (renderiza placeholder). Monte
  o criativo com b-roll gerado + texto + CTA (problema → promessa → CTA). **Nunca gere a tela
  do app com modelo generativo** — UI inventada erra letra e mente sobre o produto.

## Material anexado (pasta `entrada/` ou Google Drive)

O usuário anexa vídeos e imagens de dois jeitos:

- **Pasta `entrada/`** na raiz do projeto (fora do git): ele arrasta os arquivos para lá.
- **Google Drive para computador:** monta o Drive como unidade (normalmente `G:\My Drive` e
  `G:\Shared drives`). Trate como pasta local. Se ele mandar só um link do Drive, peça o caminho
  no `G:\` ou que ele baixe o arquivo para `entrada/`.

- **Analisar:** imagens → Read direto. Vídeos → `node tools/ingest-reference.mjs "<arquivo>"` e
  leia os frames. Para o que é **falado**, `python tools/transcribe.py "<arquivo>"`. Liste o que
  serve e por quê antes de usar.
- **Usar na edição:** **nunca referencie `entrada/` nem `G:\` no spec** — o render só enxerga
  `render/public/`. Copie o arquivo usado (se for longo, corte com ffmpeg para não pesar no git;
  para pular o começo sem cortar, use `startFromMs` na layer):
  - gravação/print do app → `render/public/app/<slug>/` → layer `app_screen_recording`
    (`"device": "none"` para tela cheia sem mockup; imagem estática entra por aqui também);
  - vídeo real em tela cheia (UGC, filmagem) → `render/public/broll/` → layer `generative_video`
    com `src` e `prompt` descrevendo o clipe (o campo é obrigatório; sem `assetId`).
- **Base para o Higgsfield:** o CLI aceita caminho local e sobe o arquivo sozinho. Custo antes
  (`generate cost` com os mesmos flags), ok do usuário, depois `create`.
  - `kling3_0`: `--start-image <arquivo>` e/ou `--end-image <arquivo>` (anima a partir da foto);
  - `seedance_2_0`: `--image-references <arquivo>` (até 9, repetindo o flag) e
    `--video-references <arquivo>` (até 3) para cenário/estilo/produto.
  Confira os params com `higgsfield model get <modelo>` antes.
- **Direitos:** rosto de pessoa real só com autorização; música de terceiros não vai para o
  anúncio (use o áudio do spec); nunca use imagem de tela do app como referência para gerar UI.
  O compliance de `apps/<slug>/contexto.md` vale para material do Drive e para o que for gerado
  a partir dele.

## Padrão de qualidade (vale para todo criativo)

O usuário exige vídeo **o mais real e humanizado possível**, **voz natural** e **edição
profissional**. Nada pode ter cara de IA.

### Modelos de criativo

Comece sempre de um modelo em `render/specs/_modelos/` (veja o `LEIA-ME.md` de lá) e pergunte
qual padrão o usuário quer se ele não disser: **ia-total** (tudo gerado), **app-demo** (com
gravação do app) ou **imagem-final** (imagem estática no fim). Regras de todos:
- **toda cena tem vídeo ou imagem** — nunca só fundo + texto;
- o clipe cobre a cena inteira (gere com `duration` ≥ duração da cena, ou use `startFromMs`/outro
  trecho); se uma cena for longa, divida em dois planos;
- com voz, legenda `karaoke` sincronizada (seção abaixo); sem voz, legenda de texto;
- use `transitionIn` nas cenas e `audio.sfx` discretos nos cortes (`render/public/sfx/`); imagem
  estática ganha zoom lento automático;
- textos nas faixas padrão do renderer (hook no terço inferior-médio, legenda embaixo) — não
  invente posição.

### Imagem real (Higgsfield)

- **Prompt de UGC real:** "filmado com iPhone na mão", luz natural, ambiente comum (casa,
  cozinha, rua, academia de bairro), pessoa comum com roupa do dia a dia, pequenas imperfeições
  (tremor leve, foco que respira), sem "cinematic", sem pele de plástico, sem cores saturadas.
  Descreva idade, aparência e ação concreta. Escreva o prompt em inglês.
- **Nunca** texto, logo ou tela de app no prompt.
- **Qual modelo** (confira preço com `generate cost` antes — o saldo é limitado):

| Uso | Modelo | Custo aprox. |
|---|---|---|
| b-roll de ação/ambiente (padrão) | `kling3_0` 9:16, `--sound off` | 6,25 cr / 5s |
| plano principal com mais nitidez | `kling3_0_turbo` `--resolution 1080p` | 10 cr / 5s |
| **pessoa falando para a câmera** (UGC) com fala nativa | `veo3_1` 9:16 (4/6/8s) | 11 cr / 4s |
| animar uma foto real do usuário | `kling3_0 --start-image <foto>` | 6,25 cr / 5s |

Pessoa falando: escreva no prompt a fala exata em português entre aspas e o tom ("conversando,
natural, sem parecer propaganda"). Transcreva o resultado com `transcribe.py` para conferir se
falou certo antes de usar.

### Voz humana

- Roteiro **falado**, não escrito: frases curtas, coloquiais, com pausas (vírgulas, reticências),
  como alguém contando para uma amiga. Leia em voz alta mentalmente; se soa como locutor de
  comercial, reescreva.
- Padrão: `text2speech_v2 --variant elevenlabs` (voz multilíngue, ~0,3 cr). Voz nativa pt-BR:
  `inworld_text_to_speech --voice "Maitê (pt)"` ou `"Heitor (pt)"` (~2 cr). Quando o usuário
  escolher a voz de um app, registre em `apps/<slug>/contexto.md` (seção Marca) e use sempre a mesma.
- Música sempre abaixo da voz (`duckingDb`), volume da música baixo; sem música de terceiros.
- Trocar a voz de um vídeo já pronto: workflow `voice_change`.

### Outros idiomas

1. Gere a variação com `variant --mutation locale_swap` traduzindo textos e karaokê (adapte, não
   traduza literal; PT/ES ~20–30% mais longos — encurte cenas `flex`).
2. Locução nova no idioma (mesma voz se possível) → `transcribe.py --lang <en|es|...>` →
   `sync-captions`.
3. Vídeo com pessoa falando (UGC/Veo): workflow `dubbing` com `target_language` (por, spa, eng...).
4. Compliance do país vale (`apps/<slug>/contexto.md`).

### Validar antes de entregar (obrigatório)

1. `node tools/spec-tool.mjs check render/specs/<spec>.json` → zero `errors`; resolva os `warnings`
   (cena sem visual, clipe mais curto que a cena, legenda não sincronizada).
2. Stills dos momentos-chave (hook, cada troca de cena, CTA) → **olhe com Read**.
3. Depois do MP4: `node tools/review.mjs render/out/<nome>.mp4` → abra a folha de contato com Read e
   leia o JSON de áudio (silêncios longos, volume). Critique como editor: tem cena parada? texto
   ilegível? cara de IA? voz robótica? Corrija e re-renderize antes de mostrar.
4. Diga ao usuário o que conferiu e o que não dá para conferir (você não ouve o áudio — peça para
   ele ouvir a voz na primeira vez).

**Rapidez sem perder qualidade:** stills antes do MP4; gere b-roll só depois do roteiro aprovado;
reaproveite clipes nas variações; um MP4 de ~20s renderiza em 1–2 min.

## Locução e legenda sincronizada (karaokê)

A layer `karaoke` destaca a palavra falada na cor `accent`. Para o destaque seguir a voz:

1. **Locução.** Áudio do usuário (gravação, narração): copie para `render/public/audio/`. Sem áudio,
   gere no Higgsfield — mostre o custo e peça ok antes do `create`:
   - `higgsfield voices list` → escolha a voz;
     `higgsfield generate cost text2speech_v2 --prompt "<roteiro falado>" --variant elevenlabs --voice_id <id> --voice_type preset` (~0,3 crédito);
   - voz nativa em português: `higgsfield generate cost inworld_text_to_speech --prompt "<roteiro>" --voice "Maitê (pt)"` (ou `"Heitor (pt)"`, ~2 créditos);
   - `higgsfield generate create <mesmos flags> --wait --json` → baixe para `render/public/audio/<spec>-vo.mp3`.
2. **Spec:** `audio.voiceover` com `src` (ex: `audio/<spec>-vo.mp3`), `atMs` (quando a voz começa),
   `durationMs` (duração do arquivo — `ffprobe`) e `script`.
3. **Legenda:** uma layer `karaoke` por cena com **exatamente o trecho falado** naquela cena.
4. **Tempos:** `python tools/transcribe.py render/public/audio/<arquivo> --lang pt` → `<arquivo>.words.json`.
5. **Sincronizar:** `node tools/spec-tool.mjs sync-captions render/specs/<spec>.json --words render/public/audio/<arquivo>.words.json --fit-scenes`
   → preenche `wordEndsMs` e, com `--fit-scenes`, ajusta a duração das cenas faladas para cortar no
   ritmo da voz (use sempre, salvo cena `locked` que precise manter tempo). Resultado sem `warnings`.
   Depois confira se os clipes ainda cobrem as cenas (`check`).
6. **Conferir:** `props` → `still` em 2–3 momentos da fala; a palavra destacada tem que ser a dita.

Sem locução, a legenda divide o tempo da cena igualmente — serve para vídeo sem voz.

## B-roll com o Higgsfield (CLI / MCP, aqui no Claude Code)

A geração roda **nesta máquina**, pela conta Higgsfield logada (OAuth) — sem API key e sem
passar pelo servidor. Use o MCP do Higgsfield se estiver conectado; senão, o CLI
(`higgsfield`, alias `hf`). Conferir login e saldo: `higgsfield account status`.

Para cada layer `generative_video` sem `src`:

```bash
# 1. parâmetros aceitos pelo modelo (aspect_ratio, duration, mode...)
higgsfield model get kling3_0

# 2. custo ANTES de gerar — mostre ao usuário e só siga com o ok dele (gasta créditos)
higgsfield generate cost kling3_0 --prompt "<prompt da layer>" --aspect_ratio 9:16 --duration 5 --sound off

# 3. gerar e esperar a URL
higgsfield generate create kling3_0 --prompt "<prompt da layer>" --aspect_ratio 9:16 \
  --duration 5 --sound off --wait --wait-timeout 20m --json
```

`--sound off` sempre: o áudio vem do Remotion, e o som do modelo encarece (Kling 3.0 5s:
10 → 7.5 créditos). Os valores de `duration` mudam por modelo (Veo 3.1 Lite: 4/6/8;
Seedance 1.5: 4/8/12) — confira no `model get` antes.

4. Baixe o vídeo para `render/public/broll/<spec>-<scene-id>.mp4` e preencha a layer:
   `"src": "broll/<spec>-<scene-id>.mp4"`, `"assetId": "<job id>"`, `"provider": "higgsfield"`.
   **Não deixe a URL do Higgsfield no `src`**: ela expira em ~7 dias.
5. Rode `validate` → `props` → `still` e olhe o frame antes do MP4.

Modelos de vídeo: `higgsfield model list --video`. Sempre `9:16` (ou `3:4`/`1:1` na mutação
`format`), `duration` ≥ a duração da cena. Nunca peça texto, logo ou UI no prompt — isso é
do Remotion.
