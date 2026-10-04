import { chromium, type Browser, type BrowserContextOptions } from 'playwright'
import type { Db } from '../db'
import { instagramSession, type Reel } from './schema'
import { LOGIN_HINT, scrapeReel, type ScrapeOptions } from './scrape-reel'

let browser: Promise<Browser> | undefined

/** One Chromium for the whole process, launched on first use and relaunched if it dies. */
async function sharedBrowser() {
  if (browser && (await browser.catch(() => null))?.isConnected()) return browser
  return (browser = chromium.launch())
}

/** Scrapes in the shared browser, in a fresh context per reel holding the saved Instagram session. */
export function scrapeWithSharedBrowser(db: Db) {
  return async (url: string, opts?: ScrapeOptions): Promise<Reel> => {
    const [session] = await db.select().from(instagramSession)
    if (!session) throw new Error(`No Instagram session saved, ${LOGIN_HINT}`)
    const storageState = session.storageState as BrowserContextOptions['storageState']
    const context = await (await sharedBrowser()).newContext({ storageState })
    try {
      return await scrapeReel(context, url, opts)
    } finally {
      await context.close()
    }
  }
}
