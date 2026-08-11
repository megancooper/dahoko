FROM node:22-bookworm-slim AS build

WORKDIR /app
RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/sync-server/package.json apps/sync-server/package.json
COPY packages/typescript-config/package.json packages/typescript-config/package.json
RUN pnpm install --frozen-lockfile --filter @dahoko/sync-server...

COPY apps/sync-server apps/sync-server
COPY packages/typescript-config packages/typescript-config
RUN pnpm --filter @dahoko/sync-server build
# Self-contained folder with dist + production node_modules (pg driver).
RUN pnpm --filter @dahoko/sync-server deploy --prod /deploy

FROM node:22-bookworm-slim AS runtime

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=8787
ENV DAHOKO_SYNC_DATABASE=/data/dahoko-sync.sqlite

WORKDIR /app
RUN useradd --system --uid 10001 --create-home dahoko \
  && mkdir -p /data \
  && chown dahoko:dahoko /data
COPY --from=build --chown=dahoko:dahoko /deploy/dist ./dist
COPY --from=build --chown=dahoko:dahoko /deploy/node_modules ./node_modules
COPY --from=build --chown=dahoko:dahoko /deploy/package.json ./package.json

USER dahoko
EXPOSE 8787
VOLUME ["/data"]
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:8787/health').then(response => process.exit(response.ok ? 0 : 1)).catch(() => process.exit(1))"
CMD ["node", "dist/index.js"]
