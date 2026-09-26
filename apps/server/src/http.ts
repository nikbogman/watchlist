import { HTTPException } from 'hono/http-exception'
import { validator } from 'hono/validator'
import { UNREACHABLE } from './tmdb/tmdb.js'

/** Unwraps a TMDB-backed result: UNREACHABLE is a 502 and null (unknown id) a 404, both answered by the app's onError. */
export function found<T>(result: T | null | typeof UNREACHABLE): T {
  if (result === UNREACHABLE) throw new HTTPException(502, { message: 'TMDB is unreachable' })
  if (result === null) throw new HTTPException(404, { message: 'Movie not found' })
  return result
}

export const tmdbIdParam = validator('param', (v, c) => {
  const tmdbId = Number(v.tmdbId)
  return Number.isInteger(tmdbId) && tmdbId > 0 ? { tmdbId } : c.json({ error: 'tmdbId must be a positive integer' }, 400)
})
