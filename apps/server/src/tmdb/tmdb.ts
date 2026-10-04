import type { Movie, MovieDetails } from '../movies/movies.js'

const API = 'https://api.themoviedb.org/3'

/** What every TMDB call throws when TMDB can't be reached or errors. The app answers it with a 502. */
export class TmdbUnreachable extends Error {
  constructor(cause?: unknown) {
    super('TMDB is unreachable', { cause })
  }
}

/** Both calls throw TmdbUnreachable when TMDB can't be reached. */
export type Tmdb = {
  search(query: string): Promise<Movie[]>
  /** Resolves to null when TMDB doesn't know the id. */
  details(tmdbId: number): Promise<MovieDetails | null>
}

type TmdbMovie = { id: number; title: string; release_date?: string; poster_path: string | null; adult?: boolean; overview?: string }

// TMDB sends "" for an unknown release date.
const yearOf = (date?: string) => (date ? Number(date.slice(0, 4)) : null)

export function createTmdbClient(apiKey: string, fetchFn: typeof fetch = fetch): Tmdb {
  async function get<T>(path: string, params: Record<string, string> = {}): Promise<T | null> {
    const res = await fetchFn(`${API}${path}?${new URLSearchParams({ ...params, api_key: apiKey })}`)
    if (res.status === 404) return null
    if (!res.ok) throw new Error(`TMDB ${path} failed with ${res.status}`)
    return res.json() as Promise<T>
  }

  // Network errors, error statuses and bodies that aren't what TMDB documents all mean TMDB can't serve us.
  const unreachable = <A extends unknown[], R>(call: (...args: A) => Promise<R>) =>
    (...args: A) => call(...args).catch((e: unknown) => {
      throw e instanceof TmdbUnreachable ? e : new TmdbUnreachable(e)
    })

  return {
    search: unreachable(async (query: string) => {
      const { results } = (await get<{ results: TmdbMovie[] }>('/search/movie', { query, include_adult: 'false' }))!
      return results
        .filter((m) => !m.adult)
        .map((m) => ({ tmdbId: m.id, title: m.title, year: yearOf(m.release_date), posterPath: m.poster_path }))
    }),
    details: unreachable(async (tmdbId: number) => {
      const m = await get<TmdbMovie>(`/movie/${tmdbId}`)
      if (!m) return null
      return { tmdbId: m.id, title: m.title, year: yearOf(m.release_date), posterPath: m.poster_path, overview: m.overview ?? '' }
    }),
  }
}
