import { mkdtemp, mkdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, test } from 'vitest'
import { collectionEntry } from '../schema/index.js'
import { fakeTmdb, testApp } from '../test/test-app.js'
import { importLetterboxd, parseCsv } from './import.js'

const HEADER = 'Date,Name,Year,Letterboxd URI'

test('quoted names keep their commas and quotes', () => {
  expect(parseCsv(`${HEADER}\r\n2026-01-01,"Crouching Tiger, Hidden Dragon",2000,u1\r\n2026-01-01,"The ""Best"" Film",1999,u2\r\n`)).toEqual([
    { Date: '2026-01-01', Name: 'Crouching Tiger, Hidden Dragon', Year: '2000', 'Letterboxd URI': 'u1' },
    { Date: '2026-01-01', Name: 'The "Best" Film', Year: '1999', 'Letterboxd URI': 'u2' },
  ])
})

test('imports the watchlist, Watched and likes as Entries, matching TMDB by title and year', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'letterboxd-'))
  await mkdir(join(dir, 'likes'))
  await writeFile(join(dir, 'watchlist.csv'), `${HEADER}\n2026-01-01,Alien,1979,alien\n2026-01-01,Heat,1995,heat\n2026-01-01,Nowhere,2000,nowhere\n`)
  await writeFile(join(dir, 'watched.csv'), `${HEADER}\n2026-02-01,Heat,1995,heat\n2026-02-02,Ran,1985,ran\n`)
  await writeFile(join(dir, 'likes/films.csv'), `${HEADER}\n2026-03-01,Ran,1985,ran\n`)

  const { db } = await testApp()
  const tmdb = fakeTmdb([
    { tmdbId: 3, title: 'Heat', year: 1995, posterPath: null },
    { tmdbId: 30, title: 'Heat', year: 1986, posterPath: null },
    { tmdbId: 4, title: 'Alien', year: 1979, posterPath: null },
    { tmdbId: 5, title: 'Ran', year: 1985, posterPath: null },
  ])

  expect(await importLetterboxd(db, tmdb, dir)).toEqual({ films: 4, added: 3, unmatched: ['Nowhere (2000)'] })
  expect(await importLetterboxd(db, tmdb, dir)).toEqual({ films: 4, added: 0, unmatched: ['Nowhere (2000)'] })

  const entries = await db.select().from(collectionEntry).orderBy(collectionEntry.tmdbId)
  expect(entries.map(({ tmdbId, status, favourite, addedAt, watchedAt }) => ({ tmdbId, status, favourite, addedAt, watchedAt }))).toEqual([
    { tmdbId: 3, status: 'watched', favourite: false, addedAt: new Date('2026-01-01'), watchedAt: new Date('2026-02-01') },
    { tmdbId: 4, status: 'to_watch', favourite: false, addedAt: new Date('2026-01-01'), watchedAt: null },
    { tmdbId: 5, status: 'watched', favourite: true, addedAt: new Date('2026-02-02'), watchedAt: new Date('2026-02-02') },
  ])
})
