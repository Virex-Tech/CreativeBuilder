# sfx — efeitos sonoros dos criativos

No spec entram como `"src": "sfx/<arquivo>"`. Todos já estão tratados: silêncio do começo e do fim
cortado e pico igualado em **-6 dB**, para o efeito nunca saltar por cima da narração.
Os arquivos como vieram da equipe ficam em `originais/`.

## O que temos (11/10/2026)

| Arquivo | Duração | Para que serve |
|---|---|---|
| `camera_flash-hook.mp3` | 3,6s | hook sonoro de abertura (flash/câmera) |
| `click_hook.mp3` | 0,6s | hook sonoro de abertura, mais seco |
| `woosh_1.mp3` | 0,3s | transição entre cenas |
| `woosh_2.mp3` | 0,3s | transição entre cenas (variação) |
| `riser-transicao_suspense.mp3` | 1,0s | tensão subindo antes da virada |
| `click.mp3` | 0,1s | marcação curta, toque de interface |
| `ding.mp3` | 1,0s | destaque, item resolvido |
| `mostrar_magia.mp3` | 1,2s | revelação, app aparecendo |
| `error.mp3` | 0,5s | erro, susto, alerta |
| `money.mp3` | 0,8s | dinheiro, custo, desperdício |

**Falta:** um impacto grave seco (o "tum" do primeiro quadro) para o hook sonoro.

## Para adicionar mais

Jogue o arquivo aqui (`.mp3` ou `.wav`), com nome minúsculo, sem acento e sem espaço. Bancos com
uso liberado: Pixabay Sounds, Mixkit, Freesound (conferir licença). O Claude corta o silêncio e
iguala o volume antes de usar.

**Atenção no Windows:** `SOM.MP3` e `som.mp3` são o mesmo arquivo para o sistema. Mande sempre em
minúsculo, senão um sobrescreve o outro.
