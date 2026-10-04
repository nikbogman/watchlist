# server

```sh
cp .env.example .env   # set DATABASE_URL (Postgres), BETTER_AUTH_SECRET (openssl rand -base64 32) and SEED_*
pnpm seed              # create the one account, or reset its password and sessions
pnpm reel:login        # log in to Instagram in a browser; saves the session the reel scraper uses
pnpm dev               # http://localhost:3000, migrations run on start
pnpm test
```

After changing a feature's `schema.ts`, run `pnpm db:generate` to add a migration.

Reel scrapes (`POST /api/reels`, then poll `GET /api/reels/:id`) run one at a time in a single shared Chromium inside the server process. The deploy image needs `pnpm exec playwright install --with-deps chromium`. To reuse an exported Playwright session instead of logging in: `pnpm reel:login path/to/state.json`.
