import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { validator } from 'hono/validator'
import { createAuth } from './auth.js'
import { createCollection, STATUSES, type Status } from './collection.js'
import type { Db } from './db.js'
import { toPage, toRow } from './movies.js'
import { orUnreachable, UNREACHABLE, type Tmdb } from './tmdb.js'

export function createApp(db: Db, tmdb: Tmdb) {
  const auth = createAuth(db)
  const collection = createCollection(db, tmdb)
  const app = new Hono()

  app.on(['GET', 'POST'], '/api/auth/*', (c) => auth.handler(c.req.raw))

  // Every failure has the same { error } shape; unexpected ones (e.g. the database) are a 500.
  app.onError((err, c) =>
    err instanceof HTTPException ? c.json({ error: err.message }, err.status) : c.json({ error: 'Internal error' }, 500),
  )

  app.use('*', async (c, next) => {
    const session = await auth.api.getSession({ headers: c.req.raw.headers })
    if (!session) return c.json({ error: 'Unauthorized' }, 401)
    await next()
  })

  return app
    .get(
      '/api/search',
      validator('query', (v, c) => {
        const q = typeof v.q === 'string' ? v.q.trim() : ''
        return q ? { q } : c.json({ error: 'q is required' }, 400)
      }),
      async (c) => c.json(found(await orUnreachable(tmdb.search(c.req.valid('query').q))).map(toRow)),
    )
    .get('/api/movies/:tmdbId', tmdbIdParam, async (c) => {
      const { tmdbId } = c.req.valid('param')
      const movie = found(await orUnreachable(tmdb.details(tmdbId)))
      return c.json({ ...toPage(movie), ...(await collection.entry(tmdbId)) })
    })
    .get('/api/collection', statusIn('query'), async (c) => c.json(await collection.list(c.req.valid('query').status)))
    .post('/api/collection/:tmdbId/status', tmdbIdParam, statusIn('json'), async (c) =>
      c.json(found(await collection.toggleStatus(c.req.valid('param').tmdbId, c.req.valid('json').status))),
    )
    .post('/api/collection/:tmdbId/favourite', tmdbIdParam, async (c) =>
      c.json(found(await collection.toggleFavourite(c.req.valid('param').tmdbId))),
    )
}

/** Unwraps a TMDB-backed result: UNREACHABLE is a 502 and null (unknown id) a 404, both answered by onError. */
function found<T>(result: T | null | typeof UNREACHABLE): T {
  if (result === UNREACHABLE) throw new HTTPException(502, { message: 'TMDB is unreachable' })
  if (result === null) throw new HTTPException(404, { message: 'Movie not found' })
  return result
}

const isStatus = (s: unknown): s is Status => STATUSES.includes(s as Status)

const statusIn = <T extends 'query' | 'json'>(target: T) =>
  validator(target, (v, c) => {
    const { status } = v as { status?: unknown }
    return isStatus(status) ? { status } : c.json({ error: `status must be one of ${STATUSES.join(', ')}` }, 400)
  })

const tmdbIdParam = validator('param', (v, c) => {
  const tmdbId = Number(v.tmdbId)
  return Number.isInteger(tmdbId) && tmdbId > 0 ? { tmdbId } : c.json({ error: 'tmdbId must be a positive integer' }, 400)
})

export type AppType = ReturnType<typeof createApp>
