# entrada/ — coloque aqui vídeos e imagens para usar nos criativos

Arraste para esta pasta (no VS Code ou no Explorador de Arquivos) qualquer material bruto:
gravações de tela do app, vídeos filmados, UGC, fotos, prints. O que fica aqui **não vai para o
GitHub** — é pesado e é material bruto. O Claude copia **só o trecho usado** para
`render/public/` (que vai para o GitHub).

## Organização

```
entrada/
  <app>/                 ozempro, tapfit...
    gravacoes/           gravações de tela do app (.mp4 / .mov)
    prints/              prints de tela do app (.png / .jpg)
    filmagens/           vídeos com pessoas, UGC, bastidores
    fotos/               fotos reais (pessoas só com autorização)
    musicas/             trilhas (.mp3 / .wav) com direito de uso
```

## Nome dos arquivos

```
<recurso>_<o-que-mostra>_<idioma>_<plataforma>.<ext>
```

- tudo minúsculo, **sem acento e sem espaço**; palavras separadas por `-`, partes por `_`
- **recurso:** a tela/funcionalidade (lista abaixo)
- **o-que-mostra:** a ação, curta (`fluxo-completo`, `escanear-foto`, `tela-inicial`)
- **idioma:** `pt`, `en`, `es`...
- **plataforma:** `ios` ou `android`
- nova versão do mesmo take: `-v2` no fim (`..._pt_ios-v2.mp4`)

Exemplos (OzemPro):

```
entrada/ozempro/gravacoes/aplicacao_registrar-dose-e-local_pt_ios.mp4
entrada/ozempro/gravacoes/refeicao_escanear-foto-ate-macros_pt_ios.mp4
entrada/ozempro/gravacoes/relatorio_gerar-pdf_pt_android.mp4
entrada/ozempro/prints/home_tela-inicial_pt_ios.png
entrada/ozempro/prints/estoque_aviso-acabando_pt_ios.png
```

Recursos do OzemPro (use estes nomes): `home` · `onboarding` · `paywall` · `aplicacao` ·
`lembrete` · `estoque` · `nivel-medicamento` · `calculadora-doses` · `efeitos-colaterais` ·
`peso-jornada` · `projecao-meta` · `plano` · `refeicao` · `cardapio` · `receitas` ·
`suplementos` · `agua-passos` · `cartao-jornada` · `comunidade` · `noticias` · `chat-ia` ·
`widget` · `apple-saude` · `relatorio`

## Como gravar

- **Um fluxo por arquivo**, de 5 a 30s, começando já na tela certa.
- Conta de teste, com dados bonitos e plausíveis (nada de dado real de paciente).
- Modo Não Perturbe ligado (sem notificação), bateria cheia, Wi-Fi e sinal cheios.
- Toques **devagar e firmes**, pausa de ~1s em cada tela importante.
- Gravação nativa do celular (resolução cheia, vertical). Print com o botão do aparelho.

Depois peça ao Claude Code, por exemplo:

> usa entrada/ozempro/gravacoes/refeicao_escanear-foto-ate-macros_pt_ios.mp4 na cena 2, de 0:03 a 0:08
