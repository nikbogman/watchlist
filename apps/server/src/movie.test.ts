import { expect, test } from 'vitest'
import { fakeTmdb, testApp } from './test-app.js'

const heat = { tmdbId: 3, title: 'Heat', year: 1995, posterPath: '/heat.jpg', overview: 'A heist.' }

test('movie details come from TMDB with a w500 poster and the tracked state', async () => {
  const t = await testApp(fakeTmdb([heat]))
  const res = await t.request('/api/movies/3', { cookie: await t.login() })
  expect(res.status).toBe(200)
  expect(await res.json()).toEqual({
    tmdbId: 3,
    title: 'Heat',
    year: 1995,
    posterUrl: 'https://image.tmdb.org/t/p/w500/heat.jpg',
    overview: 'A heist.',
    status: null,
    favourite: false,
    watchedAt: null,
  })
})

test('movie details need a session', async () => {
  const t = await testApp(fakeTmdb([heat]))
  expect((await t.request('/api/movies/3')).status).toBe(401)
})

test('movie details return 404 when TMDB does not know the id', async () => {
  const t = await testApp(fakeTmdb([heat]))
  expect((await t.request('/api/movies/99', { cookie: await t.login() })).status).toBe(404)
})

test('movie details need a numeric id', async () => {
  const t = await testApp(fakeTmdb([heat]))
  expect((await t.request('/api/movies/abc', { cookie: await t.login() })).status).toBe(400)
})

test('movie details return 502 when TMDB is down', async () => {
  const tmdb = fakeTmdb([heat])
  tmdb.down = true
  const t = await testApp(tmdb)
  expect((await t.request('/api/movies/3', { cookie: await t.login() })).status).toBe(502)
})
