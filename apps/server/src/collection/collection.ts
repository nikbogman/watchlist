import { and, asc, desc, eq, ilike } from 'drizzle-orm'
import type { Db } from '../db'
import { toRow, type Movie } from '../movies/movies'
import { collectionEntry } from './schema'
import type { Tmdb } from '../tmdb/tmdb'

export const STATUSES = collectionEntry.status.enumValues
export type Status = (typeof STATUSES)[number]
export type Filter = { status: Status } | { favourite: true }
/** A page of a list: title search, sort direction and where to start. */
export type Page = { title?: string; oldestFirst?: boolean; offset?: number }

export const PAGE_SIZE = 30

/** A movie arriving with its history, e.g. from an import. Watched if watchedAt is set, else To watch; only a Watched movie can be a Favourite. */
export type NewEntry = { movie: Movie; addedAt: Date; watchedAt: Date | null; favourite: boolean }

type Entry = Pick<typeof collectionEntry.$inferSelect, 'status' | 'addedAt' | 'watchedAt' | 'favourite'>

const entryOf = (e?: Entry | null) => ({ status: e?.status ?? null, favourite: e?.favourite ?? false, watchedAt: e?.watchedAt ?? null })

const toWatch = (now: Date): Entry => ({ status: 'to_watch', addedAt: now, watchedAt: null, favourite: false })

const watched = (current: Entry | undefined, now: Date, favourite = false): Entry => ({
  status: 'watched',
  addedAt: current?.addedAt ?? now,
  watchedAt: now,
  favourite,
})

const byId = (tmdbId: number) => eq(collectionEntry.tmdbId, tmdbId)

// The movie is copied in once, never refreshed.
const rowOf = ({ tmdbId, title, year, posterPath }: Movie, entry: Entry) => ({ tmdbId, title, year, posterPath, ...entry })

export function createCollection(db: Db, tmdb: Tmdb) {
  const find = (tmdbId: number) => db.query.collectionEntry.findFirst({ where: byId(tmdbId) })

  async function drop(tmdbId: number) {
    await db.delete(collectionEntry).where(byId(tmdbId))
    return entryOf(null)
  }

  async function update(tmdbId: number, entry: Entry) {
    await db.update(collectionEntry).set(entry).where(byId(tmdbId))
    return entryOf(entry)
  }

  /** Resolves to null if TMDB doesn't know the id. */
  async function create(tmdbId: number, entry: Entry) {
    const movie = await tmdb.details(tmdbId)
    if (!movie) return null
    await db.insert(collectionEntry).values(rowOf(movie, entry))
    return entryOf(entry)
  }

  // The Status and Favourite rules from CONTEXT.md. Database errors throw.
  return {
    async entry(tmdbId: number) {
      return entryOf(await find(tmdbId))
    },

    /** Null drops the entry. */
    async setStatus(tmdbId: number, status: Status | null) {
      if (status === null) return drop(tmdbId)
      const current = await find(tmdbId)
      if (current?.status === status) return entryOf(current)
      const next = status === 'to_watch' ? toWatch(new Date()) : watched(current, new Date())
      return current ? update(tmdbId, next) : create(tmdbId, next)
    },

    async setFavourite(tmdbId: number, favourite: boolean) {
      const current = await find(tmdbId)
      if (current?.status === 'watched') return update(tmdbId, { ...current, favourite })
      // Not Watched, so there is no Favourite to clear.
      if (!favourite) return entryOf(current)
      // Favouriting a movie that isn't Watched marks it Watched.
      const next = watched(current, new Date(), true)
      return current ? update(tmdbId, next) : create(tmdbId, next)
    },

    /** Adds movies with the dates they came with. Movies already in the collection are left alone. Resolves to how many were added. */
    async add(entries: NewEntry[]) {
      const rows = entries.map(({ movie, addedAt, watchedAt, favourite }) =>
        rowOf(movie, watchedAt ? { status: 'watched', addedAt, watchedAt, favourite } : toWatch(addedAt)),
      )
      let added = 0
      // Postgres caps a statement at 65,535 parameters, 8 per row.
      for (let i = 0; i < rows.length; i += 1000) {
        const inserted = await db
          .insert(collectionEntry)
          .values(rows.slice(i, i + 1000))
          .onConflictDoNothing()
          .returning({ tmdbId: collectionEntry.tmdbId })
        added += inserted.length
      }
      return added
    },

    /**
     * To watch and Watched filter by Status, Favourites by Favourite. Newest first unless oldestFirst.
     * `total` counts the whole list, `matching` only the titles containing `title`.
     */
    async list(filter: Filter, { title = '', oldestFirst = false, offset = 0 }: Page = {}) {
      const where = 'favourite' in filter ? eq(collectionEntry.favourite, true) : eq(collectionEntry.status, filter.status)
      // To watch sorts by when a movie was added, Watched and Favourites by when it was watched.
      const date = 'status' in filter && filter.status === 'to_watch' ? collectionEntry.addedAt : collectionEntry.watchedAt
      const direction = oldestFirst ? asc : desc
      const search = title ? and(where, ilike(collectionEntry.title, `%${title.replace(/[\\%_]/g, '\\$&')}%`)) : where
      const [entries, total, matching] = await Promise.all([
        db
          .select()
          .from(collectionEntry)
          .where(search)
          // tmdbId breaks date ties so pages never overlap.
          .orderBy(direction(date), direction(collectionEntry.tmdbId))
          .limit(PAGE_SIZE)
          .offset(offset),
        db.$count(collectionEntry, where),
        title ? db.$count(collectionEntry, search) : undefined,
      ])
      const next = offset + entries.length
      return { movies: entries.map(toRow), total, matching: matching ?? total, nextOffset: next < (matching ?? total) ? next : null }
    },
  }
}

export type Collection = ReturnType<typeof createCollection>
