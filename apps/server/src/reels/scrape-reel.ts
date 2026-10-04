import type { BrowserContext, Response } from 'playwright'
import type { Comment, Reel } from '../schema/reels.js'
import { shortcodeOf } from './queue.js'

export const LOGIN_HINT = 'run `pnpm reel:login` in apps/server'

/** Scrapes in a new page of the given context, which must hold a logged-in Instagram session. */
export async function scrapeReel(context: BrowserContext, url: string, opts: { maxComments?: number } = {}): Promise<Reel> {
  const shortcode = shortcodeOf(url)
  if (!shortcode) throw new Error(`${url} is not an Instagram reel or post URL`)
  const { maxComments = 200 } = opts

  const page = await context.newPage()
  try {
    const comments = new Map<string, Comment>()
    let description: string | null | undefined
    let hasNextPage = true

    // Instagram embeds the first page in the HTML document and fetches later pages as GraphQL JSON.
    const collect = async (res: Response) => {
      if (!/instagram\.com\/(graphql|api|p\/|reels?\/)/.test(res.url())) return
      const body = await res.text().catch(() => '')
      for (const json of parseJsonPayloads(body)) {
        walk(json, (node) => {
          if (node.code === shortcode && 'caption' in node && description === undefined) {
            description = (node.caption as { text?: string } | null)?.text ?? null
          }
          const connection = node.xdt_api__v1__media__media_id__comments__connection as CommentConnection | undefined
          if (!connection) return
          hasNextPage = connection.page_info?.has_next_page ?? hasNextPage
          for (const { node: c } of connection.edges ?? []) {
            if (c.parent_comment_id) continue
            comments.set(c.pk, { author: c.user.username, text: c.text, likes: c.comment_like_count ?? 0, createdAt: new Date(c.created_at * 1000).toISOString() })
          }
        })
      }
    }
    const pending: Promise<void>[] = []
    page.on('response', (res) => void pending.push(collect(res)))
    // Waits for every response seen so far, including ones that arrive while waiting.
    const settle = async () => {
      while (pending.length) await Promise.all(pending.splice(0))
    }

    // A bare /reel/ link opens the full-screen viewer, which hides comments; /p/ opens the post view with them.
    await page.goto(`https://www.instagram.com/p/${shortcode}/`, { waitUntil: 'networkidle' })
    if (page.url().includes('/accounts/login')) throw new Error(`Instagram session expired, ${LOGIN_HINT}`)
    await settle()

    // Wheel over the comments panel (the one scrollable box inside the page) until the cap or the last page.
    // Setting scrollTop doesn't trigger Instagram's pagination; real wheel events do.
    const panelCenter = await page.evaluate(() => {
      const el = [...document.querySelectorAll('body *')].find(
        (e) => e.scrollHeight > e.clientHeight + 5 && /auto|scroll/.test(getComputedStyle(e).overflowY),
      )
      const r = el?.getBoundingClientRect()
      return r && { x: r.x + r.width / 2, y: r.y + r.height / 2 }
    })
    if (panelCenter) await page.mouse.move(panelCenter.x, panelCenter.y)
    // Stops after 10s with no new comments in case Instagram stalls without saying it's on the last page.
    for (let idle = 0; panelCenter && hasNextPage && comments.size < maxComments && idle < 20; ) {
      const before = comments.size
      await page.mouse.wheel(0, 2000)
      await page.waitForTimeout(500)
      await settle()
      idle = comments.size > before ? 0 : idle + 1
    }

    return {
      url,
      // undefined = caption not seen in any payload; null = the reel has no caption
      description:
        description === undefined
          ? await page.locator('meta[property="og:description"]').getAttribute('content').catch(() => null)
          : description,
      comments: [...comments.values()].slice(0, maxComments),
    }
  } finally {
    await page.close()
  }
}

type CommentConnection = { edges?: { node: RawComment }[]; page_info?: { has_next_page?: boolean } }

type RawComment = {
  pk: string
  text: string
  created_at: number
  comment_like_count?: number
  parent_comment_id: string | null
  user: { username: string }
}

/** JSON bodies are parsed whole; HTML documents yield their embedded `application/json` scripts. */
function parseJsonPayloads(body: string): unknown[] {
  const sources = body.trimStart().startsWith('<')
    ? [...body.matchAll(/<script type="application\/json"[^>]*>(.*?)<\/script>/gs)].map((m) => m[1]!)
    : body.split('\n') // GraphQL can stream several JSON objects, one per line
  return sources.flatMap((s) => {
    try {
      return [JSON.parse(s)]
    } catch {
      return []
    }
  })
}

function walk(value: unknown, visit: (node: Record<string, unknown>) => void) {
  if (!value || typeof value !== 'object') return
  if (!Array.isArray(value)) visit(value as Record<string, unknown>)
  for (const child of Object.values(value)) walk(child, visit)
}
