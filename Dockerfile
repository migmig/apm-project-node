FROM oven/bun:1.3.10 AS builder

WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY client ./client
RUN bun run build

FROM oven/bun:1.3.10-slim AS runtime

WORKDIR /app

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=9900

COPY package.json ./
COPY src ./src
COPY --from=builder /app/dist ./dist

RUN mkdir -p /app/data

EXPOSE 9900

CMD ["bun", "src/server.js"]
