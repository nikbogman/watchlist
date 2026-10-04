import { setTimeout } from 'node:timers/promises'
import { eq, sql } from 'drizzle-orm'
import type { Db } from '../db'
import { reelScrape, type Reel } from './schema'
import { shortcodeOf } from './scrape-reel'

/** Scrapes one reel. The queue's only dependency on a browser. */
export type Scrape = (url: string) => Promise<Reel>

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function createReelQueue(db: Db) {
  /** One worker step: claims the oldest queued job and runs it. False when the queue is empty. */
  async function runNext(scrape: Scrape) {
    const [job] = await db
      .update(reelScrape)
      .set({ status: 'running', updatedAt: new Date() })
      .where(
        eq(reelScrape.id, sql`(select id from ${reelScrape} where status = 'queued' order by created_at limit 1 for update skip locked)`),
      )
      .returning({ id: reelScrape.id, url: reelScrape.url })
    if (!job) return false

    const result = await scrape(job.url).then(
      (reel) => ({ status: 'done' as const, reel }),
      (e: unknown) => ({ status: 'failed' as const, error: e instanceof Error ? e.message : String(e) }),
    )
    await db
      .update(reelScrape)
      .set({ ...result, updatedAt: new Date() })
      .where(eq(reelScrape.id, job.id))
    return true
  }

  return {
    /** Queues a scrape. Resolves to its id, or null when the URL isn't an Instagram reel or post. */
    async enqueue(url: string) {
      if (!shortcodeOf(url)) return null
      const [job] = await db.insert(reelScrape).values({ url }).returning({ id: reelScrape.id })
      return job!.id
    },

    /** The scrape's status and, once done or failed, its reel or error. Null for an unknown id. */
    async job(id: string) {
      if (!UUID.test(id)) return null
      const [job] = await db
        .select({ status: reelScrape.status, reel: reelScrape.reel, error: reelScrape.error })
        .from(reelScrape)
        .where(eq(reelScrape.id, id))
      return job ?? null
    },

    runNext,

    /** Runs jobs one at a time, forever, polling every 2s when idle. */
    async work(scrape: Scrape) {
      // ponytail: assumes one server process, so anything still running was cut off by a restart.
      // Running several would need a lease (locked_at) instead.
      await db.update(reelScrape).set({ status: 'queued' }).where(eq(reelScrape.status, 'running'))
      while (true) {
        const ran = await runNext(scrape).catch((e: unknown) => {
          console.error('Reel worker:', e)
          return false
        })
        if (!ran) await setTimeout(2000)
      }
    },
  }
}

export type ReelQueue = ReturnType<typeof createReelQueue>
