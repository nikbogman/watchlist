import { Hono } from 'hono'
import { validator } from 'hono/validator'
import { found, tmdbIdParam } from '../http.js'
import { STATUSES, type Collection, type Status } from './collection.js'

function isStatus(value: unknown): value is Status {
  return STATUSES.includes(value as Status)
}

const filterQuery = validator('query', (query, c) => {
  const { status, favourite } = query as { status?: unknown; favourite?: unknown }
  if (favourite === 'true' && status === undefined) {
    return { favourite: true as const }
  }
  if (!isStatus(status) || favourite !== undefined) {
    return c.json({ error: `filter by favourite=true or status, one of ${STATUSES.join(', ')}` }, 400)
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
    .get('/', filterQuery, async (c) => {
      const filter = c.req.valid('query')
      const movies = await collection.list(filter)
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
