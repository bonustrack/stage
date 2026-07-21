FROM oven/bun:1.3.13

WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY tsconfig.json ./
COPY src ./src

VOLUME ["/app/data"]

CMD ["bun", "run", "src/index.ts"]
