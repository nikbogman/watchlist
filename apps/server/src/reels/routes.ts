import { Hono } from 'hono'
import { validator } from 'hono/validator'
import type { Db } from '../db.js'
import { enqueue, getJob } from './queue.js'

const NOT_A_REEL = { error: 'url must be an Instagram reel or post URL' }

const reelUrl = validator('json', (body, c) => {
  const { url } = body as { url?: unknown }
  return typeof url === 'string' ? { url } : c.json(NOT_A_REEL, 400)
})

/** POST a reel URL to queue a scrape, then poll GET /:id until its status is done or failed. */
export function reelRoutes(db: Db) {
  return new Hono()
    .post('/', reelUrl, async (c) => {
      const id = await enqueue(db, c.req.valid('json').url)
      return id ? c.json({ id }, 202) : c.json(NOT_A_REEL, 400)
    })
    .get('/:id', async (c) => {
      const job = await getJob(db, c.req.param('id'))
      return job ? c.json(job) : c.json({ error: 'Scrape not found' }, 404)
    })
}
