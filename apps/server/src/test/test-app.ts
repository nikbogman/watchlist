import { expect } from 'vitest'
import { createApp } from '../app.js'
import { createAuth } from '../auth/auth.js'
import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'
import { migrate } from 'drizzle-orm/pglite/migrator'
import { MIGRATIONS } from '../db.js'
import * as schema from '../schema/index.js'
import { seed } from '../auth/seed.js'
import type { Movie, MovieDetails } from '../movies/movies.js'
import type { Tmdb } from '../tmdb/tmdb.js'

export const EMAIL = 'me@example.com'
export const PASSWORD = 'correct horse battery'

/** In-memory stand-in for TMDB. Set `down` to make every call throw. */
export function fakeTmdb(movies: (Movie | MovieDetails)[] = []) {
  const fake = {
    down: false as boolean,
    async search(query: string) {
      if (fake.down) throw new Error('TMDB down')
      return movies.filter((m) => m.title.toLowerCase().includes(query.toLowerCase()))
    },
    async details(tmdbId: number) {
      if (fake.down) throw new Error('TMDB down')
      const m = movies.find((m) => m.tmdbId === tmdbId)
      return m ? { overview: '', ...m } : null
    },
  } satisfies Tmdb & { down: boolean }
  return fake
}

// Booting and migrating Postgres is slow, so each test file does it once and every app gets a clone.
const migrated = await (async () => {
  const client = new PGlite()
  await migrate(drizzle({ client }), { migrationsFolder: MIGRATIONS })
  return client
})()

let ip = 0

/** The app over a fresh in-memory database with the one account seeded. */
export async function testApp(tmdb: Tmdb = fakeTmdb()) {
  ip++ // the rate limiter keys on client IP, so each app gets its own
  const db = drizzle({ client: (await migrated.clone()) as PGlite, schema })
  const app = createApp(db, tmdb)
  await seed(createAuth(db), EMAIL, PASSWORD)

  const request = (path: string, init: RequestInit & { cookie?: string } = {}) =>
    app.request(path, {
      ...init,
      headers: { 'x-forwarded-for': `10.0.0.${ip}`, ...(init.cookie && { cookie: init.cookie }), ...init.headers },
    })

  const post = (path: string, body: unknown, cookie?: string) =>
    request(path, { method: 'POST', cookie, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })

  async function login(password = PASSWORD) {
    const res = await post('/api/auth/sign-in/email', { email: EMAIL, password })
    expect(res.status).toBe(200)
    return res.headers.get('set-cookie')!.split(';')[0]
  }

  return { app, db, request, post, login }
}
