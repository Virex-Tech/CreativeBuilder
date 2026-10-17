# Specs entregues — não re-renderizar

Estes criativos já foram renderizados, entregues e salvos pelo usuário fora do repositório.
As gravações de tela que eles usavam foram apagadas em 16/10/2026, quando o app foi regravado
em 18 telas novas (`render/public/app/ozempro/br/tela-cheia/` e `mockup/`).

**Os tempos das cenas foram mapeados nas gravações antigas.** Apontar estes specs para as
gravações novas faz cada cena cair num trecho errado da tela — o mesmo erro descrito em
"A tela tem que ser a tela que a narração diz" no AGENTS.md.

Se algum dia for preciso refazer um deles, trate como criativo novo: `recorte.mjs amostra` em
cada gravação e remapeie `startFromMs` cena por cena.
