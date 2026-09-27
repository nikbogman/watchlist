import { Hono } from 'hono'
import { validator } from 'hono/validator'
import { found, tmdbIdParam } from '../http.js'
import { STATUSES, type Collection, type Status } from './collection.js'

function isStatus(value: unknown): value is Status {
  return STATUSES.includes(value as Status)
}

// Returns the query's own keys: Hono's client builds its query type from them.
const listQuery = validator('query', (query, c) => {
  const { status, favourite, title = '', order = 'newest', offset = '0' } = query as Record<string, unknown>
  const start = Number(offset)
  if (typeof title !== 'string' || (order !== 'newest' && order !== 'oldest') || !Number.isInteger(start) || start < 0) {
    return c.json({ error: 'title is text, order is newest or oldest, offset is a whole number from 0' }, 400)
  }
  const page = { title: title.trim(), order: order as 'newest' | 'oldest', offset: start }
  if (favourite === 'true' && status === undefined) {
    return { favourite: true as const, ...page }
  }
  if (!isStatus(status) || favourite !== undefined) {
    return c.json({ error: `filter by favourite=true or status, one of ${STATUSES.join(', ')}` }, 400)
  }
  return { status, ...page }
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
    .get('/', listQuery, async (c) => {
      const { title, order, offset, ...filter } = c.req.valid('query')
      return c.json(await collection.list(filter, { title, oldestFirst: order === 'oldest', offset }))
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
