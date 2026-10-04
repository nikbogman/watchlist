import { expect, test } from 'vitest'
import { collectionEntry } from '../schema/index.js'
import { EMAIL, PASSWORD, fakeTmdb, testApp } from '../test/test-app.js'
import { parseCsv } from './import.js'

const HEADER = 'Date,Name,Year,Letterboxd URI'

test('quoted names keep their commas and quotes', () => {
  expect(parseCsv(`${HEADER}\r\n2026-01-01,"Crouching Tiger, Hidden Dragon",2000,u1\r\n2026-01-01,"The ""Best"" Film",1999,u2\r\n`)).toEqual([
    { Date: '2026-01-01', Name: 'Crouching Tiger, Hidden Dragon', Year: '2000', 'Letterboxd URI': 'u1' },
    { Date: '2026-01-01', Name: 'The "Best" Film', Year: '1999', 'Letterboxd URI': 'u2' },
  ])
})

const tmdb = fakeTmdb([
  { tmdbId: 3, title: 'Heat', year: 1995, posterPath: null },
  { tmdbId: 30, title: 'Heat', year: 1986, posterPath: null },
  { tmdbId: 4, title: 'Alien', year: 1979, posterPath: null },
  { tmdbId: 5, title: 'Ran', year: 1985, posterPath: null },
])

function form(password: string) {
  const body = new FormData()
  body.set('email', EMAIL)
  body.set('password', password)
  body.set('watchlist', new File([`${HEADER}\n2026-01-01,Alien,1979,alien\n2026-01-01,Heat,1995,heat\n2026-01-01,Nowhere,2000,nowhere\n`], 'watchlist.csv'))
  body.set('watched', new File([`${HEADER}\n2026-02-01,Heat,1995,heat\n2026-02-02,Ran,1985,ran\n`], 'watched.csv'))
  body.set('likes', new File([`${HEADER}\n2026-03-01,Ran,1985,ran\n`], 'films.csv'))
  return body
}

test('imports the watchlist, Watched and likes as Entries, matching TMDB by title and year', async () => {
  const t = await testApp(tmdb)
  const upload = async () => (await t.request('/api/import/letterboxd', { method: 'POST', body: form(PASSWORD) })).json()

  expect(await upload()).toEqual({ movies: 4, added: 3, notFound: ['Nowhere (2000)'] })
  expect(await upload()).toEqual({ movies: 4, added: 0, notFound: ['Nowhere (2000)'] })

  const entries = await t.db.select().from(collectionEntry).orderBy(collectionEntry.tmdbId)
  expect(entries.map(({ tmdbId, status, favourite, addedAt, watchedAt }) => ({ tmdbId, status, favourite, addedAt, watchedAt }))).toEqual([
    { tmdbId: 3, status: 'watched', favourite: false, addedAt: new Date('2026-01-01'), watchedAt: new Date('2026-02-01') },
    { tmdbId: 4, status: 'to_watch', favourite: false, addedAt: new Date('2026-01-01'), watchedAt: null },
    { tmdbId: 5, status: 'watched', favourite: true, addedAt: new Date('2026-02-02'), watchedAt: new Date('2026-02-02') },
  ])
})

test('the import needs the right password', async () => {
  const t = await testApp(tmdb)
  const res = await t.request('/api/import/letterboxd', { method: 'POST', body: form('nope') })
  expect(res.status).toBe(401)
  expect(await t.db.select().from(collectionEntry)).toEqual([])
})

test('the import returns 502 when TMDB is down', async () => {
  const down = fakeTmdb()
  down.down = true
  const t = await testApp(down)
  const res = await t.request('/api/import/letterboxd', { method: 'POST', body: form(PASSWORD) })
  expect(res.status).toBe(502)
  expect(await res.json()).toEqual({ error: 'TMDB is unreachable' })
})

test('imports an export larger than one database statement can carry', { timeout: 60_000 }, async () => {
  const n = 9000
  const t = await testApp({
    async search(name) {
      const id = Number(name.slice('Film '.length))
      return [{ tmdbId: id, title: name, year: 2000, posterPath: null }]
    },
    async details() {
      return null
    },
  })
  const body = new FormData()
  body.set('email', EMAIL)
  body.set('password', PASSWORD)
  const rows = Array.from({ length: n }, (_, i) => `2026-01-01,Film ${i + 1},2000,u${i + 1}`).join('\n')
  body.set('watchlist', new File([`${HEADER}\n${rows}\n`], 'watchlist.csv'))
  body.set('watched', new File([`${HEADER}\n`], 'watched.csv'))
  body.set('likes', new File([`${HEADER}\n`], 'films.csv'))

  const res = await t.request('/api/import/letterboxd', { method: 'POST', body })
  expect(await res.json()).toEqual({ movies: n, added: n, notFound: [] })
})
