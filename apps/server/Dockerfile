FROM node:20-bookworm-slim AS web-builder

WORKDIR /app
COPY package.json package-lock.json* ./
COPY packages/panel/package.json ./packages/panel/
COPY apps/web/package.json ./apps/web/

RUN npm install --workspace=@precious/panel --workspace=@precious/web

COPY packages/panel ./packages/panel
COPY apps/web ./apps/web

ENV PRECIOUS_STATIC_EXPORT=1
ENV NEXT_PUBLIC_PRECIOUS_MODE=local
RUN npm run build --workspace=@precious/web

FROM node:20-bookworm-slim AS server-builder

WORKDIR /app
COPY package.json package-lock.json* ./
COPY packages/core/package.json ./packages/core/
COPY packages/db/package.json ./packages/db/
COPY packages/providers/package.json ./packages/providers/
COPY apps/server/package.json ./apps/server/

RUN npm install --workspace=@precious/core --workspace=@precious/db --workspace=@precious/providers --workspace=@precious/server

COPY packages ./packages
COPY apps/server ./apps/server

RUN npm run build --workspace=@precious/core && \
    npm run build --workspace=@precious/db && \
    npm run build --workspace=@precious/providers && \
    npm run build --workspace=@precious/server

FROM node:20-bookworm-slim

RUN apt-get update && apt-get install -y wget && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY --from=server-builder /app/node_modules ./node_modules
COPY --from=server-builder /app/packages ./packages
COPY --from=server-builder /app/apps/server ./apps/server
COPY --from=web-builder /app/apps/web/out ./apps/web/out
COPY package.json ./

ENV PORT=3001
ENV DATA_DIR=/data
ENV DATABASE_PATH=/data/precious.db
ENV WEB_DIST=/app/apps/web/out

EXPOSE 3001
VOLUME ["/data"]

CMD ["node", "apps/server/dist/index.js"]
