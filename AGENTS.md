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

Isso extrai frames nos cortes reais + áudio em `references/<nome>/` e escreve um
`manifest.json`. Então:

1. **Leia os frames** (cada `.jpg`) e o `manifest.json`.
2. Escreva o **blueprint**: para cada beat, o papel (`HOOK`/`PROBLEM`/`DEMO`/`PROOF`/`CTA`),
   o intervalo em ms, o que aparece na tela e o texto. Use `avgShotSec` como ritmo alvo.
3. **Copie só a estrutura e o ritmo — nunca frames, áudio ou marca da referência.**
4. Preencha o `CreativeSpec` com o conteúdo do app, respeitando o `DirectorProfile`.
5. Mostre o blueprint ao usuário antes de renderizar.

Limites: você não ouve o áudio da referência — se o hook parece falado, pergunte o que é dito.
Views/curtidas não vêm da ingestão.

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

## Ajustes em linguagem natural

| Pedido | Ação |
|---|---|
| "encurta o hook pra 1.8s" | `durationMs` da cena hook + reflow (`variant` já faz) |
| "troca a cena 3 por X" | novo `prompt` na layer generativa |
| "legenda maior / mais pra cima" | trocar `preset` do texto |
| "faz em espanhol" | `locale_swap` |
| "versão 4:5 de 15s" | mutação `format` |

## Geração de b-roll — Higgsfield (CLI ou MCP) no agente

O b-roll de IA (camadas `generative_video`) é gerado **por este agente**, pela conta
Higgsfield logada (OAuth, sem API key). Setup uma vez: `npm i -g @higgsfield/cli && higgsfield
auth login`; o MCP (`https://mcp.higgsfield.ai/mcp`) é opcional — o CLI basta.

```bash
higgsfield account status                                  # login + créditos
higgsfield model get       kling3_0                         # params aceitos (duration varia por modelo)
higgsfield generate cost   kling3_0 --prompt "..." --aspect_ratio 9:16 --duration 5 --sound off
higgsfield generate create kling3_0 --prompt "..." --aspect_ratio 9:16 --duration 5 --sound off --wait --json
```

Mostre o custo e peça ok antes do `create` (gasta créditos). `--sound off` sempre: o áudio
vem do Remotion. Baixe o resultado para
`render/public/broll/<spec>-<scene-id>.mp4` e preencha a layer com `src` (esse caminho),
`assetId` (job id) e `provider: "higgsfield"`. Não deixe a URL do provedor no `src`: expira em
~7 dias.

## Material do app (gravação de tela e prints)

Arquivos do app ficam em `render/public/app/<app>/`. Na layer `app_screen_recording`, use
`"src": "app/<app>/<arquivo>"` — vídeo (`.mp4/.mov/.m4v/.webm`, toca mudo no mockup) ou
imagem (`.png/.jpg`). Sem material do app, não use essa layer: faça o criativo com b-roll +
texto + CTA. Nunca gere a tela do app com modelo generativo.

## Relação com a plataforma

**Toda a IA roda no agente** — escrita/ajuste do spec, b-roll e diagnóstico de métricas. O
servidor não usa `ANTHROPIC_API_KEY` nem credencial do Higgsfield; os endpoints de IA dele
(`/creatives/generate`, `/creatives/:id/adjust`, `/creatives/:id/broll`,
`/apps/:id/metrics/diagnose`) ficam inertes (`503`) de propósito. A plataforma serve para
guardar specs/versões, editar, renderizar e subir CSV. Detalhes em `docs/ATIVACAO-IA.md`.
