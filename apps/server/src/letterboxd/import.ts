import type { Collection, NewEntry } from '../collection/collection.js'
import type { Tmdb } from '../tmdb/tmdb.js'

/** Rows of a Letterboxd export CSV, keyed by header. Handles quoted fields ("Crouching Tiger, Hidden Dragon"). */
export function parseCsv(text: string) {
  const [header, ...lines] = text.split(/\r?\n/).filter(Boolean).map(parseLine)
  return lines.map((cells) => Object.fromEntries(header.map((h, i) => [h, cells[i] ?? ''])))
}

function parseLine(line: string) {
  const cells: string[] = []
  let cell = ''
  let quoted = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (quoted && c === '"' && line[i + 1] === '"') cell += line[i++]
    else if (c === '"') quoted = !quoted
    else if (c === ',' && !quoted) {
      cells.push(cell)
      cell = ''
    } else cell += c
  }
  return [...cells, cell]
}

type Row = Record<string, string>
type LetterboxdFilm = { name: string; year: number | null; addedAt: Date; watchedAt: Date | null; favourite: boolean }

/** One film per Letterboxd URI, with the earliest date it was added and the first date it was watched or put in likes.csv. Likes are Favourites. */
export function filmsFrom({ watched, watchlist, likes }: { watched: Row[]; watchlist: Row[]; likes: Row[] }) {
  const films = new Map<string, LetterboxdFilm>()
  const film = (r: Row, seen: boolean) => {
    const date = new Date(r.Date)
    const current = films.get(r['Letterboxd URI'])
    const next: LetterboxdFilm = {
      name: r.Name,
      year: r.Year ? Number(r.Year) : null,
      addedAt: current?.addedAt ?? date,
      watchedAt: current?.watchedAt ?? (seen ? date : null),
      favourite: current?.favourite ?? false,
    }
    films.set(r['Letterboxd URI'], next)
    return next
  }

  for (const r of watchlist) film(r, false)
  for (const r of watched) film(r, true)
  for (const r of likes) film(r, true).favourite = true
  return [...films.values()]
}

/** The three CSVs of a Letterboxd export: watched.csv, watchlist.csv and likes/films.csv. */
export type Export = { watched: string; watchlist: string; likes: string }

/** Adds the export's films to the Collection, matched to TMDB movies. Movies already in it are left alone, so it is safe to rerun. */
export async function importLetterboxd(collection: Collection, tmdb: Tmdb, csv: Export) {
  const films = filmsFrom({
    watched: parseCsv(csv.watched),
    watchlist: parseCsv(csv.watchlist),
    likes: parseCsv(csv.likes),
  })

  const notFound: string[] = []
  const entries: NewEntry[] = []
  for (const { name, year, ...history } of films) {
    // ponytail: exact title + year match on TMDB's first page, else skipped and reported
    const movie = (await tmdb.search(name)).find((m) => m.year === year)
    if (movie) entries.push({ movie, ...history })
    else notFound.push(`${name} (${year})`)
  }
  return { movies: films.length, added: await collection.add(entries), notFound }
}
