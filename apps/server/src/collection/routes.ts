import { Hono } from 'hono'
import { validator } from 'hono/validator'
import { found, tmdbIdParam } from '../http.js'
import { STATUSES, type Collection, type Status } from './collection.js'

const isStatus = (s: unknown): s is Status => STATUSES.includes(s as Status)

const statusQuery = validator('query', (v, c) => {
  const { status } = v as { status?: unknown }
  return isStatus(status) ? { status } : c.json({ error: `status must be one of ${STATUSES.join(', ')}` }, 400)
})

const statusOrNull = validator('json', (v, c) => {
  const { status } = v as { status?: unknown }
  return status === null || isStatus(status) ? { status } : c.json({ error: `status must be null or one of ${STATUSES.join(', ')}` }, 400)
})

const favouriteFlag = validator('json', (v, c) => {
  const { favourite } = v as { favourite?: unknown }
  return typeof favourite === 'boolean' ? { favourite } : c.json({ error: 'favourite must be true or false' }, 400)
})

export const collectionRoutes = (collection: Collection) =>
  new Hono()
    .get('/', statusQuery, async (c) => c.json(await collection.list(c.req.valid('query').status)))
    .put('/:tmdbId/status', tmdbIdParam, statusOrNull, async (c) =>
      c.json(found(await collection.setStatus(c.req.valid('param').tmdbId, c.req.valid('json').status))),
    )
    .put('/:tmdbId/favourite', tmdbIdParam, favouriteFlag, async (c) =>
      c.json(found(await collection.setFavourite(c.req.valid('param').tmdbId, c.req.valid('json').favourite))),
    )
