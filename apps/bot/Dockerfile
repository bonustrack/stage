FROM oven/bun:1.3-alpine

WORKDIR /app

# Install only what we need for this package by leveraging the workspace layout.
COPY package.json bun.lock ./
COPY apps/bot/package.json ./apps/bot/package.json
RUN bun install --frozen-lockfile --filter @metro-labs/bot

COPY apps/bot ./apps/bot

WORKDIR /app/apps/bot
CMD ["bun", "src/index.ts"]
