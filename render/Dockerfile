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

COPY package*.json ./
RUN npm ci

COPY . .

# Chrome headless na imagem: sem isso ele é baixado no 1º render depois de cada deploy (lento, e
# falha se a rede do container estiver ruim naquela hora).
RUN npx remotion browser ensure

ENV PORT=11100
EXPOSE 11100

CMD ["npx", "tsx", "server.ts"]
