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

## Geração de b-roll (local) — MCP do Higgsfield

O b-roll de IA (camadas `generative_video`) sai pelo **MCP do Higgsfield** conectado a este
agente, autenticado pela conta Higgsfield (OAuth, sem API key). Setup: `npm i -g
@higgsfield/cli && higgsfield auth login`, depois adicione o MCP (`https://mcp.higgsfield.ai/mcp`)
nas configurações de MCP do agente. Passo a passo detalhado em `docs/COMO-USAR.md`.

## Relação com a plataforma

O mesmo fluxo roda na plataforma (VPS): a **ingestão de referência**, a **escrita do spec
pela IA** e a **geração no Higgsfield** já estão implementadas no servidor — ficam ativas
quando as chaves são configuradas (`docs/ATIVACAO-IA.md`). Na plataforma o b-roll usa a **API
HTTP** do Higgsfield (credencial server-side); no local, o **MCP** (OAuth). Enquanto as chaves
do servidor não estão setadas, essa parte roda por aqui (agente local) e o resultado é colado
na plataforma.
