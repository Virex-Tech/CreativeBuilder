FROM node:22-bookworm-slim

# openssl: Prisma. ffmpeg: reference ingestion (frame/audio extraction). yt-dlp: pulling a
# reference from a social link (Instagram/TikTok/YouTube), which ffmpeg cannot fetch itself.
# faster-whisper: transcrição com tempo por palavra dos takes do estúdio (py/transcribe.py).
# O modelo baixa na 1ª vez pra HF_HOME, que fica no volume de mídia (não baixa a cada deploy).
RUN apt-get update && apt-get install -y --no-install-recommends \
		openssl ffmpeg python3 python3-pip \
	&& pip3 install --no-cache-dir --break-system-packages yt-dlp faster-whisper \
	&& rm -rf /var/lib/apt/lists/*

# Codex CLI: provider de IA quando AI_PROVIDER=codex. Autentica por OAuth via CODEX_HOME
# montado no container (ver docker-compose). Sem isso, a geração por IA responde 503.
RUN npm i -g @openai/codex

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY prisma ./prisma
RUN npx prisma generate

COPY . .
RUN npm run build

ENV NODE_ENV=production
ENV HF_HOME=/media/.whisper-cache
ENV PORT=11200
EXPOSE 11200

# Migrations run at boot: with a single VPS and one API container, this is simpler and
# safer than a separate migration step someone forgets to run.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.js"]
