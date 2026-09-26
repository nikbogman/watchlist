import { desc, eq } from 'drizzle-orm'
import type { Db } from '../db.js'
import { toRow } from '../movies/movies.js'
import { collectionEntry } from '../schema/index.js'
import { orUnreachable, UNREACHABLE, type Tmdb } from '../tmdb/tmdb.js'

export const STATUSES = collectionEntry.status.enumValues
export type Status = (typeof STATUSES)[number]

type Entry = Pick<typeof collectionEntry.$inferSelect, 'status' | 'addedAt' | 'watchedAt' | 'favourite'>

const entryOf = (e?: Entry | null) => ({ status: e?.status ?? null, favourite: e?.favourite ?? false, watchedAt: e?.watchedAt ?? null })

// The toggle rules from PRD 01. Null means drop.
const watched = (current: Entry | undefined, now: Date, favourite: boolean): Entry => ({
  status: 'watched',
  addedAt: current?.addedAt ?? now,
  watchedAt: now,
  favourite,
})

const toggledStatus = (current: Entry | undefined, status: Status, now: Date): Entry | null =>
  current?.status === status ? null : status === 'watched' ? watched(current, now, false) : { status, addedAt: now, watchedAt: null, favourite: false }

const toggledFavourite = (current: Entry | undefined, now: Date): Entry =>
  current?.status === 'watched' ? { ...current, favourite: !current.favourite } : watched(current, now, true)

export function createCollection(db: Db, tmdb: Tmdb) {
  const find = (tmdbId: number) => db.query.collectionEntry.findFirst({ where: eq(collectionEntry.tmdbId, tmdbId) })

  /** When an entry is created, resolves to null if TMDB doesn't know the id, or UNREACHABLE. Database errors throw. */
  async function toggle(tmdbId: number, rule: (current: Entry | undefined, now: Date) => Entry | null) {
    const current = await find(tmdbId)
    const next = rule(current, new Date())
    if (!next) {
      await db.delete(collectionEntry).where(eq(collectionEntry.tmdbId, tmdbId))
    } else if (current) {
      await db.update(collectionEntry).set(next).where(eq(collectionEntry.tmdbId, tmdbId))
    } else {
      // The copy is taken once, when the entry is created, and never refreshed.
      const movie = await orUnreachable(tmdb.details(tmdbId))
      if (movie === UNREACHABLE || !movie) return movie
      await db.insert(collectionEntry).values({ tmdbId, title: movie.title, year: movie.year, posterPath: movie.posterPath, ...next })
    }
    return entryOf(next)
  }

  return {
    entry: async (tmdbId: number) => entryOf(await find(tmdbId)),
    toggleStatus: (tmdbId: number, status: Status) => toggle(tmdbId, (current, now) => toggledStatus(current, status, now)),
    toggleFavourite: (tmdbId: number) => toggle(tmdbId, toggledFavourite),

    async list(status: Status) {
      const newestFirst = desc(status === 'to_watch' ? collectionEntry.addedAt : collectionEntry.watchedAt)
      return (await db.select().from(collectionEntry).where(eq(collectionEntry.status, status)).orderBy(newestFirst)).map(toRow)
    },
  }
}

export type Collection = ReturnType<typeof createCollection>
