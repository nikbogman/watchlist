import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { createAuth } from './auth/auth.js'
import { createCollection } from './collection/collection.js'
import { collectionRoutes } from './collection/routes.js'
import type { Db } from './db.js'
import { letterboxdRoutes } from './letterboxd/routes.js'
import { movieRoutes } from './movies/routes.js'
import { reelRoutes } from './reels/routes.js'
import { TmdbUnreachable, type Tmdb } from './tmdb/tmdb.js'

export function createApp(db: Db, tmdb: Tmdb) {
  const auth = createAuth(db)
  const collection = createCollection(db, tmdb)
  const app = new Hono()

  app.on(['GET', 'POST'], '/api/auth/*', (c) => auth.handler(c.req.raw))

  // Every failure has the same { error } shape; unexpected ones (e.g. the database) are a 500.
  app.onError((err, c) => {
    if (err instanceof HTTPException) return c.json({ error: err.message }, err.status)
    if (err instanceof TmdbUnreachable) return c.json({ error: err.message }, 502)
    return c.json({ error: 'Internal error' }, 500)
  })

  // Checks the email and password itself, so it sits before the session check.
  app.route('/api/import/letterboxd', letterboxdRoutes(auth, collection, tmdb))

  app.use('*', async (c, next) => {
    const session = await auth.api.getSession({ headers: c.req.raw.headers })
    if (!session) return c.json({ error: 'Unauthorized' }, 401)
    await next()
  })

  return app
    .route('/api', movieRoutes(tmdb, collection))
    .route('/api/collection', collectionRoutes(collection))
    .route('/api/reels', reelRoutes(db))
}

export type AppType = ReturnType<typeof createApp>
