import { expect, test } from 'vitest'
import { collectionEntry } from '../collection/schema'
import { fakeTmdb, testApp } from '../test/test-app'
import { parseCsv, toCsv } from './csv'

const HEADER = 'TMDB ID,Title,Year,Status,Favourite,Added,Watched'

test('quoted cells keep their commas, quotes and line breaks', () => {
  const rows = [
    { Name: 'Crouching Tiger, Hidden Dragon', Note: 'two\nlines' },
    { Name: 'The "Best" Film', Note: '' },
  ]
  expect(
    parseCsv(
      toCsv(
        ['Name', 'Note'],
        rows.map((r) => [r.Name, r.Note]),
      ),
    ),
  ).toEqual(rows)
  expect(parseCsv('Name,Year\r\n"Crouching Tiger, Hidden Dragon",2000\r\n')).toEqual([
    { Name: 'Crouching Tiger, Hidden Dragon', Year: '2000' },
  ])
})

const tmdb = fakeTmdb([
  { tmdbId: 3, title: 'Heat', year: 1995, posterPath: '/heat.jpg' },
  { tmdbId: 30, title: 'Heat', year: 1986, posterPath: null },
  { tmdbId: 4, title: 'Alien', year: 1979, posterPath: null },
  { tmdbId: 5, title: 'Ran', year: 1985, posterPath: null },
])

const csv = [
  HEADER,
  '4,Alien,1979,to_watch,false,2026-01-01T00:00:00.000Z,',
  ',Heat,1995,watched,false,2026-01-01T00:00:00.000Z,2026-02-01T00:00:00.000Z',
  ',Ran,1985,,true,2026-02-02T00:00:00.000Z,',
  ',Nowhere,2000,to_watch,false,,',
  '999,Gone,2001,to_watch,false,,',
  'abc,Typo,2001,to_watch,false,,',
  ',Undated,2001,watched,false,2026-01-01,yesterday',
].join('\n')

test('imports a CSV into the Collection, by TMDB ID or else title and year, and is safe to rerun', async () => {
  const t = await testApp(tmdb)
  const cookie = await t.login()
  const upload = async () => (await t.request('/api/collection/import', { method: 'POST', cookie, body: csv })).json()

  expect(await upload()).toEqual({
    movies: 7,
    added: 3,
    notFound: ['Nowhere (2000)', 'Gone (2001)'],
    invalid: ['Typo (2001)', 'Undated (2001)'],
  })
  expect(await upload()).toEqual({
    movies: 7,
    added: 0,
    notFound: ['Nowhere (2000)', 'Gone (2001)'],
    invalid: ['Typo (2001)', 'Undated (2001)'],
  })

  const entries = await t.db.select().from(collectionEntry).orderBy(collectionEntry.tmdbId)
  expect(
    entries.map(({ tmdbId, posterPath, status, favourite, addedAt, watchedAt }) => ({
      tmdbId,
      posterPath,
      status,
      favourite,
      addedAt,
      watchedAt,
    })),
  ).toEqual([
    {
      tmdbId: 3,
      posterPath: '/heat.jpg',
      status: 'watched',
      favourite: false,
      addedAt: new Date('2026-01-01'),
      watchedAt: new Date('2026-02-01'),
    },
    { tmdbId: 4, posterPath: null, status: 'to_watch', favourite: false, addedAt: new Date('2026-01-01'), watchedAt: null },
    // A Favourite is Watched; with no Watched date it was watched when it was added.
    { tmdbId: 5, posterPath: null, status: 'watched', favourite: true, addedAt: new Date('2026-02-02'), watchedAt: new Date('2026-02-02') },
  ])
})

test('exports the Collection as a CSV the import reads back', async () => {
  const t = await testApp(tmdb)
  const cookie = await t.login()
  await t.request('/api/collection/import', { method: 'POST', cookie, body: csv })

  const res = await t.request('/api/collection/export', { cookie })
  expect(res.headers.get('content-type')).toMatch(/^text\/csv/)
  expect(res.headers.get('content-disposition')).toBe('attachment; filename="watcher.csv"')
  const exported = await res.text()
  expect(exported).toBe(
    [
      HEADER,
      '3,Heat,1995,watched,false,2026-01-01T00:00:00.000Z,2026-02-01T00:00:00.000Z',
      '4,Alien,1979,to_watch,false,2026-01-01T00:00:00.000Z,',
      '5,Ran,1985,watched,true,2026-02-02T00:00:00.000Z,2026-02-02T00:00:00.000Z',
    ].join('\r\n') + '\r\n',
  )

  const fresh = await testApp(tmdb)
  const freshCookie = await fresh.login()
  await fresh.request('/api/collection/import', { method: 'POST', cookie: freshCookie, body: exported })
  expect(await (await fresh.request('/api/collection/export', { cookie: freshCookie })).text()).toBe(exported)
})

test('a CSV in another format is refused', async () => {
  const t = await testApp(tmdb)
  const res = await t.request('/api/collection/import', {
    method: 'POST',
    cookie: await t.login(),
    body: 'Date,Name,Year,Letterboxd URI\n2026-01-01,Heat,1995,u1\n',
  })
  expect(res.status).toBe(400)
  expect(await res.json()).toEqual({ error: `The CSV's header must be ${HEADER}` })
})

test('import and export need a session', async () => {
  const t = await testApp(tmdb)
  expect((await t.request('/api/collection/import', { method: 'POST', body: csv })).status).toBe(401)
  expect((await t.request('/api/collection/export')).status).toBe(401)
  expect(await t.db.select().from(collectionEntry)).toEqual([])
})

test('the import returns 502 when TMDB is down', async () => {
  const down = fakeTmdb()
  down.down = true
  const t = await testApp(down)
  const res = await t.request('/api/collection/import', { method: 'POST', cookie: await t.login(), body: csv })
  expect(res.status).toBe(502)
  expect(await res.json()).toEqual({ error: 'TMDB is unreachable' })
})

test('imports a CSV larger than one database statement can carry', { timeout: 60_000 }, async () => {
  const n = 9000
  const t = await testApp({
    async search() {
      return []
    },
    async details(tmdbId) {
      return { tmdbId, title: `Film ${tmdbId}`, year: 2000, posterPath: null, overview: '' }
    },
  })
  const rows = Array.from({ length: n }, (_, i) => `${i + 1},Film ${i + 1},2000,to_watch,false,2026-01-01T00:00:00.000Z,`).join('\n')
  const res = await t.request('/api/collection/import', { method: 'POST', cookie: await t.login(), body: `${HEADER}\n${rows}\n` })
  expect(await res.json()).toEqual({ movies: n, added: n, notFound: [], invalid: [] })
})
