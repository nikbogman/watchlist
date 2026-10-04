import { Hono } from 'hono'
import { validator } from 'hono/validator'
import type { ReelQueue } from './queue'

const NOT_A_REEL = { error: 'url must be an Instagram reel or post URL' }

// enqueue decides what a reel URL is; this only narrows the body's type.
const reelUrl = validator('json', (body) => {
  const { url } = body as { url?: unknown }
  return { url: typeof url === 'string' ? url : '' }
})

/** POST a reel URL to queue a scrape, then poll GET /:id until its status is done or failed. GET / lists them all. */
export function reelRoutes(queue: ReelQueue) {
  return new Hono()
    .post('/', reelUrl, async (c) => {
      const id = await queue.enqueue(c.req.valid('json').url)
      return id ? c.json({ id }, 202) : c.json(NOT_A_REEL, 400)
    })
    .get('/', async (c) => c.json(await queue.list()))
    .post('/:id/retry', async (c) =>
      (await queue.retry(c.req.param('id'))) ? c.json({ ok: true }, 202) : c.json({ error: 'No failed scrape with that id' }, 404),
    )
    .get('/:id', async (c) => {
      const job = await queue.job(c.req.param('id'))
      return job ? c.json(job) : c.json({ error: 'Scrape not found' }, 404)
    })
}
