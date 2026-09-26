import { desc, eq, type SQL } from 'drizzle-orm'
import type { Db } from './db.js'
import { trackedMovies } from './schema.js'
import { toRow } from './movies.js'
import { orUnreachable, UNREACHABLE, type Tmdb } from './tmdb.js'

export const BUTTONS = ['to_watch', 'watched', 'favourite'] as const
export type Button = (typeof BUTTONS)[number]

// Each list is a filter and an order over the tracked movies.
const LISTS = {
  'to-watch': { where: eq(trackedMovies.status, 'to_watch'), orderBy: desc(trackedMovies.addedAt) },
} satisfies Record<string, { where: SQL; orderBy: SQL }>

export type ListName = keyof typeof LISTS

type Row = typeof trackedMovies.$inferSelect
type Tracked = Pick<Row, 'status' | 'addedAt' | 'watchedAt' | 'favourite'>

const stateOf = (row?: Tracked) => ({ status: row?.status ?? null, favourite: row?.favourite ?? false, watchedAt: row?.watchedAt ?? null })

/** The button table from PRD 01. Null means untrack. */
function next(row: Tracked | undefined, button: Button, now: Date): Tracked | null {
  const watched = (favourite: boolean): Tracked => ({ status: 'watched', addedAt: row?.addedAt ?? now, watchedAt: now, favourite })
  switch (button) {
    case 'to_watch':
      return row?.status === 'to_watch' ? null : { status: 'to_watch', addedAt: now, watchedAt: null, favourite: false }
    case 'watched':
      return row?.status === 'watched' ? null : watched(false)
    case 'favourite':
      return row?.status === 'watched' ? { ...row, favourite: !row.favourite } : watched(true)
  }
}

export function createTracking(db: Db, tmdb: Tmdb) {
  const get = (tmdbId: number) => db.query.trackedMovies.findFirst({ where: eq(trackedMovies.tmdbId, tmdbId) })

  return {
    state: async (tmdbId: number) => stateOf(await get(tmdbId)),

    /** When tracking starts, resolves to null if TMDB doesn't know the id, or UNREACHABLE. Database errors throw. */
    async press(tmdbId: number, button: Button) {
      const row = await get(tmdbId)
      const tracked = next(row, button, new Date())
      if (!tracked) {
        await db.delete(trackedMovies).where(eq(trackedMovies.tmdbId, tmdbId))
      } else if (row) {
        await db.update(trackedMovies).set(tracked).where(eq(trackedMovies.tmdbId, tmdbId))
      } else {
        // The copy is taken once, when tracking starts, and never refreshed.
        const movie = await orUnreachable(tmdb.details(tmdbId))
        if (movie === UNREACHABLE || !movie) return movie
        await db.insert(trackedMovies).values({ tmdbId, title: movie.title, year: movie.year, posterPath: movie.posterPath, ...tracked })
      }
      return stateOf(tracked ?? undefined)
    },

    isList: (name: string): name is ListName => Object.hasOwn(LISTS, name),

    async list(name: ListName) {
      const { where, orderBy } = LISTS[name]
      return (await db.select().from(trackedMovies).where(where).orderBy(orderBy)).map(toRow)
    },
  }
}
