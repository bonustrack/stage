FROM oven/bun:1.3-alpine

WORKDIR /app

# Install workspace + this package's deps using the lockfile.
COPY package.json bun.lock ./
COPY apps/mcp/package.json ./apps/mcp/package.json
RUN bun install --frozen-lockfile --filter @metro-labs/mcp

COPY apps/mcp ./apps/mcp

WORKDIR /app/apps/mcp

EXPOSE 8080

CMD ["bun", "src/index.ts"]
