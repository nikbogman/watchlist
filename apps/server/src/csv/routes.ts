import { Hono } from 'hono'
import type { Collection } from '../collection/collection'
import type { Tmdb } from '../tmdb/tmdb'
import { exportCsv, importCsv } from './csv'

/** POST /import takes the CSV as the request body; GET /export downloads the Collection in the same format. */
export function csvRoutes(collection: Collection, tmdb: Tmdb) {
  return new Hono()
    .post('/import', async (c) => c.json(await importCsv(collection, tmdb, await c.req.text())))
    .get('/export', async (c) => {
      c.header('content-type', 'text/csv; charset=utf-8')
      c.header('content-disposition', 'attachment; filename="watcher.csv"')
      return c.body(await exportCsv(collection))
    })
}
