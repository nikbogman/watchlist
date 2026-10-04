import { setTimeout } from 'node:timers/promises'
import { and, desc, eq, sql } from 'drizzle-orm'
import type { Db } from '../db'
import { reelScrape, type Reel, type Title } from './schema'
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

  /** Queues a failed scrape again. False when there is no failed scrape with that id. */
  async function retry(id: string) {
    if (!UUID.test(id)) return false
    const jobs = await db
      .update(reelScrape)
      .set({ status: 'queued', error: null, updatedAt: new Date() })
      .where(and(eq(reelScrape.id, id), eq(reelScrape.status, 'failed')))
      .returning({ id: reelScrape.id })
    return jobs.length > 0
  }

  return {
    /** Queues a scrape. Resolves to its id, or null when the URL isn't an Instagram reel or post. */
    async enqueue(url: string) {
      const shortcode = shortcodeOf(url)
      if (!shortcode) return null
      // One scrape per reel: sharing it again moves it to the top of the list, and re-queues it if it failed.
      // ponytail: check-then-insert can race into a duplicate; a unique index on url fixes that if it matters.
      const canonical = `https://www.instagram.com/p/${shortcode}/`
      const [existing] = await db.select({ id: reelScrape.id }).from(reelScrape).where(eq(reelScrape.url, canonical))
      if (existing) {
        await retry(existing.id)
        await db.update(reelScrape).set({ createdAt: new Date() }).where(eq(reelScrape.id, existing.id))
        return existing.id
      }
      const [job] = await db.insert(reelScrape).values({ url: canonical }).returning({ id: reelScrape.id })
      return job!.id
    },

    /** Every scrape, newest shared first, with its title instead of the whole reel. */
    list() {
      return db
        .select({
          id: reelScrape.id,
          url: reelScrape.url,
          status: reelScrape.status,
          title: sql<Title | null>`${reelScrape.reel}->'title'`,
          error: reelScrape.error,
          createdAt: reelScrape.createdAt,
        })
        .from(reelScrape)
        .orderBy(desc(reelScrape.createdAt))
    },

    retry,

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
