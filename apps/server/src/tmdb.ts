const API = 'https://api.themoviedb.org/3'
const IMAGES = 'https://image.tmdb.org/t/p'

/** A movie as the TMDB adapters return it: the poster is a path, sized only when a response is shaped. */
export type Movie = { tmdbId: number; title: string; year: number | null; posterPath: string | null }

export type MovieDetails = Movie & { overview: string }

/** A list or search row as the app receives it. */
export type MovieSummary = { tmdbId: number; title: string; year: number | null; posterUrl: string | null }

export type Tmdb = {
  search(query: string): Promise<Movie[]>
  /** Resolves to null when TMDB doesn't know the id. */
  details(tmdbId: number): Promise<MovieDetails | null>
}

type TmdbMovie = { id: number; title: string; release_date?: string; poster_path: string | null; adult?: boolean; overview?: string }

const SIZES = { row: 'w185', page: 'w500' }

const posterUrl = (path: string | null, use: keyof typeof SIZES) => (path ? `${IMAGES}/${SIZES[use]}${path}` : null)

export const toRow = ({ tmdbId, title, year, posterPath }: Movie): MovieSummary => ({ tmdbId, title, year, posterUrl: posterUrl(posterPath, 'row') })

export const toPage = ({ posterPath, ...m }: MovieDetails) => ({ ...m, posterUrl: posterUrl(posterPath, 'page') })

// TMDB sends "" for an unknown release date.
const yearOf = (date?: string) => (date ? Number(date.slice(0, 4)) : null)

export function createTmdbClient(apiKey: string, fetchFn: typeof fetch = fetch): Tmdb {
  async function get<T>(path: string, params: Record<string, string> = {}): Promise<T | null> {
    const res = await fetchFn(`${API}${path}?${new URLSearchParams({ ...params, api_key: apiKey })}`)
    if (res.status === 404) return null
    if (!res.ok) throw new Error(`TMDB ${path} failed with ${res.status}`)
    return res.json() as Promise<T>
  }

  return {
    async search(query) {
      const { results } = (await get<{ results: TmdbMovie[] }>('/search/movie', { query, include_adult: 'false' }))!
      return results
        .filter((m) => !m.adult)
        .map((m) => ({ tmdbId: m.id, title: m.title, year: yearOf(m.release_date), posterPath: m.poster_path }))
    },
    async details(tmdbId) {
      const m = await get<TmdbMovie>(`/movie/${tmdbId}`)
      if (!m) return null
      return { tmdbId: m.id, title: m.title, year: yearOf(m.release_date), posterPath: m.poster_path, overview: m.overview ?? '' }
    },
  }
}
