import { Hono } from 'hono'
import { createAuth } from './auth.js'
import type { Db } from './db.js'

export function createApp(db: Db) {
  const auth = createAuth(db)
  const app = new Hono()

  app.on(['GET', 'POST'], '/api/auth/*', (c) => auth.handler(c.req.raw))

  app.use('*', async (c, next) => {
    const session = await auth.api.getSession({ headers: c.req.raw.headers })
    if (!session) return c.json({ error: 'Unauthorized' }, 401)
    await next()
  })

  return app
}
