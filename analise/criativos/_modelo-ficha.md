# <App> — anúncio <ad_id>

> Ficha de um criativo que deu certo, para usar como referência. O vídeo **não** vai para o git:
> fica em `entrada/<slug>/meta-ads/` (ou `adlibrary/`). Atualize o índice `analise/criativos/README.md`.

## Identificação

- **App:** 
- **ID do anúncio / Library ID:** 
- **Anunciante / criador:** 
- **Plataformas:** 
- **No ar desde:** · **Status:** ativo / pausado
- **Fonte dos dados:** Meta Ads MCP / Windsor / CSV / Biblioteca de Anúncios (sem métricas)
- **Vídeo local:** `entrada/<slug>/.../<id>.mp4` (duração, resolução)

## Resultado

| Métrica | Valor | Período |
|---|---|---|
| Gasto |  |  |
| Impressões |  |  |
| CTR |  |  |
| Hook rate (plays 3s ÷ impressões) |  |  |
| Hold (p75 ÷ plays) |  |  |
| Sinais indiretos (Biblioteca) | tempo no ar · nº de anúncios com o mesmo criativo |  |

## Etiquetas (dimensões do criativo — obrigatórias desde 18/10/2026)

Sem isto a análise não agrupa por embalagem e o teste não aprende. Mesmos valores do nome do
anúncio (`apps/<slug>/formatos.md`, "Nome do anúncio").

| Dimensão | Valor | Fonte |
|---|---|---|
| **Embalagem** | `E<nº>` + nome (ex.: `E07 pesquisa no Google`) | `apps/<slug>/formatos.md` |
| **Dor** | `D<tier>-<dor curta>` (ex.: `D1-risquinhos`) | `apps/<slug>/masterlist-dores.md` |
| **Hook** | `conexao` · `uau` · `polemica` | `apps/<slug>/roteiro-ugc.md` |
| **Produção** | `flash` · `narrado` · `viral` · `estatico` · `carrossel` | `apps/<slug>/roteiro-ugc.md` |
| **Fonte de imagem** | pessoa (quem) · panda · app · elementos · pexels · higgsfield | catálogos de material |
| **Mercado** | `pt-BR` · `fr` · … | `apps/<slug>/mercados.md` |

## Hook (primeiros 3s)

- **Visual:** 
- **Texto na tela:** 
- **Fala:** 

## Estrutura

| Tempo | Papel | O que aparece | Fala / texto |
|---|---|---|---|
| 0–3s | HOOK |  |  |

## Formato e edição

- **Formato:** UGC com criadora / demo de app / b-roll / misto
- **Edição:** cortes, legenda (estilo, cor, posição), tela do app (tela cheia / sobreposta / mockup), música
- **Duração e ritmo:** 

## Por que funcionou (hipótese)

- 

## Compliance

- Pontos que conflitam com `apps/<slug>/contexto.md` (não copiar sem decisão do responsável):

## Como usar de base

- **Manter:** 
- **Variar (uma dimensão por variação):** 
- **Como reproduzir no CreativeBuilder:** modelo de vídeo, layers, o que gerar no Higgsfield, o que pedir de gravação
