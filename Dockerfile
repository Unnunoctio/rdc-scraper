FROM oven/bun:1.1.14

# Install curl
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/list/*

WORKDIR /app
COPY . .
RUN bun install

ARG PORT
EXPOSE ${PORT:-3000}

CMD ["bun", "src/index.ts"]