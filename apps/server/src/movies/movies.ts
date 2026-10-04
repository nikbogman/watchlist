const IMAGES = 'https://image.tmdb.org/t/p'
const SIZES = { row: 'w185', page: 'w500' }

/** A movie as the server holds it: the poster is a path, sized only when a response is shaped. */
export type Movie = { tmdbId: number; title: string; year: number | null; posterPath: string | null }

export type MovieDetails = Movie & { overview: string }

/** A list or search row as the app receives it. */
export type MovieSummary = Omit<Movie, 'posterPath'> & { posterUrl: string | null }

const posterUrl = (path: string | null, use: keyof typeof SIZES) => (path ? `${IMAGES}/${SIZES[use]}${path}` : null)

export const toRow = ({ tmdbId, title, year, posterPath }: Movie): MovieSummary => ({
  tmdbId,
  title,
  year,
  posterUrl: posterUrl(posterPath, 'row'),
})

export const toPage = ({ posterPath, ...m }: MovieDetails) => ({ ...m, posterUrl: posterUrl(posterPath, 'page') })
