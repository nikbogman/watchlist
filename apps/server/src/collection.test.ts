import { sql } from 'drizzle-orm'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import type { Status } from './collection.js'
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

type Toggle = Status | 'favourite'

async function collection(tmdb = fakeTmdb([heat, alien, ran])) {
  const t = await testApp(tmdb)
  const cookie = await t.login()
  return {
    tmdb,
    toggle: (tmdbId: number, what: Toggle) =>
      what === 'favourite'
        ? t.post(`/api/collection/${tmdbId}/favourite`, {}, cookie)
        : t.post(`/api/collection/${tmdbId}/status`, { status: what }, cookie),
    async entry(tmdbId: number) {
      const { status, favourite, watchedAt } = await (await t.request(`/api/movies/${tmdbId}`, { cookie })).json()
      return { status, favourite, watchedAt }
    },
    list: (status: string) => t.request(`/api/collection?status=${status}`, { cookie }),
    app: t,
    cookie,
  }
}

const ids = async (res: Response) => (await res.json()).map((m: { tmdbId: number }) => m.tmdbId)

const untracked = { status: null, favourite: false, watchedAt: null }
const toWatch = { status: 'to_watch', favourite: false, watchedAt: null }
const watched = { status: 'watched', favourite: false, watchedAt: DAY1.toISOString() }
const favourite = { ...watched, favourite: true }

// The toggle rules: [entry reached by these toggles, toggled, expected entry]
const rules: [Toggle[], Toggle, object][] = [
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

test.each(rules)('after %j, toggling %s gives %j', async (setup, toggled, expected) => {
  const c = await collection()
  for (const s of setup) expect((await c.toggle(3, s)).status).toBe(200)
  const res = await c.toggle(3, toggled)
  expect(res.status).toBe(200)
  expect(await res.json()).toEqual(expected)
  expect(await c.entry(3)).toEqual(expected)
})

test('an untracked movie is not in the collection', async () => {
  expect(await (await collection()).entry(3)).toEqual(untracked)
})

test('toggling Favourite keeps the Watched date', async () => {
  const c = await collection()
  await c.toggle(3, 'watched')
  vi.setSystemTime(DAY2)
  await c.toggle(3, 'favourite')
  expect(await c.entry(3)).toEqual(favourite)
})

test('To watch lists To watch movies newest added first, from the stored copy', async () => {
  const c = await collection()
  await c.toggle(3, 'to_watch')
  vi.setSystemTime(DAY2)
  await c.toggle(4, 'to_watch')
  await c.toggle(5, 'watched')
  c.tmdb.down = true
  const res = await c.list('to_watch')
  expect(res.status).toBe(200)
  expect(await res.json()).toEqual([
    { tmdbId: 4, title: 'Alien', year: 1979, posterUrl: null },
    { tmdbId: 3, title: 'Heat', year: 1995, posterUrl: 'https://image.tmdb.org/t/p/w185/heat.jpg' },
  ])
})

test('Watched lists watched movies newest Watched date first', async () => {
  const c = await collection()
  await c.toggle(3, 'to_watch')
  await c.toggle(4, 'watched')
  vi.setSystemTime(DAY2)
  await c.toggle(5, 'watched')
  vi.setSystemTime(new Date('2026-01-03T10:00:00Z'))
  await c.toggle(3, 'watched')
  expect(await ids(await c.list('watched'))).toEqual([3, 5, 4])
})

test('a movie moved back from Watched counts as newly added', async () => {
  const c = await collection()
  await c.toggle(3, 'watched')
  await c.toggle(4, 'to_watch')
  vi.setSystemTime(DAY2)
  await c.toggle(3, 'to_watch')
  expect(await ids(await c.list('to_watch'))).toEqual([3, 4])
})

test('untracked movies leave To watch', async () => {
  const c = await collection()
  await c.toggle(3, 'to_watch')
  await c.toggle(3, 'to_watch')
  expect(await (await c.list('to_watch')).json()).toEqual([])
})

test('the collection is filtered by a known status', async () => {
  expect((await (await collection()).list('someday')).status).toBe(400)
})

test.each(['to_watch', 'favourite'] as const)('starting to track with %s returns 404 for an unknown movie', async (what) => {
  expect((await (await collection()).toggle(99, what)).status).toBe(404)
})

test.each(['to_watch', 'favourite'] as const)('starting to track with %s returns 502 when TMDB is down', async (what) => {
  const c = await collection()
  c.tmdb.down = true
  expect((await c.toggle(3, what)).status).toBe(502)
})

test('toggling a tracked movie does not need TMDB', async () => {
  const c = await collection()
  await c.toggle(3, 'to_watch')
  c.tmdb.down = true
  expect((await c.toggle(3, 'watched')).status).toBe(200)
})

test('toggling a status needs a known status', async () => {
  const c = await collection()
  expect((await c.app.post('/api/collection/3/status', { status: 'favourite' }, c.cookie)).status).toBe(400)
})

test('collection routes need a session', async () => {
  const { app: t } = await collection()
  expect((await t.post('/api/collection/3/status', { status: 'to_watch' })).status).toBe(401)
  expect((await t.post('/api/collection/3/favourite', {})).status).toBe(401)
  expect((await t.request('/api/collection?status=to_watch')).status).toBe(401)
})

test('a database failure on a toggle is a 500, not a TMDB error', async () => {
  const c = await collection()
  await c.app.db.run(sql`drop table tracked_movies`)
  const res = await c.toggle(3, 'to_watch')
  expect(res.status).toBe(500)
  expect(await res.json()).toEqual({ error: 'Internal error' })
})
