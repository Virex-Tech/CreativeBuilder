# Ativação das fases de IA

Toda a estrutura já está no código e **inerte sem as credenciais** — os endpoints de IA
respondem `503` até você configurar as chaves. Nada quebra sem elas: criar/editar criativo,
render/export MP4, ingestão de referência (vídeo/link) e a **análise por CSV** funcionam sem
nenhuma chave.

Para ligar cada fase, ponha as variáveis no `.env` do deploy e rode:

```bash
cd ~/projects/creativebuilder
docker compose up -d --build api        # api lê as vars; worker não precisa
```

## Fase 2 — a IA escreve e edita o CreativeSpec

| | |
|---|---|
| **Ativa com** | `ANTHROPIC_API_KEY=sk-ant-...` (opcional: `ANTHROPIC_MODEL`, default `claude-opus-4-8`) |
| **Endpoints** | `POST /creatives/generate` (brief e/ou referência → spec novo) · `POST /creatives/:id/adjust` (instrução em linguagem natural → nova versão) |
| **UI** | página do app: painel **"Gerar criativo com IA"** · página do criativo: caixa **"Ajustar com IA"** |
| **Sem a chave** | os dois endpoints respondem `503` com instrução |

## Fase 3 — b-roll no Higgsfield (camadas `generative_video`)

| | |
|---|---|
| **Ativa com** | `HIGGSFIELD_API_KEY_ID`, `HIGGSFIELD_API_KEY_SECRET`, `HIGGSFIELD_VIDEO_ENDPOINT` |
| **Onde pegar** | credenciais server-side em `cloud.higgsfield.ai`. O `VIDEO_ENDPOINT` é o path do modelo (varia: Seedance/Kling/…) — confirmar no cloud, ex: `/higgsfield-ai/<modelo>/<versao>`. Opcional: `HIGGSFIELD_VIDEO_PARAMS` = JSON extra no submit (ex: `{"duration":5}`) |
| **Plano p/ testar** | **Lite Monthly $1** (25 créditos; a API usa os créditos do plano). Use Kling 3.0 (~7 cr) pra ~3 testes |
| **Endpoints** | `POST /higgsfield/test { prompt }` (valida credencial+endpoint gerando 1 vídeo) · `POST /creatives/:id/broll` (gera as `generative_video` pendentes → preenche `src` → nova versão) |
| **UI** | página do criativo: botão **"gerar b-roll"** |
| **Sem as chaves** | os dois endpoints respondem `503` |
| **Limite conhecido** | a URL do Higgsfield expira ~7 dias; hoje o render usa a URL direto. Baixar/servir cópia local de `/media` é follow-up |

## Fase 5 — performance (a 2ª IA que analisa o que deu certo)

| | |
|---|---|
| **CSV (sem chave nenhuma)** | `POST /apps/:id/metrics` (upload do CSV do Gerenciador de Anúncios) cruza pelo nome/id do anúncio e calcula hook/hold/CTR/quartis · `GET /apps/:id/metrics` lista. **UI:** seção **"Performance"** na página do app |
| **Diagnóstico por IA** | `POST /apps/:id/metrics/diagnose` — precisa de `ANTHROPIC_API_KEY` (a mesma da Fase 2). Sem ela, `503` |
| **Meta live (futuro)** | puxar métricas sem CSV exige a **Meta Marketing API + token do ad account** — ainda não construído |

## Onde as variáveis já estão declaradas

- `.env.example` — documenta todas.
- `docker-compose.yml` (deploy local) — o serviço `api` já repassa `ANTHROPIC_API_KEY`,
  `ANTHROPIC_MODEL`, `HIGGSFIELD_API_KEY_ID/SECRET/BASE_URL/VIDEO_ENDPOINT/VIDEO_PARAMS`.
  Só falta preencher no `.env` e subir.

## Fluxo completo ("criativo infinito"), por fase

referência entra (**Fase 4** ✅) → IA escreve o spec (**Fase 2**) → Higgsfield gera o b-roll
(**Fase 3**) → render exporta o MP4 (✅) → variações (✅) → CSV entra e a 2ª IA diz o que deu
certo e o que variar (**Fase 5**). Tudo no repositório; falta só plugar as chaves.
