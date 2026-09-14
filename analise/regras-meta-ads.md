# Regras de validação de criativo no Meta Ads

> Regras da equipe (14/09/2026). **São as únicas regras de análise** — qualquer outra regra de
> performance neste repositório (volume mínimo, hook rate de 2s, "não decidir por CPA" etc.) está
> **substituída** por esta página.
>
> **Modo atual: somente análise.** O Claude não cria, edita, pausa nem mexe em orçamento no
> Gerenciador — recomenda, e a equipe executa. Isso só muda com autorização explícita.

## Estrutura da campanha de teste (Fase Zero)

- **Orçamento:** R$ 50,00 a R$ 55,00 por dia (escala rápida).
- **Configuração:** campanha CBO, 1 campanha × 1 conjunto × 1 criativo (1-1-1), direcionamento
  exclusivo para iOS.
- **Horário de subida:** meia-noite, para rodar o ciclo completo do dia.

## Kill-switch (corte precoce)

- Não precisa gastar todo o orçamento diário se os números iniciais forem ruins: gastou cerca de
  **R$ 30,00** com desempenho fraco → já pode pausar.
- **Custo por instalação no paywall (`paywall_install` / CPI):** acima de **R$ 10,00** → corta
  imediatamente. Abaixo de R$ 10,00 → ganha margem para otimizar.

## Validação e transição

- **Regra de ouro para desistir:** pelo menos 2 tickets do produto gastos (cerca de **R$ 300,00**)
  sem retorno.
- **Meta de validação:** **ROAS 2+** para considerar o criativo validado.
- **Primeiro sinal de escala na Fase Zero:** vendeu 2 e o orçamento está em R$ 55,00 → aumenta o
  orçamento da própria campanha de teste.

## Fase de Escala 1 — multiplicação de plataforma

- Mantém a campanha de iOS rodando e duplica a estrutura numa versão exclusiva para **Android**.
- Dobra o orçamento diário para cerca de **R$ 100,00**, mantendo CBO 1-1-1, subindo ou descendo
  conforme a conversão de vendas diária.

## Fase de Escala 2 e Modelagem

- Duplica o criativo validado para campanhas focadas em **Paywall Bitcap** nas contas
  **CA01 - Jordana Farias** e **CA02 - Expire APP**, em iOS e Android.
- **Modelar:** o criativo passou por todas as travas financeiras. O papel passa a ser criar
  variações de ganchos e roteiros em cima dele (dores Tier 1 e Tier 2) para a máquina nunca parar.

## Métricas da análise

Fonte: **API** (MCP `meta-ads`, `ads_get_ad_entities`, `level: ad`). A conta a analisar é a que a
equipe indicar no pedido.

Tabela do relatório — **nesta ordem e com estes nomes de coluna** (os mesmos do Gerenciador da
equipe). Números no formato brasileiro (`1.326,34` · `51,14%`).

| Coluna | O que mede | Meta / regra | Campo na API |
|---|---|---|---|
| Nome do anúncio | código do criativo (número no nome) | — | `name` |
| Status de veiculação | active / inactive | só `active` entra | `effective_status` |
| Nível de veiculação | ad | — | `level` |
| Valor gasto (BRL) | queima de caixa | corte ~R$ 30 fraco · desistir ~R$ 300 | `amount_spent` |
| Tipo de resultado | evento otimizado | — | indicador de `results` (ex: `paywallo_purchase`) |
| Resultados | assinaturas/compras fechadas | 2 vendas = sinal de escala | `results` |
| Custo por compra | CPA | **abaixo de R$ 50,00** | `cost_per_omni_purchase` |
| ROAS de compras | retorno | **2,0+** valida | `purchase_roas` |
| paywallo_install | instalações no paywall | — | ver pendência |
| Custo por paywallo_install | crivo rápido do CEO | **acima de R$ 10,00 corta** | ver pendência |
| Hook Rate | força do gancho | — | reproduções de 3s ÷ `impressions` · 3s = `amount_spent` ÷ `cost_per_action_type:video_view` |
| Hold Rate | se a dor prendeu | — | `video_p25_watched_actions` ÷ reproduções de 3s |
| CTR (taxa de cliques no link) | interesse real de ir à loja | — | `outbound_clicks_ctr` |
| Início dos relatórios | data inicial do período | — | `since` |
| Encerramento dos relatórios | data final do período | — | `until` |

Conferido em 14/09/2026 contra o Gerenciador (105 Brasil, 07–13/09): Hook Rate 51,14% e Hold Rate
0,31% calculados pela API batem com as colunas da equipe.

## Agrupamento por número do criativo

- O criativo é identificado pelo **número no nome do anúncio** (`105 Brasil`, `105 Brasil — Cópia`
  → criativo **105**).
- Anúncios com o mesmo número costumam ser duplicações em **fases de validação diferentes**:
  analise **todos os ativos** com aquele número, mostrando cada anúncio (campanha/fase) e o
  total do criativo.
- Só entram anúncios com `effective_status` = `ACTIVE`.

## Pendência

- **`paywallo_install` em campanha de compra:** o evento chega no Ozempro Pixel, mas a API só
  entrega o custo dele como `results` quando a campanha otimiza para instalação. Em campanha que
  otimiza para `paywallo_purchase`, o `cost_per_action_type` não traz eventos personalizados.
  **Caminho em teste:** conversão personalizada `paywallo_install` (id `2604960406642990`, Ozempro
  Pixel, regra URL contém `paywallo.link`), criada em 14/09/2026 12:43 (horário do Pacífico) e
  compartilhada com CA01 e CA02. Deve aparecer como
  `cost_per_action_type:offsite_conversion.custom.2604960406642990` — ainda não aparecia nos
  anúncios no dia da criação. Se não aparecer depois de 1 dia, partir para a Graph API direta.
