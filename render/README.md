# render

Renderiza um `CreativeSpec` (JSON) em MP4 ou PNG via Remotion. **Uma composição só** —
`Creative` — cujas dimensões e duração são derivadas do spec por `calculateMetadata`.
Nada de uma composição por vídeo: variação é dado, não código.

## Rodar

```bash
npm install
npm run dev                                    # Remotion Studio, edição visual do spec

# vídeo
npx remotion render src/index.ts Creative out/video.mp4 \
  --props=./specs/props/tapfit-treino-aleatorio.json

# preview barato (um frame) — valida direção antes de gastar o render inteiro
npx remotion still src/index.ts Creative out/frame.png --frame=30 \
  --props=./specs/props/tapfit-treino-aleatorio.json
```

`--props` recebe o objeto de props (`{ "spec": { ... } }`), não o spec cru — por isso os
arquivos em `specs/props/` embrulham os de `specs/`.

## Estrutura

| Arquivo | Papel |
|---|---|
| `src/spec.ts` | schema zod do `CreativeSpec` — o contrato entre API, agentes e renderer |
| `src/SpecRenderer.tsx` | a composição única: cenas → `Sequence`, layers → `Sequence` aninhada |
| `src/layers/LayerRenderer.tsx` | renderiza cada layer (texto, b-roll, screen recording, sólido) |
| `src/presets/anims.ts` | animações e estilos de texto nomeados, referenciados pelo spec |
| `specs/` | specs de exemplo; `specs/props/` são os mesmos embrulhados para `--props` |

## Layers hoje

`text` · `generative_video` · `app_screen_recording` · `solid` · `badge` · `karaoke` · `disclaimer`

## Áudio

`spec.audio` aceita `voiceover` e `music`. A música **ducka** sob a narração: cai
`duckingDb` (padrão -14 dB) com rampa de 0.25s quando a voz entra e volta quando ela
termina. Por isso o voiceover declara `atMs` e `durationMs` — sem a duração, a música
ficaria abafada até o fim do vídeo.

Arquivos locais vão em `public/` e o spec referencia pelo nome (`"test-vo.mp3"`); URLs
absolutas também funcionam. Cuidado com URL de provider: a do Higgsfield expira em ~7 dias,
então serve para rascunho, não para spec arquivado.

Layers de mídia sem asset resolvido renderizam um **placeholder com o prompt**, para o
preview continuar legível em vez de sair preto. É o estado esperado enquanto o spec é
rascunho.

## Edição: transições, sfx, Ken Burns

- `scene.transitionIn` (`"cut" | "fade" | "zoom" | "whip" | "slide_up" | "flash"`, padrão
  `"cut"`) e `scene.transitionMs` (80–600ms, padrão 250) — efeito aplicado só nos primeiros
  frames da cena que **entra**, sem alterar `startMs`/duração de nada (legenda e locução
  continuam sincronizadas). A primeira cena sempre corta em `"cut"`, mesmo se o spec pedir
  outra coisa. Implementado em `SpecRenderer.tsx` (`SceneEnter`) + `presets/anims.ts`
  (`resolveTransition`) — nunca com `TransitionSeries` (isso encurtaria o vídeo).
- `audio.sfx` — array de `{ src, atMs, volume }` (volume padrão 0.6), tocado em posição
  absoluta da timeline, independente de cena. Biblioteca mínima em `public/sfx/` (gerada com
  ffmpeg, sem baixar nada — veja `public/sfx/LEIA-ME.md`): `whoosh.mp3`, `pop.mp3`,
  `click.mp3`, `rise.mp3`.
- Ken Burns automático: `app_screen_recording` cujo `src` é imagem (não vídeo) e `anim` é
  `"none"` ganha um zoom lento 1.0→1.08 ao longo da layer, para uma screenshot estática não
  ficar congelada. Vídeo e `anim` explícito não são afetados.

## Ainda não existe

Alinhamento palavra a palavra da legenda (hoje o karaokê divide o tempo igualmente entre as
palavras — passe `wordEndsMs` quando tiver os tempos reais), saída `image`/`carousel`, e o
servidor HTTP (`POST /render`). Hoje é CLI.
