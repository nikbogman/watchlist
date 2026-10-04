import { HTTPException } from 'hono/http-exception'
import { validator } from 'hono/validator'

/** Unwraps a TMDB-backed result: null (unknown id) is a 404, answered by the app's onError. */
export function found<T>(result: T | null): T {
  if (result === null) throw new HTTPException(404, { message: 'Movie not found' })
  return result
}

export const tmdbIdParam = validator('param', (v, c) => {
  const tmdbId = Number(v.tmdbId)
  return Number.isInteger(tmdbId) && tmdbId > 0 ? { tmdbId } : c.json({ error: 'tmdbId must be a positive integer' }, 400)
})
