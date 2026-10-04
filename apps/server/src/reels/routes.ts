import { Hono } from 'hono'
import { validator } from 'hono/validator'
import type { Db } from '../db.js'
import { enqueue, getJob, shortcodeOf } from './queue.js'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const reelUrl = validator('json', (body, c) => {
  const { url } = body as { url?: unknown }
  return typeof url === 'string' && shortcodeOf(url) ? { url } : c.json({ error: 'url must be an Instagram reel or post URL' }, 400)
})

/** POST a reel URL to queue a scrape, then poll GET /:id until its status is done or failed. */
export function reelRoutes(db: Db) {
  return new Hono()
    .post('/', reelUrl, async (c) => c.json({ id: await enqueue(db, c.req.valid('json').url) }, 202))
    .get('/:id', async (c) => {
      const id = c.req.param('id')
      const job = UUID.test(id) ? await getJob(db, id) : null
      return job ? c.json(job) : c.json({ error: 'Scrape not found' }, 404)
    })
}
