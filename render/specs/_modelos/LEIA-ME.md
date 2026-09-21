# Modelos de criativo

Três esqueletos prontos em `render/specs/_modelos/`. Copie um, troque `appId`/`creativeId`,
preencha os prompts entre colchetes com o que você tem em mãos e mande gerar.

| Modelo | Quando usar | Estrutura de cenas | O que ter em mãos |
|---|---|---|---|
| `ia-total.json` | Não tem gravação nenhuma do app, ou quer testar um ângulo rápido | hook → problema → solução → prova → CTA — todas as 5 cenas em b-roll gerado por IA | ~5 clipes de b-roll (~US$ 1,75 na Kie.ai, Kling 3.0, 5s cada) |
| `app-demo.json` | Tem (ou consegue gravar) a tela do app | hook (b-roll) → demo 1 → demo 2 (tela do app, com moldura de iPhone) → benefício (b-roll) → CTA (tela do app em tela cheia) | ~2 clipes de b-roll (~US$ 0,70) + 3 gravações de tela do app |
| `imagem-final.json` | Quer fechar com um print (loja, oferta, antes/depois) em vez de vídeo | hook → problema → benefício → prova (todas b-roll) → CTA com imagem estática em tela cheia | ~4 clipes de b-roll (~US$ 1,40) + 1 imagem/print |

Estimativa de custo na Kie.ai: **nº de cenas com b-roll gerado × ~US$ 0,35** (Kling 3.0, 5s, 720p,
sem som — ver `tools/kie-precos.json`). Na alternativa Higgsfield: nº de cenas × ~6,25 créditos.

## Como pedir

> "Cria um criativo do OzemPro usando o modelo app-demo."

## Observações

- Todo modelo já vem com `karaoke` em cada cena e `audio.voiceover.script` com o roteiro
  completo (concatenação das falas) — só falta gravar a locução e o alinhamento de palavras.
- `src` das layers de vídeo gerado fica ausente de propósito: o Remotion mostra o `prompt`
  como placeholder até o clipe existir. `app_screen_recording` usa `assetId` descritivo.
- Nenhum modelo inclui `disclaimer` (linha de aviso legal). Só adicione a layer quando o usuário
  pedir.
- `brandKit` está nos valores neutros padrão do schema; troque pelas cores/fonte do app.

## Antes de usar um modelo

Os modelos são **esqueletos**: as cenas já têm roteiro, transições, efeitos sonoros e legenda,
mas ainda **não têm vídeo, imagem nem voz**. Por isso o `check` acusa erros como
*"layer generative_video sem src"* e *"legenda não sincronizada com a voz"* — é esperado.

O Claude preenche nesta ordem e só entrega quando o `check` passar sem erros:

1. copia o modelo para `render/specs/<app>-<nome>.json` e troca os textos pelo contexto do app;
2. gera ou recebe os vídeos/imagens de cada cena (`src`);
3. gera a voz, transcreve e roda `sync-captions --fit-scenes`;
4. `check` → preview → MP4 → `review.mjs`.
