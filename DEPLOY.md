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

## 3. Migration inicial (uma vez)

O repositório ainda **não tem migration** — só o `schema.prisma`. Gere a primeira com o
banco no ar:

```bash
docker compose up -d postgres
cd api
npm ci
DATABASE_URL=postgresql://creativebuilder:<senha>@localhost:5440/creativebuilder \
  npx prisma migrate dev --name init
cd ..
git add api/prisma/migrations && git commit -m "migration inicial"
```

Depois disso o container da API roda `prisma migrate deploy` sozinho a cada boot, e você
nunca mais precisa fazer isso à mão.

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

## 7. Ainda não está no deploy

- **Geração no Higgsfield**: o CLI não está instalado em nenhum container e o fluxo não
  está ligado à API. Hoje a geração roda pelo Claude Code na máquina de quem opera.
- **Ingestão de referência**: `tools/ingest-reference.mjs` roda local, não pela API.
- **Métricas**: nenhuma integração com a Meta; a análise é por CSV exportado.
