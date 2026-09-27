import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { Db } from '../db.js'
import { collectionEntry } from '../schema/index.js'
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
    else if (c === ',' && !quoted) cells.push(cell), (cell = '')
    else cell += c
  }
  return [...cells, cell]
}

type Row = Record<string, string>
type Film = { name: string; year: number | null; status: 'to_watch' | 'watched'; favourite: boolean; addedAt: Date; watchedAt: Date | null }

/** One Entry per film, keyed by Letterboxd URI. Watched wins over the watchlist; a liked film counts as Watched. */
export function filmsFrom({ watched, watchlist, likes }: { watched: Row[]; watchlist: Row[]; likes: Row[] }) {
  const films = new Map<string, Film>()
  const film = (r: Row) => ({ name: r.Name, year: r.Year ? Number(r.Year) : null, date: new Date(r.Date) })

  for (const r of watchlist) {
    const { name, year, date } = film(r)
    films.set(r['Letterboxd URI'], { name, year, status: 'to_watch', favourite: false, addedAt: date, watchedAt: null })
  }
  for (const r of [...watched, ...likes]) {
    const { name, year, date } = film(r)
    const current = films.get(r['Letterboxd URI'])
    const watchedAt = current?.watchedAt ?? date
    films.set(r['Letterboxd URI'], { name, year, status: 'watched', favourite: current?.favourite ?? false, addedAt: current?.addedAt ?? date, watchedAt })
  }
  for (const r of likes) films.get(r['Letterboxd URI'])!.favourite = true

  return [...films.values()]
}

/** Adds the export's films to the Collection. Films already in it are left alone, so it is safe to rerun. */
export async function importLetterboxd(db: Db, tmdb: Tmdb, dir: string) {
  const csv = async (file: string) => parseCsv(await readFile(join(dir, file), 'utf8'))
  const films = filmsFrom({ watched: await csv('watched.csv'), watchlist: await csv('watchlist.csv'), likes: await csv('likes/films.csv') })

  const unmatched: string[] = []
  let added = 0
  for (const { name, year, ...entry } of films) {
    // ponytail: exact title + year match on TMDB's first page, else skipped and reported
    const movie = (await tmdb.search(name)).find((m) => m.year === year)
    if (!movie) {
      unmatched.push(`${name} (${year})`)
      continue
    }
    const inserted = await db
      .insert(collectionEntry)
      .values({ tmdbId: movie.tmdbId, title: movie.title, year: movie.year, posterPath: movie.posterPath, ...entry })
      .onConflictDoNothing()
      .returning()
    added += inserted.length
  }
  return { films: films.length, added, unmatched }
}

if (import.meta.main) {
  const dir = process.argv[2]
  const { DATABASE_URL, TMDB_API_KEY } = process.env
  if (!dir) throw new Error('Usage: pnpm import:letterboxd <export folder>')
  if (!DATABASE_URL || !TMDB_API_KEY) throw new Error('Set DATABASE_URL and TMDB_API_KEY')
  const { createDb } = await import('../db.js')
  const { createTmdbClient } = await import('../tmdb/tmdb.js')
  const { films, added, unmatched } = await importLetterboxd(await createDb(DATABASE_URL), createTmdbClient(TMDB_API_KEY), dir)
  console.log(`${films} films in the export, ${added} added, ${films - added - unmatched.length} already in the Collection`)
  if (unmatched.length) console.log(`No TMDB match, add these by hand:\n  ${unmatched.join('\n  ')}`)
  process.exit(0)
}
