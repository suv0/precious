FROM node:20-bookworm-slim AS builder

WORKDIR /app
COPY package.json package-lock.json* ./
COPY packages/core/package.json ./packages/core/
COPY packages/providers/package.json ./packages/providers/
COPY apps/server/package.json ./apps/server/

RUN npm install --workspace=@precious/core --workspace=@precious/providers --workspace=@precious/server

COPY packages ./packages
COPY apps/server ./apps/server
COPY tsconfig.json* ./

RUN npm run build --workspace=@precious/core && \
    npm run build --workspace=@precious/providers && \
    npm run build --workspace=@precious/server

FROM node:20-bookworm-slim

RUN apt-get update && apt-get install -y wget && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/apps/server ./apps/server
COPY package.json ./

ENV PORT=3001
ENV DATA_DIR=/data
ENV DATABASE_PATH=/data/precious.db

EXPOSE 3001
VOLUME ["/data"]

CMD ["node", "apps/server/dist/index.js"]
