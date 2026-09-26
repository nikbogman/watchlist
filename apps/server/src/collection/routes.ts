import { Hono } from 'hono'
import { validator } from 'hono/validator'
import { found, tmdbIdParam } from '../http.js'
import { STATUSES, type Collection, type Status } from './collection.js'

const isStatus = (s: unknown): s is Status => STATUSES.includes(s as Status)

const statusIn = <T extends 'query' | 'json'>(target: T) =>
  validator(target, (v, c) => {
    const { status } = v as { status?: unknown }
    return isStatus(status) ? { status } : c.json({ error: `status must be one of ${STATUSES.join(', ')}` }, 400)
  })

export const collectionRoutes = (collection: Collection) =>
  new Hono()
    .get('/', statusIn('query'), async (c) => c.json(await collection.list(c.req.valid('query').status)))
    .post('/:tmdbId/status', tmdbIdParam, statusIn('json'), async (c) =>
      c.json(found(await collection.toggleStatus(c.req.valid('param').tmdbId, c.req.valid('json').status))),
    )
    .post('/:tmdbId/favourite', tmdbIdParam, async (c) => c.json(found(await collection.toggleFavourite(c.req.valid('param').tmdbId))))
