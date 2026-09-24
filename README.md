# CreativeBuilder

Cria vídeos de anúncio para apps a partir de uma referência ou de uma ideia. Você conversa com
o **Claude Code**; ele escreve o roteiro (`CreativeSpec`), gera vídeo e voz na **Kie.ai**
(`tools/kie.mjs`, pré-paga — a chave fica só no seu computador) e edita o MP4 com o **Remotion** —
tudo **local**, na máquina de quem usa. O **Higgsfield** segue disponível como alternativa
guardada (mensalidade fixa em vez de pré-paga).

**Primeira vez? Leia [COMECE-AQUI.md](COMECE-AQUI.md).** Instalação, primeiro teste e pedidos
prontos para copiar.

Checagem rápida do ambiente:

```bash
node tools/doctor.mjs
```

## Documentação

| Documento | Para quem |
|---|---|
| [COMECE-AQUI.md](COMECE-AQUI.md) | quem vai usar — passo a passo sem jargão |
| [render/specs/_modelos/LEIA-ME.md](render/specs/_modelos/LEIA-ME.md) | os modelos de vídeo (100% IA, com app, imagem no final) |
| [apps/](apps/) | contexto de cada app (produto, público, marca, regras de anúncio) |
| [docs/COMO-USAR.md](docs/COMO-USAR.md) | referência técnica: comandos, campos do spec, Kie.ai (e alternativa Higgsfield), legenda, takes |
| [docs/ESTUDIO.md](docs/ESTUDIO.md) | Estúdio de conteúdo na plataforma web (calendário, aprovação, Instagram) |
| [AGENTS.md](AGENTS.md) · [.claude/skills/criativo/SKILL.md](.claude/skills/criativo/SKILL.md) | instruções que o agente segue |
| [render/README.md](render/README.md) | renderer Remotion (layers, edição, áudio) |

## Estrutura

```
apps/        contexto de produto de cada app (apps/<slug>/contexto.md) — o Claude lê antes de criar
referencias/ criativos que deram certo: ranking e fichas por app (referencias/<slug>/)
directors/   regras de edição por app (ritmo, legendas, o que nunca fazer)
render/      Remotion — renderer, specs (render/specs), modelos (render/specs/_modelos),
             material do app (public/app), b-roll (public/broll), voz (public/audio), sfx (public/sfx),
             takes gravados preparados (public/takes)
tools/       spec-tool (validate, check, props, variant, diff, sync-captions, footage), review,
             ingest-reference, transcribe, takes (takes gravados), doctor
entrada/     material bruto anexado (fora do git)
.claude/     skill "criativo" e permissões do projeto para o Claude Code
```

## Plataforma web

Além do fluxo local, a plataforma (`web/` + `server/`, no ar em creativebuilder.paywallo.com.br) tem:

- **Estúdio de conteúdo** (`/estudio`) — contas, calendário da semana, takes gravados (upload,
  links, Drive, link de envio pro criador ou gerados na Kie.ai), edição pela IA, aprovar/pedir
  alteração e publicação no Instagram. Ver [docs/ESTUDIO.md](docs/ESTUDIO.md).
- **Concorrentes** (`/apps/<id>/concorrentes`) — vencedores → criativo próprio → rascunho pausado na Meta.

Deploy e arquitetura: [DEPLOY.md](DEPLOY.md), [docs/architecture.md](docs/architecture.md).
