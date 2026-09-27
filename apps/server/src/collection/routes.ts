import { Hono } from 'hono'
import { validator } from 'hono/validator'
import { found, tmdbIdParam } from '../http.js'
import { STATUSES, type Collection, type Status } from './collection.js'

function isStatus(value: unknown): value is Status {
  return STATUSES.includes(value as Status)
}

const statusQuery = validator('query', (query, c) => {
  const { status } = query as { status?: unknown }
  if (!isStatus(status)) {
    return c.json({ error: `status must be one of ${STATUSES.join(', ')}` }, 400)
  }
  return { status }
})

const statusOrNull = validator('json', (body, c) => {
  const { status } = body as { status?: unknown }
  if (status !== null && !isStatus(status)) {
    return c.json({ error: `status must be null or one of ${STATUSES.join(', ')}` }, 400)
  }
  return { status }
})

const favouriteFlag = validator('json', (body, c) => {
  const { favourite } = body as { favourite?: unknown }
  if (typeof favourite !== 'boolean') {
    return c.json({ error: 'favourite must be true or false' }, 400)
  }
  return { favourite }
})

export function collectionRoutes(collection: Collection) {
  return new Hono()
    .get('/', statusQuery, async (c) => {
      const { status } = c.req.valid('query')
      const movies = await collection.list(status)
      return c.json(movies)
    })
    .put('/:tmdbId/status', tmdbIdParam, statusOrNull, async (c) => {
      const { tmdbId } = c.req.valid('param')
      const { status } = c.req.valid('json')
      const entry = await collection.setStatus(tmdbId, status)
      return c.json(found(entry))
    })
    .put('/:tmdbId/favourite', tmdbIdParam, favouriteFlag, async (c) => {
      const { tmdbId } = c.req.valid('param')
      const { favourite } = c.req.valid('json')
      const entry = await collection.setFavourite(tmdbId, favourite)
      return c.json(found(entry))
    })
}
