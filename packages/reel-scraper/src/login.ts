import { chromium } from 'playwright'
import { SESSION_FILE } from './scrape-reel.js'

// Log in by hand in the window. Saved as soon as Instagram sets its session cookie.
const browser = await chromium.launch({ headless: false })
const context = await browser.newContext()
const page = await context.newPage()
await page.goto('https://www.instagram.com/accounts/login/')
console.log('Log in to Instagram in the browser window…')

while (!(await context.cookies()).some((c) => c.name === 'sessionid')) {
  await page.waitForTimeout(1000)
}
await context.storageState({ path: SESSION_FILE })
console.log(`Session saved to ${SESSION_FILE}`)
await browser.close()
