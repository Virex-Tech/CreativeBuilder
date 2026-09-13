# Como usar — referência técnica

> **Primeira vez?** Comece por [`COMECE-AQUI.md`](../COMECE-AQUI.md) (instalação e uso sem jargão).
> Este documento é a referência dos comandos e campos — útil para quem quer entender ou rodar à mão.

Tudo roda **local**: Claude Code (ou Codex) + **Higgsfield CLI** (vídeo, voz) + **Remotion**
(edição e render). Sem plataforma web e sem API key. O criativo é um **`CreativeSpec`** (JSON) —
o agente nunca "edita vídeo", ele escreve e reescreve o spec. Contrato dos campos:
[`render/src/spec.ts`](../render/src/spec.ts).

Instruções que o agente segue: [`.claude/skills/criativo/SKILL.md`](../.claude/skills/criativo/SKILL.md)
(Claude Code) e [`AGENTS.md`](../AGENTS.md) (Codex e outros).

---

## 1. Pré-requisitos

- Node 22+, Git, `ffmpeg`/`ffprobe`, `yt-dlp` (referência por link)
- Python 3 + `python -m pip install faster-whisper` (legenda sincronizada e transcrição)
- `npm i -g @higgsfield/cli` + `higgsfield auth login` + `higgsfield workspace set <id do plano pago>`
- `cd render && npm ci` uma vez
- Conferir tudo: `node tools/doctor.mjs`

## 2. Fluxo completo

```bash
# 1. referência (opcional): arquivo ou link
yt-dlp -f "bv*+ba/b" --merge-output-format mp4 -o entrada/ref.mp4 "<link>"
node tools/ingest-reference.mjs entrada/ref.mp4            # frames nos cortes + audio.wav em references/<nome>/
python tools/transcribe.py references/<nome>/audio.wav --lang pt   # o que é falado na referência

# 2. spec: copie um modelo de render/specs/_modelos/ e preencha (contexto em apps/<slug>/contexto.md)

# 3. material: b-roll e voz no Higgsfield (seções 5 e 6), gravações do app, anexos (seção 7)

# 4. legenda sincronizada com a voz (seção 6)
python tools/transcribe.py render/public/audio/<spec>-vo.mp3 --lang pt
node tools/spec-tool.mjs sync-captions render/specs/<spec>.json --words render/public/audio/<spec>-vo.words.json --fit-scenes

# 5. validar, preview, render, revisar
node tools/spec-tool.mjs check render/specs/<spec>.json
node tools/spec-tool.mjs props render/specs/<spec>.json
cd render && npx remotion still  src/index.ts Creative out/preview.png --frame=<n> --props=./specs/props/<spec>.json
cd render && npx remotion render src/index.ts Creative out/<nome>.mp4 --props=./specs/props/<spec>.json
node tools/review.mjs render/out/<nome>.mp4                 # folha de contato + análise de áudio
```

## 3. Modelos de vídeo

Em [`render/specs/_modelos/`](../render/specs/_modelos/LEIA-ME.md):

| Modelo | Quando usar |
|---|---|
| `ia-total` | não há material do app — tudo gerado (b-roll em todas as cenas) |
| `app-demo` | há gravação de tela do app — demo dentro do mockup de iPhone |
| `imagem-final` | vídeo gerado + imagem estática no fim (print da loja, oferta) |

Regras de todos: toda cena tem vídeo ou imagem; legenda karaokê sincronizada quando há voz;
transições e efeitos sonoros discretos; textos nas faixas padrão (hook no terço inferior-médio,
legenda embaixo, acima da interface das redes).

## 4. Contexto do app e regras de edição

- `apps/<slug>/contexto.md` — produto, público, dores, oferta, tom, marca (`brandKit`),
  **compliance**. Modelo em `apps/_modelo/`.
- `directors/<slug>.yaml` — ritmo, legenda, câmera, bloco `never` (vence brief e referência).

## 5. Vídeo com o Higgsfield

Sempre `generate cost` antes e `create` só com ok (gasta créditos). Prompt em inglês, estilo UGC
real (iPhone na mão, luz natural, pessoa comum), nunca texto/logo/tela de app no prompt.

```bash
higgsfield account status
higgsfield model get kling3_0
higgsfield generate cost   kling3_0 --prompt "..." --aspect_ratio 9:16 --duration 5 --sound off
higgsfield generate create kling3_0 --prompt "..." --aspect_ratio 9:16 --duration 5 --sound off --wait --json
# baixe o result_url para render/public/broll/<spec>-<cena>.mp4 → layer generative_video: src, assetId, provider
```

| Uso | Modelo | Custo aprox. (9:16) |
|---|---|---|
| b-roll padrão | `kling3_0 --sound off` | 6,25 cr / 5s |
| plano principal mais nítido | `kling3_0_turbo --resolution 1080p` | 10 cr / 5s |
| pessoa falando para a câmera (fala nativa) | `veo3_1` (4/6/8s) | 11 cr / 4s |
| animar foto real | `kling3_0 --start-image <foto>` | 6,25 cr / 5s |
| referência de cenário/estilo | `seedance_2_0 --image-references <img>` | 22,5 cr / 5s |
| UGC com avatar (premium) | `marketing_studio_video` | ~75 cr / 15s |

Não deixe a URL do Higgsfield no `src` (expira em ~7 dias) — sempre baixe.

## 6. Voz e legenda sincronizada

```bash
# voz (se não houver gravação própria)
higgsfield voices list
higgsfield generate cost text2speech_v2 --prompt "<roteiro falado>" --variant elevenlabs --voice_id <id> --voice_type preset   # ~0,3 cr
higgsfield generate cost inworld_text_to_speech --prompt "<roteiro>" --voice "Maitê (pt)"                                  # ~2 cr (ou "Heitor (pt)")
# create com os mesmos flags --wait --json → render/public/audio/<spec>-vo.mp3

# tempos por palavra (local, grátis; 1ª vez baixa ~460 MB)
python tools/transcribe.py render/public/audio/<spec>-vo.mp3 --lang pt

# legenda: uma layer karaoke por cena com o trecho falado; depois:
node tools/spec-tool.mjs sync-captions render/specs/<spec>.json --words render/public/audio/<spec>-vo.words.json --fit-scenes
```

- `audio.voiceover`: `src`, `atMs` (quando começa), `durationMs` (duração do arquivo), `script`.
- `sync-captions` preenche `wordEndsMs` (fim de cada palavra) casando legenda e fala em ordem.
- `--fit-scenes` ajusta a duração das cenas faladas para cortar no ritmo da voz (entre a última
  palavra de uma cena e a primeira da próxima). Sem ele, `warnings` aponta fala fora da cena.
- `audio.music` com `duckingDb` abaixa a música enquanto a voz fala. Sem música de terceiros.
- Trocar a voz de um vídeo pronto: workflow `voice_change`.

## 7. Material próprio: app, anexos, Google Drive

| Onde fica | Para quê |
|---|---|
| `entrada/` (fora do git) | material bruto que o usuário arrasta |
| `G:\My Drive`, `G:\Shared drives` | Google Drive para computador — lido como pasta local |
| `render/public/app/<slug>/` | gravações de tela e prints usados no vídeo |
| `render/public/broll/` | clipes gerados ou vídeos reais em tela cheia |
| `render/public/audio/` | locuções e `.words.json` |
| `render/public/sfx/` | efeitos sonoros |

O spec **nunca** aponta para `entrada/` ou `G:\` — copie o arquivo usado para `render/public/`.

| Campo | Layer | Para quê |
|---|---|---|
| `src` | `generative_video`, `app_screen_recording` | caminho relativo a `render/public/` |
| `startFromMs` | `generative_video`, `app_screen_recording` | pula o começo do vídeo (`12000` = começa no 0:12) |
| `device: "none"` | `app_screen_recording` | vídeo/imagem em tela cheia, sem mockup |
| `prompt` | `generative_video` | obrigatório — em vídeo real, descreva o clipe |

Analisar anexo: `node tools/ingest-reference.mjs <vídeo>` (imagens) e `python tools/transcribe.py <vídeo>`
(fala). Gerar a partir de foto: `kling3_0 --start-image <arquivo>`. Rosto real só com autorização.

## 8. Edição

| Campo | Onde | Valores |
|---|---|---|
| `transitionIn` / `transitionMs` | cena | `cut` (padrão), `fade`, `zoom`, `whip`, `slide_up`, `flash` / 80–600 ms (padrão 250). Não muda a duração do vídeo |
| `audio.sfx[]` | spec | `{ src: "sfx/whoosh.mp3", atMs, volume }` — `whoosh`, `pop`, `click`, `rise` em `render/public/sfx/` |
| `anim` | layer | `none`, `pop_in`, `fade_in`, `slide_up`, `punch_in`, `tilt_scroll`, `handheld_subtle` |
| `preset` | layer `text` | `hook_stroke` (terço inferior-médio), `sub`/`caption` (faixa de legenda), `cta_label` |
| imagem estática | `app_screen_recording` com imagem e `anim: "none"` | zoom lento automático |

Detalhes do renderer: [`render/README.md`](../render/README.md).

## 9. Variações e idiomas

```bash
node tools/spec-tool.mjs variant render/specs/<pai>.json --mutation hook_rewrite --patch <patch>.json
node tools/spec-tool.mjs diff render/specs/<pai>.json render/specs/<filho>.json
```

Uma dimensão por variação: `hook_rewrite`, `hook_visual`, `pacing`, `cta`, `voice`, `persona`,
`format`, `locale_swap`. O patch traz só as cenas que mudam; clipes são reaproveitados.

Outro idioma: `locale_swap` com textos e karaokê adaptados → voz nova no idioma →
`transcribe.py --lang <en|es|...>` → `sync-captions --fit-scenes`. Vídeo com pessoa falando:
workflow `dubbing` (`target_language`: por, spa, eng, fra, deu, ita...).

## 10. Validação

| Comando | O que acusa |
|---|---|
| `spec-tool validate` | estrutura do spec: gap/overlap de cenas, texto vazio, hook longo |
| `spec-tool check` | **errors:** cena sem vídeo/imagem, layer sem `src`, arquivo inexistente · **warnings:** clipe mais curto que a cena, legenda não sincronizada com a voz, voz além do fim do vídeo, vídeo sem legenda |
| `tools/review.mjs <mp4>` | folha de contato (quadros com tempo) + volume médio/pico e silêncios do áudio |

## 11. Compartilhar

Specs, contextos, clipes (`render/public/`) vão para o GitHub. Não vão: `entrada/`,
`references/`, `render/out/` (MP4 finais — mande pelo canal da equipe).

---

A plataforma web (`web/`, `server/`, `DEPLOY.md`, `docs/ATIVACAO-IA.md`) está **fora de uso** por
enquanto.
