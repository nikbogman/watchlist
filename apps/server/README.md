# server

```sh
cp .env.example .env   # set BETTER_AUTH_SECRET (openssl rand -base64 32) and SEED_*
pnpm seed              # create the one account, or reset its password and sessions
pnpm dev               # http://localhost:3000, migrations run on start
pnpm test
```

After changing `src/schema/`, run `pnpm db:generate` to add a migration.
