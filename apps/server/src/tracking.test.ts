import { sql } from 'drizzle-orm'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { fakeTmdb, testApp } from './test-app.js'

const heat = { tmdbId: 3, title: 'Heat', year: 1995, posterPath: '/heat.jpg' }
const alien = { tmdbId: 4, title: 'Alien', year: 1979, posterPath: null }
const ran = { tmdbId: 5, title: 'Ran', year: 1985, posterPath: '/ran.jpg' }

const DAY1 = new Date('2026-01-01T10:00:00Z')
const DAY2 = new Date('2026-01-02T10:00:00Z')

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(DAY1)
})
afterEach(() => vi.useRealTimers())

async function tracking(tmdb = fakeTmdb([heat, alien, ran])) {
  const t = await testApp(tmdb)
  const cookie = await t.login()
  return {
    tmdb,
    press: (tmdbId: number, button: string) => t.post(`/api/movies/${tmdbId}/press`, { button }, cookie),
    async state(tmdbId: number) {
      const { status, favourite, watchedAt } = await (await t.request(`/api/movies/${tmdbId}`, { cookie })).json()
      return { status, favourite, watchedAt }
    },
    toWatch: () => t.request('/api/lists/to-watch', { cookie }),
    app: t,
  }
}

const untracked = { status: null, favourite: false, watchedAt: null }
const toWatch = { status: 'to_watch', favourite: false, watchedAt: null }
const watched = { status: 'watched', favourite: false, watchedAt: DAY1.toISOString() }
const favourite = { ...watched, favourite: true }

// [state reached by these presses, button pressed, expected state]
const table: [string[], string, object][] = [
  [[], 'to_watch', toWatch],
  [[], 'watched', watched],
  [[], 'favourite', favourite],
  [['to_watch'], 'to_watch', untracked],
  [['to_watch'], 'watched', watched],
  [['to_watch'], 'favourite', favourite],
  [['watched'], 'to_watch', toWatch],
  [['watched'], 'watched', untracked],
  [['watched'], 'favourite', favourite],
  [['favourite'], 'to_watch', toWatch],
  [['favourite'], 'watched', untracked],
  [['favourite'], 'favourite', watched],
]

test.each(table)('after %j, pressing %s gives %j', async (setup, button, expected) => {
  const t = await tracking()
  for (const b of setup) expect((await t.press(3, b)).status).toBe(200)
  const res = await t.press(3, button)
  expect(res.status).toBe(200)
  expect(await res.json()).toEqual(expected)
  expect(await t.state(3)).toEqual(expected)
})

test('an untracked movie is not tracked', async () => {
  expect(await (await tracking()).state(3)).toEqual(untracked)
})

test('toggling Favourite keeps the Watched date', async () => {
  const t = await tracking()
  await t.press(3, 'watched')
  vi.setSystemTime(DAY2)
  await t.press(3, 'favourite')
  expect(await t.state(3)).toEqual(favourite)
})

test('To watch lists To watch movies newest added first, from the stored copy', async () => {
  const t = await tracking()
  await t.press(3, 'to_watch')
  vi.setSystemTime(DAY2)
  await t.press(4, 'to_watch')
  await t.press(5, 'watched')
  t.tmdb.down = true
  const res = await t.toWatch()
  expect(res.status).toBe(200)
  expect(await res.json()).toEqual([
    { tmdbId: 4, title: 'Alien', year: 1979, posterUrl: null },
    { tmdbId: 3, title: 'Heat', year: 1995, posterUrl: 'https://image.tmdb.org/t/p/w185/heat.jpg' },
  ])
})

test('a movie moved back from Watched counts as newly added', async () => {
  const t = await tracking()
  await t.press(3, 'watched')
  await t.press(4, 'to_watch')
  vi.setSystemTime(DAY2)
  await t.press(3, 'to_watch')
  expect((await (await t.toWatch()).json()).map((m: { tmdbId: number }) => m.tmdbId)).toEqual([3, 4])
})

test('untracked movies leave To watch', async () => {
  const t = await tracking()
  await t.press(3, 'to_watch')
  await t.press(3, 'to_watch')
  expect(await (await t.toWatch()).json()).toEqual([])
})

test('starting to track an unknown movie returns 404', async () => {
  expect((await (await tracking()).press(99, 'to_watch')).status).toBe(404)
})

test('starting to track returns 502 when TMDB is down', async () => {
  const t = await tracking()
  t.tmdb.down = true
  expect((await t.press(3, 'to_watch')).status).toBe(502)
})

test('pressing a tracked movie does not need TMDB', async () => {
  const t = await tracking()
  await t.press(3, 'to_watch')
  t.tmdb.down = true
  expect((await t.press(3, 'watched')).status).toBe(200)
})

test('press needs a known button', async () => {
  expect((await (await tracking()).press(3, 'love')).status).toBe(400)
})

test('tracking routes need a session', async () => {
  const { app: t } = await tracking()
  expect((await t.post('/api/movies/3/press', { button: 'to_watch' })).status).toBe(401)
  expect((await t.request('/api/lists/to-watch')).status).toBe(401)
})

test('a database failure on press is a 500, not a TMDB error', async () => {
  const tr = await tracking()
  await tr.app.db.run(sql`drop table tracked_movies`)
  const res = await tr.press(3, 'to_watch')
  expect(res.status).toBe(500)
  expect(await res.json()).toEqual({ error: 'Internal error' })
})

test('an unknown list returns 404', async () => {
  const tr = await tracking()
  expect((await tr.app.request('/api/lists/someday', { cookie: await tr.app.login() })).status).toBe(404)
})
