# The server, with the Chromium the reel scraper drives. Railway builds this instead of Railpack.
FROM node:24-bookworm-slim
WORKDIR /app
RUN corepack enable

# Manifests first, so code changes don't redo the install or the ~150 MB browser download.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/server/package.json apps/server/
COPY apps/mobile/package.json apps/mobile/
RUN pnpm install --filter server... --frozen-lockfile
# Chromium matching the installed Playwright, plus the system libraries it needs.
RUN pnpm --filter server exec playwright install --with-deps chromium

COPY apps/server apps/server
CMD ["pnpm", "--filter", "server", "start"]
