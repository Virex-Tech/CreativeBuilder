FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY web/package*.json ./
RUN npm ci

FROM node:22-bookworm-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
# The web app imports SpecRenderer straight from the render project, so the build context
# is the repo root and both folders must be present. Copying only web would fail
# at the "@render/*" alias.
COPY web ./
COPY render/src /render/src
COPY render/package.json /render/package.json
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
RUN npm run build

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/public ./public
EXPOSE 3000
CMD ["npm", "run", "start"]
