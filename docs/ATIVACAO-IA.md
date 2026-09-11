# IA no CreativeBuilder — onde ela roda

**Decisão: toda a IA roda no agente local (Claude Code), não no servidor.** Sem
`ANTHROPIC_API_KEY` e sem credencial do Higgsfield no VPS.

| O quê | Onde roda | Como |
|---|---|---|
| Escrever / ajustar o `CreativeSpec` | Claude Code | skill `criativo` (`.claude/skills/criativo/SKILL.md`) ou `AGENTS.md` |
| B-roll (`generative_video`) | Claude Code | **Higgsfield CLI ou MCP**, pela conta logada (OAuth) — ver `COMO-USAR.md` |
| Diagnóstico de performance | Claude Code | skill `criativo`, seção "Análise de performance", sobre o CSV exportado |
| Ingestão de referência | local **ou** plataforma | `tools/ingest-reference.mjs` / seção Referências no app |
| Editar, versionar, renderizar still/MP4 | plataforma **ou** local | editor web / `npx remotion` |
| Métricas por CSV (hook/hold/CTR/quartis) | plataforma | `POST /apps/:id/metrics` — sem chave nenhuma |

## Endpoints de IA do servidor — inertes de propósito

O código do servidor ainda tem os endpoints de IA server-side. Sem as chaves eles respondem
`503`, e **o `docker-compose.yml` não repassa essas variáveis ao container `api`** — mesmo
que alguém preencha o `.env`, elas não chegam. Isso é intencional neste setup.

| Endpoint | Precisaria de |
|---|---|
| `POST /creatives/generate` · `POST /creatives/:id/adjust` · `POST /apps/:id/metrics/diagnose` | `ANTHROPIC_API_KEY` |
| `POST /creatives/:id/broll` · `POST /higgsfield/test` | `HIGGSFIELD_API_KEY_ID/SECRET` + `HIGGSFIELD_VIDEO_ENDPOINT` |

Na UI, o painel **"Gerar criativo com IA"** (página do app), a caixa **"Ajustar com IA"** e o
botão **"gerar b-roll"** (página do criativo) chamam esses endpoints — hoje retornam o aviso.

Se um dia a decisão mudar, é preciso: (1) adicionar as variáveis no `environment:` do
serviço `api` no `docker-compose.yml`; (2) preencher no `.env`; (3) `docker compose up -d
--build api`. As variáveis aceitas estão em `server/src/lib/env.ts`.

## B-roll gerado local × render na plataforma

O b-roll gerado no Claude Code vai para `render/public/broll/` e o spec referencia esse
caminho. O container de render da plataforma **não enxerga essa pasta** e a API não tem
upload de asset. Então:

- **MP4 final com b-roll → renderize local** (`npx remotion render`).
- Na plataforma, um spec com b-roll só renderiza se o `src` for a URL do Higgsfield — serve
  para rascunho, mas **expira em ~7 dias**.
- Subir asset para o volume `/media` e servir de lá é o follow-up que resolve isso.

## Fluxo completo ("criativo infinito")

referência (local ou plataforma) → Claude Code escreve o spec → Higgsfield (CLI/MCP) gera o
b-roll → Remotion renderiza o MP4 → variações (`spec-tool variant`) → CSV de métricas →
Claude Code diagnostica e propõe a próxima variação.
