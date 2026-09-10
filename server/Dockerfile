FROM node:22-bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends openssl \
	&& rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY prisma ./prisma
RUN npx prisma generate

COPY . .
RUN npm run build

ENV NODE_ENV=production
ENV PORT=11200
EXPOSE 11200

# Migrations run at boot: with a single VPS and one API container, this is simpler and
# safer than a separate migration step someone forgets to run.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.js"]
