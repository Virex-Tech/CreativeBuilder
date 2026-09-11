# Deploy no VPS

Ferramenta interna, sem billing e sem cadastro aberto: um admin cria as contas.

## 1. Pré-requisitos no VPS

- Docker + Docker Compose
- ~4 GB de RAM. O render é o guloso: Chrome headless com `RENDER_CONCURRENCY=2` usa bem
  mais que os outros serviços somados. Com 2 GB, sobe mas engasga em vídeo longo.
- Portas 3000 (web) e 11200 (API) alcançáveis — ver §5 antes de expor.

## 2. Configurar

```bash
git clone <repo> creativebuilder && cd creativebuilder
cp .env.example .env
```

Edite o `.env`:

```bash
POSTGRES_PASSWORD=<senha forte>
JWT_SECRET=$(openssl rand -hex 32)     # mínimo 32 caracteres, a API recusa subir sem isso
PUBLIC_API_URL=http://SEU_IP:11200     # como o NAVEGADOR enxerga a API
ALLOWED_ORIGINS=http://SEU_IP:3000     # endereço do front
RENDER_CONCURRENCY=2
```

`PUBLIC_API_URL` é embutida no bundle do front na hora do build — **mudou, precisa
rebuildar o web**, reiniciar não adianta. É o erro mais comum aqui.

## 3. Migrations

Nada a fazer à mão: a migration inicial já está no repositório
(`server/prisma/migrations/0_init`) e o container da API roda `prisma migrate deploy` a cada
boot.

Mudou o `server/prisma/schema.prisma`? Gere a nova migration com o banco no ar e commite:

```bash
docker compose up -d postgres
cd server
npm ci
DATABASE_URL=postgresql://creativebuilder:<senha>@localhost:5440/creativebuilder \
  npx prisma migrate dev --name <nome>
```

## 4. Subir

```bash
docker compose up -d --build
docker compose ps
curl http://localhost:11200/health     # espera {"ok":true,"db":true}
curl http://localhost:11100/health     # render
```

Crie o primeiro usuário — **a primeira conta nasce ADMIN sem precisar de token**, e só
funciona enquanto não existir nenhum usuário:

```bash
curl -X POST http://localhost:11200/auth/users \
  -H "Content-Type: application/json" \
  -d '{"email":"voce@empresa.com","password":"<senha forte>","name":"Seu Nome"}'
```

Acesse `http://SEU_IP:3000`.

## 5. Antes de deixar exposto na internet

O compose publica as portas direto, **sem HTTPS e sem proxy**. Para uso interno isso é
aceitável numa rede fechada; exposto na internet, não é. Escolha um:

- **Caddy ou nginx** na frente, com TLS (Caddy resolve certificado sozinho), e as portas
  3000/11200 fechadas no firewall.
- **VPN / Tailscale**: mantém tudo privado e dispensa TLS público.

Sem uma das duas, o token JWT trafega em texto claro.

## 6. Backup

O que dói perder é o banco — os specs e a linhagem. Renders se refazem.

```bash
docker exec creativebuilder-postgres pg_dump -U creativebuilder creativebuilder | gzip > backup-$(date +%F).sql.gz
```

O volume `media` guarda renders e assets gerados. Vale backup também: asset do Higgsfield
**expira em ~7 dias** no provedor, então depois disso a cópia local é a única que existe.

## 7. O que fica fora do deploy (por decisão)

- **IA**: nenhuma chave de IA vai para o VPS. Escrita do spec, b-roll (Higgsfield via
  CLI/MCP) e diagnóstico de métricas rodam no Claude Code de quem opera — ver
  `docs/ATIVACAO-IA.md`. Os endpoints de IA do servidor respondem `503`.
- **Métricas**: nenhuma integração com a Meta; a análise é por CSV exportado.
