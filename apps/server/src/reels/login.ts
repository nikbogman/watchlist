import { readFile } from 'node:fs/promises'
import { chromium } from 'playwright'
import { createDb } from '../db'
import { env } from '../env'
import { instagramSession } from './schema'

// Saves the Instagram session the scraper uses. Pass a storage-state JSON file to import it instead of logging in.
const db = await createDb(env('DATABASE_URL').DATABASE_URL)

let storageState: unknown
if (process.argv[2]) {
  storageState = JSON.parse(await readFile(process.argv[2], 'utf8'))
} else {
  // Log in by hand in the window. Saved as soon as Instagram sets its session cookie.
  const browser = await chromium.launch({ headless: false })
  const context = await browser.newContext()
  const page = await context.newPage()
  await page.goto('https://www.instagram.com/accounts/login/')
  console.log('Log in to Instagram in the browser window…')
  while (!(await context.cookies()).some((c) => c.name === 'sessionid')) {
    await page.waitForTimeout(1000)
  }
  storageState = await context.storageState()
  await browser.close()
}

await db
  .insert(instagramSession)
  .values({ storageState })
  .onConflictDoUpdate({ target: instagramSession.id, set: { storageState, savedAt: new Date() } })
console.log('Instagram session saved')
await db.$client.end()
