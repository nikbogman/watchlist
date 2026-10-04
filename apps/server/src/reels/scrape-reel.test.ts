import { afterAll, beforeAll, expect, test } from 'vitest'
import { chromium, type Browser } from 'playwright'
import { scrapeReel } from './scrape-reel'

// Live: scrapes Instagram with a session file exported by Playwright (e.g. from `context.storageState()`).
// Set INSTAGRAM_SESSION_FILE to run. Replace the reel if it disappears.
const SESSION = process.env.INSTAGRAM_SESSION_FILE
const REEL = 'https://www.instagram.com/p/DNBbfSkMPuy/'

let browser: Browser
beforeAll(async () => {
  if (SESSION) browser = await chromium.launch()
})
afterAll(() => browser?.close())

const scrape = async (url: string, maxComments?: number) => {
  const context = await browser.newContext({ storageState: SESSION })
  try {
    return await scrapeReel(context, url, { maxComments })
  } finally {
    await context.close()
  }
}

test.runIf(SESSION)('scrapes the description and comments of a live reel', { timeout: 120_000 }, async () => {
  const reel = await scrape(REEL)

  expect(reel.url).toBe(REEL)
  expect(reel.description).toContain('Son of the White Mare')
  expect(reel.comments.length).toBeGreaterThan(0)
  for (const c of reel.comments) {
    expect(c.author).not.toBe('')
    expect(typeof c.text).toBe('string')
    expect(Number.isInteger(c.likes) && c.likes >= 0).toBe(true)
    expect(Date.parse(c.createdAt)).toBeGreaterThan(Date.UTC(2010, 0))
  }
})

test.runIf(SESSION)('gets comments from a /reel/ link, which opens the comment-less reel viewer', { timeout: 120_000 }, async () => {
  const reel = await scrape('https://www.instagram.com/reel/DNBbfSkMPuy/', 5)

  expect(reel.comments).toHaveLength(5)
})

test.runIf(SESSION)('pages through comments up to the cap', { timeout: 120_000 }, async () => {
  // The reel has 1000+ comments and the page embeds only the first ~15, so 40 needs scrolling.
  const reel = await scrape(REEL, 40)

  expect(reel.comments).toHaveLength(40)
  expect(new Set(reel.comments.map((c) => `${c.author}:${c.text}`)).size).toBe(40)
})
