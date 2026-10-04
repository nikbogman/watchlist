# Reel scraper: experiment findings

Results of the prototype from [#14](https://github.com/nikbogman/watchlist/issues/14), which tested whether scraping an Instagram reel's description and comments works well enough to build into the server. All numbers come from runs on 2026-10-04 on a Windows laptop, using headless Chromium and one throwaway account.

**Verdict: it works.** Scraping a reel is reliable and reasonably fast, and the account wasn't flagged during testing. The remaining risks are how long the session lasts and how fast Instagram blocks an account under real use.

## How it works

1. The scraper opens `https://www.instagram.com/p/<shortcode>/` in Chromium using a saved, logged-in session (at the time a local `.instagram-session.json`; now the `instagram_session` table, written by `pnpm reel:login`).
2. The first ~14 comments and the caption come embedded in the HTML page, inside `<script type="application/json">` blobs.
3. To get more, it moves the mouse over the comments panel and scrolls with the wheel. Each scroll makes Instagram request the next page of comments through `/api/graphql` (`PolarisPostCommentsPaginationQuery`), about 15 comments per page.
4. It reads every response as it arrives. Comments are the nodes under `xdt_api__v1__media__media_id__comments__connection` (replies are skipped). The caption is the `caption.text` of the media whose `code` matches the shortcode.
5. It stops when it reaches `maxComments` (default 200), when Instagram reports `has_next_page: false`, or after 10 seconds with no new comments.

### Lessons learned

- **A bare `/reel/<code>/` link has no comments.** It opens the full-screen reel viewer, where comments are hidden. `/p/<code>/` opens the post view with the comments panel, so the scraper always uses that. `/<username>/reel/<code>/` links work too.
- **Setting `scrollTop` doesn't load more comments.** Only real mouse-wheel events trigger pagination.
- **Instagram's markup is obfuscated** (generated class names, and the login form has no `name` attributes). The only selectors the scraper relies on are "the scrollable box on the page" and the `og:description` meta tag.

## Performance

These runs scraped one reel, [itsjustcinema](https://www.instagram.com/p/DNBbfSkMPuy/), which has about 1,000 comments, about 750 of them top-level.

| `maxComments` | 1.5s wait per scroll | 0.5s wait per scroll (current) |
| ------------- | -------------------- | ------------------------------ |
| 10            | 10 in 5.8s           | –                              |
| 50            | 50 in 9.1s           | 50 in 6–7s                     |
| 200 (default) | 200 in 25.6s         | 200 in 12–15s                  |
| 500           | 500 in 57.4s         | 494 in 28–33s                  |
| 2000          | –                    | 749 (all top-level) in 32.8s   |

- **Startup takes about 5–6 seconds:** launching the browser, loading the page and waiting for the network to go quiet. Up to ~14 comments cost nothing extra.
- **Scrolling adds about 15–20 comments per second** with the current 0.5s wait.
- **A full reel of about 750 top-level comments takes about 33 seconds.**

## Concurrency

In the prototype, every `scrapeReel` call started and closed its own browser, so calls could run in parallel with no shared state:

```ts
await Promise.all(urls.map((url) => scrapeReel(url, { maxComments: 100 })))
```

Measured on 3 reels with `maxComments: 100`:

| Mode              | Time                      |
| ----------------- | ------------------------- |
| One after another | 52.1s                     |
| In parallel       | 22.6s (about 2.3× faster) |

- **Memory:** each parallel call was a full Chromium process, roughly 200–300 MB of RAM. The server now shares one browser, with a fresh context per reel, and scrapes one reel at a time.
- **Account risk:** several parallel sessions on one account look the most like a bot. Keep it to 2–3 at a time.

## Session and account

- **Login:** a new account's first login from a new browser triggered Instagram's verification checkpoint (a code by email). It only had to be passed once. Every run since has reused the saved session.
- **Flagging:** none of the ~20 runs on 2026-10-04 hit a checkpoint or got redirected to login, including the parallel runs.
- **Session lifetime: unknown.** It hasn't expired yet. When it does, the scraper throws an error telling you to run `pnpm reel:login`.

## Known issues

- **Runs sometimes come back a little under the cap.** Examples: 494 of 500, and 94 and 98 of 100 on two other reels. The cause isn't known yet. Possibly Instagram stalls between pages for longer than the 10-second safety limit, or it returns overlapping pages.
- **Comment order is Instagram's "For you" order**, not newest-first or most-liked.
- **If the comments panel isn't found,** the scraper quietly returns only the ~14 comments embedded in the page.

## Open questions

- How long does a saved session stay valid?
- How much real use can one account take before Instagram checkpoints or bans it?
- Does Instagram block requests from Railway's IP addresses?
- Chromium in the deploy image adds about 150 MB and needs RAM per concurrent scrape.
