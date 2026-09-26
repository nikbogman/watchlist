import { expect, test } from 'vitest'
import { fakeTmdb, testApp } from './test-app.js'

const movies = [
  { tmdbId: 1, title: 'Before Sunrise', year: 1995, posterPath: '/a.jpg' },
  { tmdbId: 2, title: 'Before Sunset', year: 2004, posterPath: null },
  { tmdbId: 3, title: 'Heat', year: 1995, posterPath: null },
]

test('search returns TMDB results in TMDB order, with w185 posters', async () => {
  const t = await testApp(fakeTmdb(movies))
  const res = await t.request('/api/search?q=before', { cookie: await t.login() })
  expect(res.status).toBe(200)
  expect(await res.json()).toEqual([
    { tmdbId: 1, title: 'Before Sunrise', year: 1995, posterUrl: 'https://image.tmdb.org/t/p/w185/a.jpg' },
    { tmdbId: 2, title: 'Before Sunset', year: 2004, posterUrl: null },
  ])
})

test('search needs a session', async () => {
  const t = await testApp(fakeTmdb(movies))
  expect((await t.request('/api/search?q=before')).status).toBe(401)
})

test('search needs a query', async () => {
  const t = await testApp()
  expect((await t.request('/api/search?q=%20', { cookie: await t.login() })).status).toBe(400)
})

test('search returns 502 when TMDB is down', async () => {
  const tmdb = fakeTmdb(movies)
  tmdb.down = true
  const t = await testApp(tmdb)
  expect((await t.request('/api/search?q=before', { cookie: await t.login() })).status).toBe(502)
})
