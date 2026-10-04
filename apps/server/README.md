# server

```sh
cp .env.example .env   # set DATABASE_URL (Postgres), BETTER_AUTH_SECRET (openssl rand -base64 32), SEED_*, TMDB_API_KEY and GEMINI_API_KEY (free at aistudio.google.com/apikey)
pnpm seed              # create the one account, or reset its password and sessions
pnpm reel:login        # log in to Instagram in a browser; saves the session the reel scraper uses
pnpm dev               # http://localhost:3000, migrations run on start
pnpm test
```

After changing a feature's `schema.ts`, run `pnpm db:generate` to add a migration.

## Reel scraper (`src/reels`)

Finds which movie or TV show an Instagram reel is about. Prototype from [#14](https://github.com/nikbogman/watchlist/issues/14).

`POST /api/reels { url }` queues a job in the `reel_scrape` table; poll `GET /api/reels/:id` until `status` is `done` (with `reel`) or `failed` (with `error`). One worker in the server process runs jobs one at a time, oldest first.

**How a job runs**

1. Opens `instagram.com/p/<shortcode>/` in a shared headless Chromium, in a fresh context holding the saved session (`instagram_session` table, written by `pnpm reel:login`).
2. Reads the caption and comments from the JSON Instagram embeds in the page (~14 comments) and from the GraphQL responses it fetches as the comments panel is scrolled (~15 per page). Replies are skipped.
3. Every 20 new comments, asks Gemini (`gemini-3.1-flash-lite`, free AI Studio key) for the title, given the caption and that batch. Stops scrolling at the first batch that names one, at 200 comments, at the last page, or after 10s with no new comments.
4. Matches a movie to TMDB by name and year (`reel.title.tmdbId`). TV shows stay unmatched.

**Gotchas**

- A bare `/reel/<code>/` link opens the viewer, which hides comments, so the scraper always uses `/p/<code>/`.
- Only real mouse-wheel events load more comments; setting `scrollTop` doesn't.
- Instagram's markup is obfuscated. The only selectors used are "the scrollable box" and the `og:description` meta tag.

**Performance** (2026-10-04, Windows laptop, a reel with ~750 top-level comments)

| Comments | Time   |
| -------- | ------ |
| ≤ 14     | 5–6s   |
| 50       | 6–7s   |
| 200      | 12–15s |
| all 749  | 33s    |

- Startup (page load, network idle) is 5–6s; scrolling then adds 15–20 comments/s.
- A reel identified in its first batch takes about 6s plus one Gemini call. The worst case is 200 comments and 10 Gemini calls, within the free tier's ~15 requests/min.
- Each browser context costs memory; the prototype's one-browser-per-reel used 200–300 MB each.

**Account and session**

- The first login from a new browser hit Instagram's email-code checkpoint once; the saved session has been reused since.
- ~20 runs, including parallel ones, were never flagged. Keep concurrency at 2–3 at most; parallel sessions look most like a bot.
- When the session expires, jobs fail with a hint to run `pnpm reel:login`. To reuse an exported Playwright session instead: `pnpm reel:login path/to/state.json`.

**Known issues and open questions**

- Runs sometimes stop a few comments under the cap (494 of 500). The cause is unknown.
- Comments come in Instagram's "For you" order.
- If the comments panel isn't found, only the ~14 embedded comments are read.
- Unknown: how long a session lasts, how much use one account takes before a checkpoint or ban, and whether Instagram blocks Railway's IPs.
- The deploy image needs `pnpm exec playwright install --with-deps chromium` (about 150 MB).
