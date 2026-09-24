# Estúdio de conteúdo (plataforma)

Conteúdo orgânico em série: vídeos gravados por gente de verdade (UGC, marca, persona), editados
pela IA, aprovados pelo time e publicados no horário. Fica em `/estudio` na web.

## Fluxo

1. **Contas** (`/estudio/contas`): qualquer conta, com o app que ela divulga, os horários do dia
   (cada horário vira uma vaga no calendário), quem é a pessoa/como fala e o estilo de edição
   padrão. Opcional: pasta do Drive com os takes.
2. **Hoje** (`/estudio`): a semana em cima, uma linha por conta, um card por horário. Clicar num
   horário vazio cria a postagem.
3. **Postagem**: referência (link, upload ou uma já lida) + takes + instrução → **editar com IA**.
   Takes chegam por: upload (vários de uma vez), links (Drive, Dropbox, Instagram, TikTok…), pasta
   do Drive, **link de envio** (o criador sobe pelo celular, sem login) ou **gerado na kie.ai**
   (Veo, pessoa falando, ~US$ 0,30 por 8s — pede confirmação do custo).
4. A IA edita, o vídeo renderiza e o card fica amarelo (**aprovar**). Aprovar, ou **pedir
   alteração** (com o tempo do vídeo, ex. `[0:03] corta isso`) — cada pedido gera uma versão nova.
5. Aprovado: conta do Instagram conectada publica sozinha no horário (Reels). TikTok e conta não
   conectada: baixa o MP4, posta e marca como postado.

## Como a edição funciona

- O worker normaliza cada take (H.264, 30fps, até 1080×1920), tira miniatura e 2 frames e
  **transcreve com o tempo de cada palavra** (faster-whisper, `WHISPER_MODEL`, local, sem custo).
- A IA (Codex/Anthropic, `lib/specAuthor.ts` → `editFromTakes`) recebe a transcrição, os frames, a
  referência (ritmo, frames, fala transcrita), a persona/estilo da conta e a instrução, e escreve o
  spec com camadas `footage` (trecho de um take, com o som original) + a legenda do post.
- O servidor dá o acabamento (`lib/footage.ts`): puxa cada corte pra fronteira de palavra (a
  palavra fica se a maior parte dela está no trecho), tira a sobreposição entre clipes seguidos do
  mesmo take, prende a URL do take pelo id e **refaz a legenda da fala** em blocos de até 4
  palavras com o tempo exato (`karaoke` com `auto: true`). Rodar de novo dá o mesmo resultado. Roda
  também no "ajustar com IA" e no editor de JSON do criativo.
- Título fixo no topo: preset `title_top` (a IA usa quando a instrução pede título).
- Antes de salvar, o spec é conferido no render (`POST /validate`); se não passar, a IA tem uma
  chance de corrigir.

Estados da postagem: `DRAFT → QUEUED → PREPARING → EDITING → BROLL → RENDERING → REVIEW`,
alteração `REVISING`, depois `APPROVED` (manual) ou `SCHEDULED → PUBLISHING → PUBLISHED`; `FAILED`
com "tentar de novo" que retoma de onde parou. Laço em `lib/studio.ts` (dentro da API).

## Equivalente local (Claude Code / Codex)

O mesmo fluxo sem a plataforma: `node tools/takes.mjs preparar <takes>` (converte + transcreve),
o agente escreve o spec com layers `footage` e `node tools/spec-tool.mjs footage <spec>` aplica o
mesmo acabamento — ver `docs/COMO-USAR.md` seção 13. A regra de corte/legenda é a mesma nos dois
lugares (`server/src/lib/footage.ts` ↔ `tools/spec-tool.mjs`): mudou um, mude o outro.

## Configuração (env da API)

| Variável | Para quê |
|---|---|
| `PUBLIC_WEB_URL` | link de envio dos takes e volta do login do Instagram |
| `PUBLIC_API_BASE` | precisa ser **https**: o Instagram e o render baixam os vídeos daqui |
| `INSTAGRAM_APP_ID` / `INSTAGRAM_APP_SECRET` | botão "conectar com o Instagram" (app da Meta com o produto Instagram, permissões `instagram_business_basic` + `instagram_business_content_publish`, redirect `<PUBLIC_API_BASE>/studio/instagram/callback`). Sem isso, conecta colando um token gerado no painel da Meta |
| `GOOGLE_API_KEY` | opcional — listar pasta do Drive pela API (sem ela, lê a página pública da pasta) |
| `KIE_API_KEY` / `KIE_TAKE_MODEL` | take gerado por IA (`veo3_fast` padrão) e b-roll |
| `WHISPER_MODEL` / `WHISPER_LANG` / `WHISPER_THREADS` | transcrição (no worker) |

A conta do Instagram precisa ser **Profissional** (Criador ou Empresa). Enquanto o app da Meta
não tiver Acesso Avançado, só contas adicionadas como testadoras do app conectam.

nginx da API (no bloco `server` do domínio da API) — take de celular é grande:

```nginx
client_max_body_size 2048M;
proxy_request_buffering off;
```
