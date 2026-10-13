# entrada/ — coloque aqui vídeos, imagens, músicas e referências

Arraste para esta pasta (no VS Code ou no Explorador de Arquivos) qualquer material bruto:
gravações de tela do app, prints, vídeos filmados, UGC, fotos, trilhas e vídeos de referência.
O que fica aqui **não vai para o GitHub** — é pesado e é material bruto. O Claude copia **só o
trecho usado** para `render/public/` (que vai para o GitHub).

## Organização

```
entrada/
  <app>/                 ozempro
    gravacoes/           gravações de tela do app (.mp4 / .mov)
    prints/              prints de tela do app (.png / .jpg)
    filmagens/           vídeos com pessoas: UGC, atrizes, bastidores
    fotos/               fotos reais (pessoas só com autorização)
    musicas/             trilhas (.mp3 / .wav) com direito de uso
    referencias/         vídeos de outros anúncios usados como modelo
    panda/               mascote: takes de animação, referências e cenários (ver LEIA-ME de lá)
    meta-ads/            criativos baixados do Meta pelo Claude (não mexa)
```

## Nome dos arquivos

```
<recurso>-<o-que-mostra>.<ext>
```

- tudo minúsculo, **sem acento e sem espaço**;
- separe as palavras por `-` ou `_` (os dois valem — o que importa é começar pelo recurso);
- **recurso:** a tela/funcionalidade (lista abaixo);
- **o-que-mostra:** a ação, curta (`registrar-dose-e-local`, `macros-por-foto`, `resumo-geral`);
- nova versão do mesmo take: `-v2` no fim;
- só acrescente idioma e plataforma quando existir mais de uma versão (`..._en`, `..._android`).

Exemplos que já estão na pasta e servem de padrão:

```
entrada/ozempro/gravacoes/aplicacao_registrar-dose-e-local.mp4
entrada/ozempro/gravacoes/calculadora-calcular-risquinho-na-seringa.mp4
entrada/ozempro/prints/pagina_inicial-resumo_geral.jpg
```

**Recursos do OzemPro:** `pagina_inicial` · `onboarding` · `paywall` · `aplicacao` · `lembrete` ·
`estoque` · `nivel_medicacao` · `calculadora` · `efeitos-colaterais` · `historico` ·
`linha_do_tempo` · `tratamento` · `grafico_peso` · `medidas` · `evolucao` ·
`registro_alimentacao` · `calorias_e_agua` · `cardapio` · `sugestao_receita` · `suplementos` ·
`registro_atividade_fisica` · `comunidade` · `chat_ia` · `widget` · `relatorio`

**Filmagens e fotos:** `<pessoa>-v<n>.mp4` (`vitoria-v1.mp4`, `xanda-v2.mp4`). Se der, acrescente
o cenário: `vitoria-cozinha-v1.mp4`.

**Músicas:** `<clima>-<nome-ou-fonte>.mp3` (`calma-lofi-01.mp3`, `animada-upbeat-02.mp3`).

**Referências:** `<origem>-<tema>.mp4` (`concorrente-dose-seringa.mp4`, `tiktok-rotina-manha.mp4`).

**Panda (animação):** fotos de fundo branco em `panda/poses/` (`panda_gordo.png`), panda já na cena
em `panda/cenarios/` (`cenario_cozinha_empurrando_comida.png`) e vídeos em `panda/takes/`
(`panda_bravo-pulando-na-balanca-banheiro.mp4`) — detalhes em `entrada/ozempro/panda/LEIA-ME.md`.

## Como gravar

- **Um fluxo por arquivo**, de 5 a 30s, começando já na tela certa.
- Conta de teste, com dados bonitos e plausíveis (nada de dado real de paciente).
- Modo Não Perturbe ligado (sem notificação), bateria cheia, Wi-Fi e sinal cheios.
- Toques **devagar e firmes**, pausa de ~1s em cada tela importante.
- Gravação nativa do celular (resolução cheia, vertical). Print com o botão do aparelho.

## Áudio

- **Música:** não existe banco de trilhas no projeto. Toda trilha vem de vocês, em
  `musicas/` (com direito de uso). Efeitos de corte prontos ficam em `render/public/sfx/`.
- **Voz:** ou vocês gravam e colocam em `musicas/` (ou mandam o arquivo), ou o Claude gera a
  locução no Higgsfield, mostrando o custo antes.

Depois é só pedir, por exemplo:

> usa entrada/ozempro/gravacoes/calculadora-calcular-risquinho-na-seringa.mp4 na cena 2, de 0:03 a 0:08
