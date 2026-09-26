import { desc, eq } from 'drizzle-orm'
import type { Db } from '../db.js'
import { toRow } from '../movies/movies.js'
import { collectionEntry } from '../schema/index.js'
import { orUnreachable, UNREACHABLE, type Tmdb } from '../tmdb/tmdb.js'

export const STATUSES = collectionEntry.status.enumValues
export type Status = (typeof STATUSES)[number]

type Entry = Pick<typeof collectionEntry.$inferSelect, 'status' | 'addedAt' | 'watchedAt' | 'favourite'>

const entryOf = (e?: Entry | null) => ({ status: e?.status ?? null, favourite: e?.favourite ?? false, watchedAt: e?.watchedAt ?? null })

// The toggle rules from PRD 01. Each returns the entry's next state, or null to drop it.

function nextForStatus(current: Entry | undefined, status: Status, now: Date): Entry | null {
  if (current?.status === status) return null
  if (status === 'to_watch') return { status, addedAt: now, watchedAt: null, favourite: false }
  return { status, addedAt: current?.addedAt ?? now, watchedAt: now, favourite: false }
}

function nextForFavourite(current: Entry | undefined, now: Date): Entry {
  if (current?.status === 'watched') return { ...current, favourite: !current.favourite }
  // Favouriting a movie that isn't Watched marks it Watched.
  return { status: 'watched', addedAt: current?.addedAt ?? now, watchedAt: now, favourite: true }
}

export function createCollection(db: Db, tmdb: Tmdb) {
  const find = (tmdbId: number) => db.query.collectionEntry.findFirst({ where: eq(collectionEntry.tmdbId, tmdbId) })

  /** Stores the next state. A new entry needs TMDB, so resolves to null if TMDB doesn't know the id, or UNREACHABLE. Database errors throw. */
  async function save(tmdbId: number, current: Entry | undefined, next: Entry | null) {
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

    async toggleStatus(tmdbId: number, status: Status) {
      const current = await find(tmdbId)
      return save(tmdbId, current, nextForStatus(current, status, new Date()))
    },

    async toggleFavourite(tmdbId: number) {
      const current = await find(tmdbId)
      return save(tmdbId, current, nextForFavourite(current, new Date()))
    },

    async list(status: Status) {
      const newestFirst = desc(status === 'to_watch' ? collectionEntry.addedAt : collectionEntry.watchedAt)
      return (await db.select().from(collectionEntry).where(eq(collectionEntry.status, status)).orderBy(newestFirst)).map(toRow)
    },
  }
}

export type Collection = ReturnType<typeof createCollection>
