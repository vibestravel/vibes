# Vibes AI — production image
FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:22-bookworm-slim AS run
WORKDIR /app
ENV NODE_ENV=production PORT=3000
RUN useradd -r -u 1001 vibes && mkdir -p /data/storage && chown vibes /data/storage
COPY --from=build /app ./
USER vibes
EXPOSE 3000
# apply pending DB migrations, then start
CMD ["sh", "-c", "npx tsx scripts/migrate.ts && npm start"]
