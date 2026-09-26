import { desc, eq } from 'drizzle-orm'
import type { Db } from './db.js'
import { toRow } from './movies.js'
import { trackedMovies } from './schema.js'
import { orUnreachable, UNREACHABLE, type Tmdb } from './tmdb.js'

export const STATUSES = trackedMovies.status.enumValues
export type Status = (typeof STATUSES)[number]

type Entry = Pick<typeof trackedMovies.$inferSelect, 'status' | 'addedAt' | 'watchedAt' | 'favourite'>

const entryOf = (e?: Entry | null) => ({ status: e?.status ?? null, favourite: e?.favourite ?? false, watchedAt: e?.watchedAt ?? null })

// The toggle rules from PRD 01. Null means untrack.
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
  const find = (tmdbId: number) => db.query.trackedMovies.findFirst({ where: eq(trackedMovies.tmdbId, tmdbId) })

  /** When tracking starts, resolves to null if TMDB doesn't know the id, or UNREACHABLE. Database errors throw. */
  async function toggle(tmdbId: number, rule: (current: Entry | undefined, now: Date) => Entry | null) {
    const current = await find(tmdbId)
    const next = rule(current, new Date())
    if (!next) {
      await db.delete(trackedMovies).where(eq(trackedMovies.tmdbId, tmdbId))
    } else if (current) {
      await db.update(trackedMovies).set(next).where(eq(trackedMovies.tmdbId, tmdbId))
    } else {
      // The copy is taken once, when tracking starts, and never refreshed.
      const movie = await orUnreachable(tmdb.details(tmdbId))
      if (movie === UNREACHABLE || !movie) return movie
      await db.insert(trackedMovies).values({ tmdbId, title: movie.title, year: movie.year, posterPath: movie.posterPath, ...next })
    }
    return entryOf(next)
  }

  return {
    entry: async (tmdbId: number) => entryOf(await find(tmdbId)),
    toggleStatus: (tmdbId: number, status: Status) => toggle(tmdbId, (current, now) => toggledStatus(current, status, now)),
    toggleFavourite: (tmdbId: number) => toggle(tmdbId, toggledFavourite),

    async list(status: Status) {
      const newestFirst = desc(status === 'to_watch' ? trackedMovies.addedAt : trackedMovies.watchedAt)
      return (await db.select().from(trackedMovies).where(eq(trackedMovies.status, status)).orderBy(newestFirst)).map(toRow)
    },
  }
}
