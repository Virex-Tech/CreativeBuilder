# render — creative engine

Renderiza um `CreativeSpec` (JSON) em MP4 ou PNG via Remotion, valida specs, dá o acabamento de
takes gravados e serve o preview no navegador. É o **creative engine** compartilhado: o
CreativeBuilder (`server/`, `web/`, `tools/`) e o PayPosts (imagem Docker `creative-engine`) usam
este mesmo código — o contrato HTTP está em [API HTTP](#api-http). **Uma composição só** —
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
| `src/formats.ts` | `FORMAT_SIZES`, `withFormat()` e a escala de layout por formato |
| `src/footage.ts` | acabamento de takes (corte na palavra, sem sobreposição, legenda da fala) — **implementação única** |
| `src/urlRewrite.ts` | `RENDER_URL_REWRITE` (troca de prefixo de URL só no render do servidor) |
| `src/engine.ts` | entrada da lib pura (`footage` + `formats` + `urlRewrite`) → `lib/engine.mjs` |
| `server.ts` + `service/` | o serviço HTTP: rotas, fila, auth, preview, render |
| `preview/` | página do preview (`@remotion/player`), gerada em `preview-dist/` |
| `scripts/build.mjs` | `build:preview`, `build:lib`, `check:lib` (esbuild) |
| `test/` | testes (`npm test`, node:test via tsx); `test/fixtures/` specs sem mídia externa |
| `specs/` | specs de exemplo; `specs/props/` são os mesmos embrulhados para `--props` |

## Layers hoje

`text` · `generative_video` · `footage` · `app_screen_recording` · `solid` · `badge` · `karaoke` · `disclaimer`

- `footage` — take gravado por uma pessoa, **com o som original** (`volume`, 0 = mudo). A cena
  toca `take[startFromMs .. startFromMs + durationMs]`; `zoom` (1–1.6) faz o punch-in de jump cut
  e `mirror` desfaz o espelhamento da câmera frontal. As legendas da fala são `karaoke` com
  `auto: true`, geradas pelo acabamento de footage (`src/footage.ts`: `POST /footage/finalize`,
  `tools/spec-tool.mjs footage` no local, `server/src/lib/footage.ts` na plataforma) a partir da
  transcrição — `spec.autoCaptions` liga/desliga e define palavras por bloco.
- `text` presets: `hook_stroke`, `sub`, `caption`, `cta_label` e `title_top` (título fixo no topo,
  caixa clara com letra escura — o texto nativo do Reels/TikTok).
- Início de cena/voz/sfx usa `msToStartFrame` (pode ser 0); `msToFrames` (mínimo 1) é só para
  duração — usar o segundo para início deixava o frame 0 de todo vídeo vazio.

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

Saída `image`/`carousel` (use `POST /still` para uma imagem). Karaokê sem `wordEndsMs` divide o
tempo igualmente entre as palavras — com voz, use `spec-tool sync-captions`; com takes, o acabamento
de footage.


## Formatos (9:16, 4:5, 1:1)

`spec.format` (`w`, `h`, `fps`) define a composição. Os três formatos suportados:

| Nome | Tamanho | Uso |
|---|---|---|
| `VERTICAL` | 1080×1920 (9:16) | Reels, TikTok, Stories, Shorts |
| `PORTRAIT` | 1080×1350 (4:5) | feed |
| `SQUARE` | 1080×1080 (1:1) | feed / carrossel |

```ts
import { FORMAT_SIZES, withFormat } from "./src/formats"; // ou de lib/engine.mjs
const quadrado = withFormat(spec, "SQUARE"); // novo objeto; só format.w/h mudam
```

Os px dos presets foram afinados em 1080×1920. O renderer escala a partir do tamanho da
composição (`layoutFor(w, h)` em `src/formats.ts`): tamanhos (fonte, padding, raio, sombra) por
`min(w/1080, h/1350)` — cheio até 4:5, 80% no 1:1; as faixas de cima/baixo como "margem segura
proporcional à altura + empilhamento proporcional ao tamanho" (legenda, hook e CTA não colidem
quando o quadro encurta); o mockup de celular limita pela altura. **9:16 sai pixel-idêntico ao de
antes** (verificado por PSNR em todos os `specs/*.json`). Mesmo spec, só o `format` muda: nada no
spec precisa ser reescrito para 4:5 ou 1:1.

## API HTTP

`npm run serve` (ou a imagem Docker) sobe o serviço em `PORT` (padrão 11100). JSON em tudo; corpo
até 8 MB.

### Autenticação

Com `RENDER_TOKEN` definido, **toda rota** exige `Authorization: Bearer <RENDER_TOKEN>` — exceto
`GET /health` e `GET /preview/*`. Sem token ou token errado: `401 {"error":"unauthorized"}`. Sem
`RENDER_TOKEN` o serviço é aberto (o CreativeBuilder usa assim, em rede privada).

### Endpoints

| Método e rota | Corpo | Resposta |
|---|---|---|
| `GET /health` | — | `200 {"ok":true,"jobs":3,"running":1,"queued":2}` (`jobs` = jobs em memória) |
| `POST /validate` | `{"spec":{...}}` | `200 {"ok":true}` ou `200 {"ok":false,"issues":["scenes.0.durationMs: ..."]}` (até 12) |
| `POST /render` | `{"spec":{...}}` | `202 {"jobId":"<uuid>","status":"queued"\|"rendering","position":1\|null}` · `400 {"error":"invalid spec","issues":[<zod issues>]}` |
| `POST /still` | `{"spec":{...},"frame":30}` (`frame` opcional, padrão 0, limitado ao último) | igual a `/render` (PNG) |
| `GET /jobs/:id` | — | `200 <Job>` · `404 {"error":"job not found"}` |
| `GET /jobs/:id/file` | — | `200` `video/mp4` ou `image/png` (stream) · `409 {"error":"job is queued\|rendering\|failed"}` · `404` |
| `DELETE /jobs/:id` | — | `200 {"ok":true}` (apaga job + arquivo; job na fila sai da fila) · `409 {"error":"job is rendering"}` · `404` |
| `POST /footage/finalize` | `{"spec":{...},"takes":[<Take>]}` | `200 {"spec":{...},"warnings":["..."],"stats":{"clips":2,"captionBlocks":5,"durationMs":8400}}` · `400 {"error":"..."}` |
| `GET /preview/` | — | página HTML do preview (ver abaixo); `GET /preview` redireciona (Location relativo `preview/`) |

`Job`:

```jsonc
{
  "id": "5d0c…",               // uuid
  "kind": "video",             // "video" | "still"
  "status": "queued",          // "queued" | "rendering" | "done" | "failed"
  "position": 2,               // lugar na fila (1 = próximo); null quando não está na fila
  "progress": 0,               // 0–100
  "createdAt": 1790284718009,  // epoch ms
  "startedAt": 1790284718009,  // quando saiu da fila (ausente enquanto na fila)
  "finishedAt": 1790284732539, // ausente até terminar
  "durationMs": 3500,          // duração do vídeo (da soma das cenas); null para still
  "outPath": "/app/out/5d0c….mp4", // caminho no container, só quando done
  "error": "..."               // só quando failed
}
```

**Fila:** FIFO em memória; no máximo `RENDER_MAX_JOBS` renderizando ao mesmo tempo, o resto espera
com `status: "queued"` e `position`. O estado durável é do chamador: se o container reiniciar, os
jobs em memória somem (o chamador re-enfileira) — mas `GET /jobs/:id/file` ainda serve o arquivo
pelo id enquanto ele estiver em disco.

**Limpeza:** job terminado (done/failed) sai da memória, com o arquivo, `RENDER_OUT_TTL_HOURS`
depois de terminar; de hora em hora (e no boot) uma varredura apaga também os arquivos de
`RENDER_OUT_DIR` mais velhos que o TTL que não pertencem a nenhum job vivo. `0` desliga tudo isso.
Baixe o arquivo antes do TTL — o engine não é armazenamento.

**URL rewrite (só no render do servidor):** `RENDER_URL_REWRITE="https://app.exemplo/uploads/=>http://api:3000/uploads/;de2=>para2"`
troca o prefixo de todo `src` de mídia (layers `footage`, `generative_video`,
`app_screen_recording`, `audio.voiceover`, `audio.music`, `audio.sfx[]`) antes de renderizar
(`/render` e `/still`). O primeiro prefixo que casar vence. O spec guardado e o preview no
navegador continuam com a URL pública. Regra malformada derruba o boot.

`src` relativo (`"broll/x.mp4"`) é arquivo de `public/` da imagem; URL absoluta (`https://…`) é
baixada pelo Chrome do render — precisa ser alcançável de dentro do container (daí o rewrite).

### Acabamento de footage — `POST /footage/finalize`

A implementação única de `src/footage.ts` (a mesma do CLI e da plataforma CreativeBuilder):

1. o corte de entrada/saída do clipe "dono" de cada cena (1ª layer `footage` sem
   `startMs`/`durationMs`) é puxado para a fronteira de palavra — a palavra cortada fica se a maior
   parte dela está dentro do trecho (folga de 60 ms antes, 120 ms depois, nunca invadindo a palavra
   vizinha) — e nunca passa do fim do take; clipe mínimo 300 ms;
2. dois clipes seguidos do mesmo take não se sobrepõem (o anterior é encurtado);
3. as legendas `karaoke` com `auto: true` são jogadas fora e refeitas da fala real, em blocos de até
   `autoCaptions.maxWords` (padrão 4), quebrando em fim de frase e em pausa > 350 ms, com
   `wordEndsMs` exatos. Clipe com `volume: 0` ou `autoCaptions.enabled: false` fica sem legenda;
4. `startMs` das cenas refeito em sequência; `autoCaptions` gravado se faltava.

`Take`: `{ "id": "t1", "src": "https://…/t1.mp4", "durationMs": 41250, "words": [{ "w": "Eu", "startMs": 500, "endMs": 700 }] }`
(`word` também é aceito no lugar de `w`; `src` null = mantém o src da layer). A layer casa com o
take por `takeId` (e passa a usar o `src` do take — o chamador é a fonte da URL); sem `takeId`,
casa pelo `src` igual. Take desconhecido → aviso em `warnings`, clipe intocado. Spec sem layer
`footage` volta igual. O spec não passa pelo zod aqui (pode ser rascunho); valide depois com
`/validate`. Chame depois de **toda** edição do spec — rodar de novo é seguro.

### Preview no navegador — `GET /preview/`

Página estática (`preview-dist/`, gerada no build da imagem) que toca o spec no `@remotion/player`
com o **mesmo** `SpecRenderer` do MP4, com controles (play/pause, barra de tempo, volume),
ocupando o iframe inteiro e mantendo a proporção do spec, fundo escuro neutro. Todas as URLs da
página são relativas: funciona atrás de prefixo (o PayPosts faz proxy em `/engine/preview/` → `/preview/`).
`src` relativo no spec carrega de `./public/` (o `public/` da imagem, exceto `takes/`).

```html
<iframe src="/engine/preview/" allow="autoplay; fullscreen" style="width:360px;height:640px;border:0"></iframe>
```

Protocolo `window.postMessage` (todas as mensagens têm `type` com prefixo `creative-engine:`):

| Direção | Mensagem |
|---|---|
| iframe → pai | `{type:"creative-engine:ready"}` ao carregar (enviado a cada origem permitida) |
| pai → iframe | `{type:"creative-engine:spec", spec}` — validado com o zod do contrato |
| iframe → pai | `{type:"creative-engine:loaded", durationMs, width, height, fps}` — spec aceito |
| iframe → pai | `{type:"creative-engine:error", issues:["path: mensagem", …]}` — spec inválido (o anterior continua na tela) |
| pai → iframe | `{type:"creative-engine:seek", ms}` |
| pai → iframe | `{type:"creative-engine:play"}` / `{type:"creative-engine:pause"}` (sem gesto do usuário o navegador pode bloquear o som; aí toca mudo) |
| iframe → pai | `{type:"creative-engine:time", ms}` — enquanto toca (~4 por segundo), e também ao buscar e ao pausar |

Segurança: o iframe só aceita mensagens de origens em `PREVIEW_ALLOWED_ORIGINS` (lista separada
por vírgula, ex. `https://app.payposts.com.br`) vindas da janela pai, e só responde para a origem
que falou. A mesma lista vai no `Content-Security-Policy: frame-ancestors` da página — outro site
nem consegue embutir. Vazio = só a própria origem (o caso do proxy no mesmo domínio). `*` libera
tudo e só vale se escrito explicitamente.

### Variáveis de ambiente

| Variável | Padrão | Efeito |
|---|---|---|
| `PORT` | `11100` | porta HTTP |
| `RENDER_OUT_DIR` | `out` (`/app/out` na imagem) | onde ficam MP4/PNG |
| `RENDER_TOKEN` | vazio (aberto) | Bearer exigido em tudo menos `/health` e `/preview/*` |
| `RENDER_MAX_JOBS` | `1` | renders simultâneos; o resto fica na fila |
| `RENDER_CONCURRENCY` | padrão do Remotion | abas do Chrome por render |
| `RENDER_OUT_TTL_HOURS` | `24` | vida dos jobs terminados + arquivos (e dos órfãos); `0` = para sempre |
| `RENDER_URL_REWRITE` | vazio | `de=>para;de2=>para2` (prefixos), só no render do servidor |
| `PREVIEW_ALLOWED_ORIGINS` | vazio (mesma origem) | origens que podem embutir e comandar `/preview/`; `*` = qualquer |
| `PREVIEW_DIR` | `preview-dist` | pasta da página do preview |

## Build, testes e lib compartilhada

```bash
npm test            # footage, url rewrite, formatos, fila
npm run typecheck
npm run build       # build:preview (preview-dist/) + build:lib
npm run build:lib   # lib/engine.mjs + server/src/lib/engine/footage.ts (ambos COMMITADOS)
npm run check:lib   # falha se algum dos dois estiver velho em relação a src/
```

`lib/engine.mjs` é o bundle puro (sem React/Remotion/zod) de `src/engine.ts` — `finalizeFootage`,
`FORMAT_SIZES`/`withFormat`, `rewriteSpecUrls` — e roda com `node` puro (Windows e Linux):
`tools/spec-tool.mjs footage` o importa. `server/src/lib/engine/footage.ts` é cópia fiel de
`src/footage.ts` para o servidor do CreativeBuilder, cujo build Docker só enxerga `server/`. Nunca
edite as cópias: mude `src/footage.ts`, rode `npm run build:lib` e `npm test`.

## Docker

```bash
docker build -t creative-engine render/
docker run -d --name creative-engine -p 127.0.0.1:11100:11100 --shm-size=1g \
  -e RENDER_TOKEN=... -e RENDER_MAX_JOBS=1 -e RENDER_CONCURRENCY=2 \
  -e PREVIEW_ALLOWED_ORIGINS=https://app.exemplo -v engine-out:/app/out creative-engine
```

A imagem traz Chrome headless, ffmpeg, Inter e emoji; o build roda `build:preview` e
`check:lib`. O processo roda como `node` (uid 1000): o entrypoint começa como root só para dar
dono ao `RENDER_OUT_DIR` (volume antigo criado como root) e desce de usuário. `--shm-size=1g`:
o Chrome precisa de mais que os 64 MB padrão. `HEALTHCHECK` em `/health`.
