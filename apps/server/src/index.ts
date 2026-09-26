import { serve } from '@hono/node-server'
import { createApp } from './app.js'
import { createDb } from './db.js'

const app = createApp(await createDb(process.env.DATABASE_URL ?? 'file:watcher.db'))

// 0.0.0.0 so a phone running Expo Go can reach it over the LAN.
serve({ fetch: app.fetch, port: 3000, hostname: '0.0.0.0' }, (info) => {
  console.log(`Server is running on http://localhost:${info.port}`)
})
