import { setTimeout } from 'node:timers/promises'
import { eq, sql } from 'drizzle-orm'
import type { Db } from '../db.js'
import { reelScrape } from '../schema/reels.js'

/** createdAt is an ISO date string, so a reel reads back from the jsonb column unchanged. */
export type Comment = { author: string; text: string; likes: number; createdAt: string }
export type Reel = { url: string; description: string | null; comments: Comment[] }
export type Scrape = (url: string) => Promise<Reel>

const REEL_URL = /^https:\/\/(www\.)?instagram\.com\/([\w.]+\/)?(reels?|p)\/(?<shortcode>[\w-]+)/

/** The reel's shortcode, or undefined when the URL isn't an Instagram reel or post. */
export function shortcodeOf(url: string) {
  return REEL_URL.exec(url)?.groups?.shortcode
}

export async function enqueue(db: Db, url: string) {
  const [job] = await db.insert(reelScrape).values({ url }).returning({ id: reelScrape.id })
  return job!.id
}

export async function getJob(db: Db, id: string) {
  const [job] = await db
    .select({ status: reelScrape.status, reel: reelScrape.reel, error: reelScrape.error })
    .from(reelScrape)
    .where(eq(reelScrape.id, id))
  return job ?? null
}

/** Claims the oldest queued job and runs it. False when the queue is empty. */
export async function runNext(db: Db, scrape: Scrape) {
  const [job] = await db
    .update(reelScrape)
    .set({ status: 'running', updatedAt: new Date() })
    .where(
      eq(
        reelScrape.id,
        sql`(select id from ${reelScrape} where status = 'queued' order by created_at limit 1 for update skip locked)`,
      ),
    )
    .returning({ id: reelScrape.id, url: reelScrape.url })
  if (!job) return false

  const result = await scrape(job.url).then(
    (reel) => ({ status: 'done' as const, reel }),
    (e: unknown) => ({ status: 'failed' as const, error: e instanceof Error ? e.message : String(e) }),
  )
  await db.update(reelScrape).set({ ...result, updatedAt: new Date() }).where(eq(reelScrape.id, job.id))
  return true
}

/** Runs jobs one at a time, forever, polling every 2s when idle. */
export async function startWorker(db: Db, scrape: Scrape) {
  // ponytail: assumes one server process, so anything still running was cut off by a restart.
  // Running several would need a lease (locked_at) instead.
  await db.update(reelScrape).set({ status: 'queued' }).where(eq(reelScrape.status, 'running'))
  for (;;) {
    try {
      if (!(await runNext(db, scrape))) await setTimeout(2000)
    } catch (e) {
      console.error('Reel worker:', e)
      await setTimeout(2000)
    }
  }
}
