import { Hono } from 'hono'
import { validator } from 'hono/validator'
import { createAuth } from './auth.js'
import type { Db } from './db.js'
import { toPage, toRow, type Tmdb } from './tmdb.js'
import { BUTTONS, createTracking, type Button } from './tracking.js'

export function createApp(db: Db, tmdb: Tmdb) {
  const auth = createAuth(db)
  const tracking = createTracking(db, tmdb)
  const app = new Hono()

  app.on(['GET', 'POST'], '/api/auth/*', (c) => auth.handler(c.req.raw))

  // Database and other unexpected errors: same { error } shape as every other failure.
  app.onError((_, c) => c.json({ error: 'Internal error' }, 500))

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
      async (c) => {
        const results = await tmdb.search(c.req.valid('query').q).catch(() => null)
        return results ? c.json(results.map(toRow)) : c.json({ error: 'TMDB is unreachable' }, 502)
      },
    )
    .get(
      '/api/movies/:tmdbId',
      tmdbIdParam,
      async (c) => {
        const { tmdbId } = c.req.valid('param')
        const movie = await tmdb.details(tmdbId).catch(() => undefined)
        if (movie === undefined) return c.json({ error: 'TMDB is unreachable' }, 502)
        return movie ? c.json({ ...toPage(movie), ...(await tracking.state(tmdbId)) }) : c.json({ error: 'Movie not found' }, 404)
      },
    )
    .post(
      '/api/movies/:tmdbId/press',
      tmdbIdParam,
      validator('json', (v, c) =>
        BUTTONS.includes(v?.button) ? { button: v.button as Button } : c.json({ error: `button must be one of ${BUTTONS.join(', ')}` }, 400),
      ),
      async (c) => {
        const state = await tracking.press(c.req.valid('param').tmdbId, c.req.valid('json').button)
        if (state === 'tmdb_unreachable') return c.json({ error: 'TMDB is unreachable' }, 502)
        if (state === 'not_found') return c.json({ error: 'Movie not found' }, 404)
        return c.json(state)
      },
    )
    .get(
      '/api/lists/:list',
      validator('param', (v, c) => {
        const { list } = v
        return tracking.isList(list) ? { list } : c.json({ error: 'Unknown list' }, 404)
      }),
      async (c) => c.json(await tracking.list(c.req.valid('param').list)),
    )
}

const tmdbIdParam = validator('param', (v, c) => {
  const tmdbId = Number(v.tmdbId)
  return Number.isInteger(tmdbId) && tmdbId > 0 ? { tmdbId } : c.json({ error: 'tmdbId must be a positive integer' }, 400)
})

export type AppType = ReturnType<typeof createApp>
