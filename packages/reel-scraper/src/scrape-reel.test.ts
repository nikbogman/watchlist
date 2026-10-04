import { existsSync } from 'node:fs'
import { expect, test } from 'vitest'
import { SESSION_FILE, scrapeReel } from './scrape-reel.js'

const hasSession = existsSync(SESSION_FILE)

test('rejects a URL that is not an Instagram reel or post', async () => {
  await expect(scrapeReel('https://www.instagram.com/nasa/')).rejects.toThrow(/not an Instagram reel/)
  await expect(scrapeReel('https://example.com/reel/abc123/')).rejects.toThrow(/not an Instagram reel/)
})

test.skipIf(hasSession)('asks to log in when no session is saved', async () => {
  await expect(scrapeReel('https://www.instagram.com/reel/abc123/')).rejects.toThrow(/reel:login/)
})

// Live: hits Instagram with the saved session. Replace the reel if it disappears.
const REEL = 'https://www.instagram.com/p/DNBbfSkMPuy/'

test.runIf(hasSession)('scrapes the description and comments of a live reel', { timeout: 120_000 }, async () => {
  const reel = await scrapeReel(REEL)

  expect(reel.url).toBe(REEL)
  expect(reel.description).toContain('Son of the White Mare')
  expect(reel.comments.length).toBeGreaterThan(0)
  for (const c of reel.comments) {
    expect(c.author).not.toBe('')
    expect(typeof c.text).toBe('string')
    expect(Number.isInteger(c.likes) && c.likes >= 0).toBe(true)
    expect(c.createdAt.getTime()).toBeGreaterThan(Date.UTC(2010, 0))
  }
})

test.runIf(hasSession)('gets comments from a /reel/ link, which opens the comment-less reel viewer', { timeout: 120_000 }, async () => {
  const reel = await scrapeReel('https://www.instagram.com/reel/DNBbfSkMPuy/', { maxComments: 5 })

  expect(reel.comments).toHaveLength(5)
})

test.runIf(hasSession)('pages through comments up to the cap', { timeout: 120_000 }, async () => {
  // The reel has 1000+ comments and the page embeds only the first ~15, so 40 needs scrolling.
  const reel = await scrapeReel(REEL, { maxComments: 40 })

  expect(reel.comments).toHaveLength(40)
  expect(new Set(reel.comments.map((c) => `${c.author}:${c.text}`)).size).toBe(40)
})
