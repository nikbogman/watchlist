import { Hono } from 'hono'
import { validator } from 'hono/validator'
import { createAuth } from './auth.js'
import type { Db } from './db.js'
import type { Tmdb } from './tmdb.js'

export function createApp(db: Db, tmdb: Tmdb) {
  const auth = createAuth(db)
  const app = new Hono()

  app.on(['GET', 'POST'], '/api/auth/*', (c) => auth.handler(c.req.raw))

  app.use('*', async (c, next) => {
    const session = await auth.api.getSession({ headers: c.req.raw.headers })
    if (!session) return c.json({ error: 'Unauthorized' }, 401)
    await next()
  })

  return app.get(
    '/api/search',
    validator('query', (v, c) => {
      const q = typeof v.q === 'string' ? v.q.trim() : ''
      return q ? { q } : c.json({ error: 'q is required' }, 400)
    }),
    async (c) => {
      const results = await tmdb.search(c.req.valid('query').q).catch(() => null)
      return results ? c.json(results) : c.json({ error: 'TMDB is unreachable' }, 502)
    },
  )
}

export type AppType = ReturnType<typeof createApp>
