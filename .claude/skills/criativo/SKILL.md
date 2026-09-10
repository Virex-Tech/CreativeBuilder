---
name: criativo
description: Cria, varia e renderiza criativos de vídeo para apps a partir de uma referência ou de um brief. Use quando o usuário pedir para fazer um vídeo/criativo/anúncio, mandar uma referência (link ou arquivo de vídeo), pedir variações de um criativo existente, ajustar um vídeo já feito (encurtar hook, trocar cena, outro idioma, outro formato), ou analisar performance de criativos a partir de métricas exportadas.
---

# Criativo

Produz criativos de vídeo para marketing de apps. O criativo é descrito por um
**`CreativeSpec`** (JSON) e renderizado pelo Remotion. Você nunca "edita vídeo": você
escreve e reescreve o spec.

**Raiz do projeto**: `C:\Projects\creativebuilder`
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

Alinhamento palavra a palavra da legenda, transições entre cenas, saída de imagem e
carrossel, publicação e ingestão automática de métricas.

**Áudio já funciona**: `spec.audio.voiceover` (com `atMs` e `durationMs`) e `spec.audio.music`
(com `duckingDb`). Arquivos locais em `render/public/`. Sempre declare a duração da
voz — sem ela a música fica abafada até o fim. Layers de mídia sem asset
renderizam um placeholder com o prompt — é o esperado enquanto o spec é rascunho.

**Higgsfield ainda não está ligado.** Quando o usuário pedir b-roll gerado, escreva o
`prompt` na layer e avise que ela vai renderizar como placeholder até a chave existir.
Se houver arquivo local de vídeo ou screen recording, use `src` na layer — isso funciona
hoje e vale muito mais que um placeholder.
