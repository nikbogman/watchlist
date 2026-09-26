import { desc, eq } from 'drizzle-orm'
import type { Db } from '../db.js'
import { toRow } from '../movies/movies.js'
import { collectionEntry } from '../schema/index.js'
import { orUnreachable, UNREACHABLE, type Tmdb } from '../tmdb/tmdb.js'

export const STATUSES = collectionEntry.status.enumValues
export type Status = (typeof STATUSES)[number]

type Entry = Pick<typeof collectionEntry.$inferSelect, 'status' | 'addedAt' | 'watchedAt' | 'favourite'>

const entryOf = (e?: Entry | null) => ({ status: e?.status ?? null, favourite: e?.favourite ?? false, watchedAt: e?.watchedAt ?? null })

const toWatch = (now: Date): Entry => ({ status: 'to_watch', addedAt: now, watchedAt: null, favourite: false })

const watched = (current: Entry | undefined, now: Date, favourite = false): Entry => ({
  status: 'watched',
  addedAt: current?.addedAt ?? now,
  watchedAt: now,
  favourite,
})

export function createCollection(db: Db, tmdb: Tmdb) {
  const byId = (tmdbId: number) => eq(collectionEntry.tmdbId, tmdbId)
  const find = (tmdbId: number) => db.query.collectionEntry.findFirst({ where: byId(tmdbId) })

  async function drop(tmdbId: number) {
    await db.delete(collectionEntry).where(byId(tmdbId))
    return entryOf(null)
  }

  async function update(tmdbId: number, entry: Entry) {
    await db.update(collectionEntry).set(entry).where(byId(tmdbId))
    return entryOf(entry)
  }

  /** Copies the movie from TMDB once, never refreshed. Resolves to null if TMDB doesn't know the id, or UNREACHABLE. */
  async function create(tmdbId: number, entry: Entry) {
    const movie = await orUnreachable(tmdb.details(tmdbId))
    if (movie === UNREACHABLE || !movie) return movie
    await db.insert(collectionEntry).values({ tmdbId, title: movie.title, year: movie.year, posterPath: movie.posterPath, ...entry })
    return entryOf(entry)
  }

  // The Status and Favourite rules from CONTEXT.md. Database errors throw.
  return {
    entry: async (tmdbId: number) => entryOf(await find(tmdbId)),

    /** Null drops the entry. */
    async setStatus(tmdbId: number, status: Status | null) {
      if (status === null) {
        return drop(tmdbId)
      }

      const current = await find(tmdbId)
      if (current?.status === status) {
        return entryOf(current)
      }

      let next: Entry
      if (status === 'to_watch') {
        next = toWatch(new Date())
      } else {
        next = watched(current, new Date())
      }

      if (current) {
        return update(tmdbId, next)
      }
      return create(tmdbId, next)
    },

    async setFavourite(tmdbId: number, favourite: boolean) {
      const current = await find(tmdbId)
      if (current?.status === 'watched') {
        return update(tmdbId, { ...current, favourite })
      }

      // Not Watched, so there is no Favourite to clear.
      if (!favourite) {
        return entryOf(current)
      }

      // Favouriting a movie that isn't Watched marks it Watched.
      const next = watched(current, new Date(), true)
      if (current) {
        return update(tmdbId, next)
      }
      return create(tmdbId, next)
    },

    async list(status: Status) {
      let newestFirst
      if (status === 'to_watch') {
        newestFirst = desc(collectionEntry.addedAt)
      } else {
        newestFirst = desc(collectionEntry.watchedAt)
      }

      const entries = await db.select().from(collectionEntry).where(eq(collectionEntry.status, status)).orderBy(newestFirst)
      return entries.map(toRow)
    },
  }
}

export type Collection = ReturnType<typeof createCollection>
