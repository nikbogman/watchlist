import { HTTPException } from 'hono/http-exception'
import type { Collection, NewEntry } from '../collection/collection'
import type { Tmdb } from '../tmdb/tmdb'

/** Rows of a CSV, keyed by header. Handles quoted cells ("Crouching Tiger, Hidden Dragon"), including line breaks inside them. */
export function parseCsv(text: string) {
  const lines: string[][] = []
  let line: string[] = []
  let cell = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quoted && c === '"' && text[i + 1] === '"') cell += text[i++]
    else if (c === '"') quoted = !quoted
    else if (c === ',' && !quoted) {
      line.push(cell)
      cell = ''
    } else if ((c === '\n' || c === '\r') && !quoted) {
      if (c === '\r' && text[i + 1] === '\n') i++
      lines.push([...line, cell])
      line = []
      cell = ''
    } else cell += c
  }
  lines.push([...line, cell])

  const [header, ...rows] = lines.filter((l) => l.some(Boolean))
  return rows.map((cells) => Object.fromEntries(header.map((h, i) => [h, cells[i] ?? ''])))
}

const quote = (cell: string) => (/[",\r\n]/.test(cell) ? `"${cell.replaceAll('"', '""')}"` : cell)

/** A CSV with CRLF line endings, quoting only the cells that need it. */
export const toCsv = (header: string[], rows: string[][]) => [header, ...rows].map((r) => r.map(quote).join(',') + '\r\n').join('')

const HEADER = ['TMDB ID', 'Title', 'Year', 'Status', 'Favourite', 'Added', 'Watched']

/** The whole Collection, oldest added first, in the format importCsv reads. */
export async function exportCsv(collection: Collection) {
  const entries = await collection.all()
  return toCsv(
    HEADER,
    entries.map((e) => [
      String(e.tmdbId),
      e.title,
      e.year === null ? '' : String(e.year),
      e.status,
      String(e.favourite),
      e.addedAt.toISOString(),
      e.watchedAt?.toISOString() ?? '',
    ]),
  )
}

const date = (text: string | undefined, fallback: Date) => (text ? new Date(text) : fallback)
const isDate = (d: Date | null) => d === null || !Number.isNaN(d.getTime())

/**
 * Adds the CSV's movies to the Collection. A row is matched by TMDB ID, else by title and year.
 * Watched if it has a Watched date, Status watched or is a Favourite. Movies already in it are left alone, so it is safe to rerun.
 * Rows with an unreadable TMDB ID, year or date are skipped and reported as invalid.
 */
export async function importCsv(collection: Collection, tmdb: Tmdb, csv: string) {
  const rows = parseCsv(csv)
  if (rows.length && !HEADER.every((h) => h in rows[0])) {
    throw new HTTPException(400, { message: `The CSV's header must be ${HEADER.join(',')}` })
  }
  const now = new Date()
  const notFound: string[] = []
  const invalid: string[] = []
  const entries: NewEntry[] = []
  for (const r of rows) {
    const name = `${r.Title} (${r.Year})`
    const tmdbId = r['TMDB ID'] ? Number(r['TMDB ID']) : null
    const year = r.Year ? Number(r.Year) : null
    const favourite = r.Favourite === 'true'
    const addedAt = date(r.Added, now)
    const watchedAt = r.Watched || r.Status === 'watched' || favourite ? date(r.Watched, addedAt) : null
    if (
      !(tmdbId === null || Number.isInteger(tmdbId)) ||
      !(year === null || Number.isInteger(year)) ||
      !isDate(addedAt) ||
      !isDate(watchedAt)
    ) {
      invalid.push(name)
      continue
    }
    // ponytail: without a TMDB ID, exact title + year match on TMDB's first page, else skipped and reported
    const movie = tmdbId ? await tmdb.details(tmdbId) : (await tmdb.search(r.Title)).find((m) => m.year === year)
    if (movie) entries.push({ movie, addedAt, watchedAt, favourite })
    else notFound.push(name)
  }
  return { movies: rows.length, added: await collection.add(entries), notFound, invalid }
}
