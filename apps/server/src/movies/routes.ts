import { Hono } from 'hono'
import { validator } from 'hono/validator'
import type { Collection } from '../collection/collection'
import { found, tmdbIdParam } from '../http'
import type { Tmdb } from '../tmdb/tmdb'
import { toPage, toRow } from './movies'

export const movieRoutes = (tmdb: Tmdb, collection: Collection) =>
  new Hono()
    .get(
      '/search',
      validator('query', (v, c) => {
        const q = typeof v.q === 'string' ? v.q.trim() : ''
        return q ? { q } : c.json({ error: 'q is required' }, 400)
      }),
      async (c) => c.json((await tmdb.search(c.req.valid('query').q)).map(toRow)),
    )
    .get('/movies/:tmdbId', tmdbIdParam, async (c) => {
      const { tmdbId } = c.req.valid('param')
      const movie = found(await tmdb.details(tmdbId))
      return c.json({ ...toPage(movie), ...(await collection.entry(tmdbId)) })
    })
