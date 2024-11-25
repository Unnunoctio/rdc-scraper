FROM oven/bun:1.1.34-alpine

WORKDIR /app

COPY package.json bun.lockb* ./

RUN bun install --frozen-lockfile --production

COPY . .

CMD ["bun", "src/index.ts"]