# creative-engine — renders CreativeSpec → MP4/PNG, validates specs, finalizes footage edits and
# serves the browser preview (/preview/). HTTP contract: README.md. Image name: creative-engine.
FROM node:22-bookworm-slim

# Remotion renders in headless Chrome. These are the libraries it needs; without them the
# browser fails to start with an error that says nothing about missing packages.
RUN apt-get update && apt-get install -y --no-install-recommends \
	ffmpeg \
	libnss3 libdbus-1-3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 \
	libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 \
	libgbm1 libasound2 libpango-1.0-0 libcairo2 fonts-liberation \
	# Inter = fonte padrão do brandKit; sem ela o Chrome cai numa serifada. Emoji colorido nas legendas.
	fonts-inter fonts-noto-color-emoji \
	&& rm -rf /var/lib/apt/lists/*

WORKDIR /app
RUN chown node:node /app

# Everything below is owned by (and built as) the unprivileged `node` user: the service runs as
# it, and Remotion writes its webpack cache under node_modules/.cache at runtime.
USER node

COPY --chown=node:node package*.json ./
RUN npm ci

COPY --chown=node:node . .

# Preview page (/preview/) + lib/engine.mjs. `check` fails the build if the committed lib is stale.
RUN npm run build:preview && node scripts/build.mjs check

# Chrome headless na imagem: sem isso ele é baixado no 1º render depois de cada deploy (lento, e
# falha se a rede do container estiver ruim naquela hora).
RUN npx remotion browser ensure

ENV PORT=11100
EXPOSE 11100

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
	CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||11100)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# The entrypoint starts as root only to fix the output dir's owner, then drops to `node`.
USER root
ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["npx", "tsx", "server.ts"]
