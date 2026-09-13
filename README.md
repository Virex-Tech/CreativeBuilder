# CreativeBuilder

Cria vídeos de anúncio para apps a partir de uma referência ou de uma ideia. Você conversa com
o **Claude Code**; ele escreve o roteiro (`CreativeSpec`), gera o b-roll no **Higgsfield** e
renderiza o MP4 com o **Remotion** — tudo local.

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
| [docs/COMO-USAR.md](docs/COMO-USAR.md) | comandos detalhados, plataforma web |
| [docs/ATIVACAO-IA.md](docs/ATIVACAO-IA.md) | onde a IA roda e por quê |
| [AGENTS.md](AGENTS.md) · [.claude/skills/criativo/SKILL.md](.claude/skills/criativo/SKILL.md) | instruções do agente |
| [render/README.md](render/README.md) | renderer Remotion |
| [DEPLOY.md](DEPLOY.md) | deploy da plataforma web no VPS |
| [docs/architecture.md](docs/architecture.md) | arquitetura |

## Estrutura

```
apps/        contexto de produto de cada app (apps/<slug>/contexto.md) — o Claude lê antes de criar
render/      Remotion — specs, renderer, material do app (public/app) e b-roll (public/broll)
tools/       spec-tool (validar, variar, diff), ingest-reference, doctor
directors/   regras de edição por app
.claude/     skill "criativo" e permissões do projeto para o Claude Code
web/ server/ plataforma web opcional (editor, versões, render, métricas CSV)
```
