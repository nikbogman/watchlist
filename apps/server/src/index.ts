import { serve } from '@hono/node-server'
import { createApp } from './app.js'
import { createDb } from './db.js'
import { createTmdbClient } from './tmdb/tmdb.js'

if (!process.env.TMDB_API_KEY) throw new Error('Set TMDB_API_KEY')
if (!process.env.DATABASE_URL) throw new Error('Set DATABASE_URL')

const app = createApp(
  await createDb(process.env.DATABASE_URL),
  createTmdbClient(process.env.TMDB_API_KEY),
)

// 0.0.0.0 so a phone running Expo Go can reach it over the LAN.
serve({ fetch: app.fetch, port: 3000, hostname: '0.0.0.0' }, (info) => {
  console.log(`Server is running on http://localhost:${info.port}`)
})
