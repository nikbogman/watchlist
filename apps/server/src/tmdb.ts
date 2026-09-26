const API = 'https://api.themoviedb.org/3'
const IMAGES = 'https://image.tmdb.org/t/p'

export type MovieSummary = { tmdbId: number; title: string; year: number | null; posterUrl: string | null }

export type Tmdb = {
  search(query: string): Promise<MovieSummary[]>
}

type TmdbMovie = { id: number; title: string; release_date?: string; poster_path: string | null; adult?: boolean }

export const posterUrl = (path: string | null, size: 'w185' | 'w500') => (path ? `${IMAGES}/${size}${path}` : null)

// TMDB sends "" for an unknown release date.
const yearOf = (date?: string) => (date ? Number(date.slice(0, 4)) : null)

export function createTmdbClient(apiKey: string, fetchFn: typeof fetch = fetch): Tmdb {
  async function get<T>(path: string, params: Record<string, string>): Promise<T> {
    const res = await fetchFn(`${API}${path}?${new URLSearchParams({ ...params, api_key: apiKey })}`)
    if (!res.ok) throw new Error(`TMDB ${path} failed with ${res.status}`)
    return res.json() as Promise<T>
  }

  return {
    async search(query) {
      const { results } = await get<{ results: TmdbMovie[] }>('/search/movie', { query, include_adult: 'false' })
      return results
        .filter((m) => !m.adult)
        .map((m) => ({ tmdbId: m.id, title: m.title, year: yearOf(m.release_date), posterUrl: posterUrl(m.poster_path, 'w185') }))
    },
  }
}
