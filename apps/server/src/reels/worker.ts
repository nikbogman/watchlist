import { chromium, type Browser, type BrowserContextOptions } from 'playwright'
import type { Db } from '../db.js'
import { instagramSession } from '../schema/reels.js'
import type { Scrape } from './queue.js'
import { LOGIN_HINT, scrapeReel } from './scrape-reel.js'

let browser: Promise<Browser> | undefined

/** One Chromium for the whole process, launched on first use and relaunched if it dies. */
async function sharedBrowser() {
  if (browser && (await browser.catch(() => null))?.isConnected()) return browser
  return (browser = chromium.launch())
}

/** Scrapes in the shared browser, in a fresh context per reel holding the saved Instagram session. */
export function scrapeWithSharedBrowser(db: Db): Scrape {
  return async (url) => {
    const [session] = await db.select().from(instagramSession)
    if (!session) throw new Error(`No Instagram session saved, ${LOGIN_HINT}`)
    const storageState = session.storageState as BrowserContextOptions['storageState']
    const context = await (await sharedBrowser()).newContext({ storageState })
    try {
      return await scrapeReel(context, url)
    } finally {
      await context.close()
    }
  }
}
