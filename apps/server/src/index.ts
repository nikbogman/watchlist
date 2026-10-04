import { serve } from '@hono/node-server'
import { createApp } from './app'
import { createDb } from './db'
import { createReelQueue } from './reels/queue'
import { scrapeWithSharedBrowser } from './reels/shared-browser'
import { createTmdbClient } from './tmdb/tmdb'

if (!process.env.TMDB_API_KEY) throw new Error('Set TMDB_API_KEY')
if (!process.env.DATABASE_URL) throw new Error('Set DATABASE_URL')

const db = await createDb(process.env.DATABASE_URL).catch((e: Error) => {
  const cause = e.cause instanceof Error && e.cause.message ? `: ${e.cause.message}` : ''
  console.error(`Failed to start: ${e.message}${cause}`)
  process.exit(1)
})
void createReelQueue(db).work(scrapeWithSharedBrowser(db))
const app = createApp(db, createTmdbClient(process.env.TMDB_API_KEY))

// 0.0.0.0 so a phone running Expo Go can reach it over the LAN.
serve({ fetch: app.fetch, port: Number(process.env.PORT ?? 3000), hostname: '0.0.0.0' }, (info) => {
  console.log(`Server is running on http://localhost:${info.port}`)
})
