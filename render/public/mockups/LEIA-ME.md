# mockups

Mockup oficial de celular dos criativos. Usado automaticamente em toda layer
`app_screen_recording` com `device: "iphone15_mock"` (o padrão).

| Arquivo | O que é |
|---|---|
| `iphone-roxo.png` | original enviado pela equipe (1080x1920, com papel de parede de exemplo) |
| `iphone-roxo-vazado.png` | **o que o renderer usa** — mesmo arquivo com a área da tela vazada |

## Como funciona

A gravação do app entra **por baixo**, no retângulo exato da tela, e a moldura fica por cima.
Assim o recorte dos cantos e o notch vêm do próprio PNG, sem máscara desenhada no código.

Medidas da tela, tiradas do arquivo: **x 117–961, y 54–1870** (845 × 1817), ou seja
`left 10,83% · top 2,81% · width 78,24% · height 94,64%`. O notch preto foi preservado no recorte.

O conjunto ocupa **88,6% da altura do quadro**, e a aproximação vem da animação da cena
(`anim: "punch_in"`), nunca de escalar o vídeo dentro da tela — escalar corta a interface do app.

## Trocar o mockup

1. Coloque o PNG novo aqui (fundo transparente em volta do aparelho).
2. Peça ao Claude para medir a área da tela e gerar a versão vazada.
3. Ele atualiza as medidas em `render/src/layers/LayerRenderer.tsx` (`DeviceFrame`).
