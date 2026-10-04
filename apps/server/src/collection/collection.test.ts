import { sql } from 'drizzle-orm'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { PAGE_SIZE, type Status } from './collection.js'
import { collectionEntry } from '../schema/index.js'
import { fakeTmdb, testApp } from '../test/test-app.js'

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

/** A change to one movie's entry: set its Status (null drops it) or its Favourite. */
type Change = { status: Status | null } | { favourite: boolean }

async function collection(tmdb = fakeTmdb([heat, alien, ran])) {
  const t = await testApp(tmdb)
  const cookie = await t.login()
  const put = (path: string, body: unknown, auth = cookie) =>
    t.request(path, { method: 'PUT', cookie: auth, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
  return {
    tmdb,
    put,
    set: (tmdbId: number, change: Change) => put(`/api/collection/${tmdbId}/${'status' in change ? 'status' : 'favourite'}`, change),
    async entry(tmdbId: number) {
      const { status, favourite, watchedAt } = await (await t.request(`/api/movies/${tmdbId}`, { cookie })).json()
      return { status, favourite, watchedAt }
    },
    list: (status: string, query = '') => t.request(`/api/collection?status=${status}${query}`, { cookie }),
    app: t,
    cookie,
    favourites: () => t.request('/api/collection?favourite=true', { cookie }),
  }
}

const ids = async (res: Response) => (await res.json()).movies.map((m: { tmdbId: number }) => m.tmdbId)

const notInCollection = { status: null, favourite: false, watchedAt: null }
const toWatch = { status: 'to_watch', favourite: false, watchedAt: null }
const watched = { status: 'watched', favourite: false, watchedAt: DAY1.toISOString() }
const favourite = { ...watched, favourite: true }

const TO_WATCH = { status: 'to_watch' } as const
const WATCHED = { status: 'watched' } as const
const DROP = { status: null }
const FAVOURITE = { favourite: true }
const UNFAVOURITE = { favourite: false }

// [entry reached by these changes, change, expected entry]
const rules: [Change[], Change, object][] = [
  [[], TO_WATCH, toWatch],
  [[], WATCHED, watched],
  [[], DROP, notInCollection],
  [[], FAVOURITE, favourite],
  [[], UNFAVOURITE, notInCollection],
  [[TO_WATCH], TO_WATCH, toWatch],
  [[TO_WATCH], WATCHED, watched],
  [[TO_WATCH], DROP, notInCollection],
  [[TO_WATCH], FAVOURITE, favourite],
  [[TO_WATCH], UNFAVOURITE, toWatch],
  [[WATCHED], TO_WATCH, toWatch],
  [[WATCHED], WATCHED, watched],
  [[WATCHED], DROP, notInCollection],
  [[WATCHED], FAVOURITE, favourite],
  [[WATCHED], UNFAVOURITE, watched],
  [[FAVOURITE], TO_WATCH, toWatch],
  [[FAVOURITE], WATCHED, favourite],
  [[FAVOURITE], DROP, notInCollection],
  [[FAVOURITE], FAVOURITE, favourite],
  [[FAVOURITE], UNFAVOURITE, watched],
]

test.each(rules)('after %j, setting %j gives %j', async (setup, change, expected) => {
  const c = await collection()
  for (const s of setup) expect((await c.set(3, s)).status).toBe(200)
  const res = await c.set(3, change)
  expect(res.status).toBe(200)
  expect(await res.json()).toEqual(expected)
  expect(await c.entry(3)).toEqual(expected)
})

test('a movie not in the collection has an empty entry', async () => {
  expect(await (await collection()).entry(3)).toEqual(notInCollection)
})

test.each([WATCHED, FAVOURITE, UNFAVOURITE])('setting %j on a watched movie keeps the Watched date', async (change) => {
  const c = await collection()
  await c.set(3, WATCHED)
  vi.setSystemTime(DAY2)
  await c.set(3, change)
  expect((await c.entry(3)).watchedAt).toBe(DAY1.toISOString())
})

test('To watch lists To watch movies newest added first, from the stored copy', async () => {
  const c = await collection()
  await c.set(3, TO_WATCH)
  vi.setSystemTime(DAY2)
  await c.set(4, TO_WATCH)
  await c.set(5, WATCHED)
  c.tmdb.down = true
  const res = await c.list('to_watch')
  expect(res.status).toBe(200)
  expect(await res.json()).toEqual({
    movies: [
      { tmdbId: 4, title: 'Alien', year: 1979, posterUrl: null },
      { tmdbId: 3, title: 'Heat', year: 1995, posterUrl: 'https://image.tmdb.org/t/p/w185/heat.jpg' },
    ],
    total: 2,
    matching: 2,
    nextOffset: null,
  })
})

test('Watched lists watched movies newest Watched date first', async () => {
  const c = await collection()
  await c.set(3, TO_WATCH)
  await c.set(4, WATCHED)
  vi.setSystemTime(DAY2)
  await c.set(5, WATCHED)
  vi.setSystemTime(new Date('2026-01-03T10:00:00Z'))
  await c.set(3, WATCHED)
  expect(await ids(await c.list('watched'))).toEqual([3, 5, 4])
})

test('Favourites lists favourites newest Watched date first, from the stored copy', async () => {
  const c = await collection()
  await c.set(3, WATCHED)
  vi.setSystemTime(DAY2)
  await c.set(4, FAVOURITE)
  vi.setSystemTime(new Date('2026-01-03T10:00:00Z'))
  await c.set(5, FAVOURITE)
  await c.set(3, FAVOURITE)
  c.tmdb.down = true
  const res = await c.favourites()
  expect(res.status).toBe(200)
  expect(await ids(res)).toEqual([5, 4, 3])
})

test.each([UNFAVOURITE, TO_WATCH, DROP])('setting %j takes a movie off Favourites', async (change) => {
  const c = await collection()
  await c.set(3, FAVOURITE)
  await c.set(3, change)
  expect(await ids(await c.favourites())).toEqual([])
})

test('a movie moved back from Watched counts as newly added', async () => {
  const c = await collection()
  await c.set(3, WATCHED)
  await c.set(4, TO_WATCH)
  vi.setSystemTime(DAY2)
  await c.set(3, TO_WATCH)
  expect(await ids(await c.list('to_watch'))).toEqual([3, 4])
})

test('dropped movies leave To watch', async () => {
  const c = await collection()
  await c.set(3, TO_WATCH)
  await c.set(3, DROP)
  expect(await ids(await c.list('to_watch'))).toEqual([])
})

test('lists come in pages that pick up where the last one ended', async () => {
  const c = await collection()
  const count = PAGE_SIZE + 5
  await c.app.db.insert(collectionEntry).values(
    Array.from({ length: count }, (_, i) => ({
      tmdbId: 100 + i,
      title: `Movie ${i}`,
      status: 'to_watch' as const,
      // Every other pair shares a date, so pages rely on the tie-break.
      addedAt: new Date(DAY1.getTime() + Math.floor(i / 2) * 1000),
      favourite: false,
    })),
  )
  const first = await (await c.list('to_watch')).json()
  expect(first).toMatchObject({ total: count, matching: count, nextOffset: PAGE_SIZE })
  expect(first.movies).toHaveLength(PAGE_SIZE)
  const rest = await (await c.list('to_watch', `&offset=${first.nextOffset}`)).json()
  expect(rest).toMatchObject({ total: count, nextOffset: null })
  const seen = [...first.movies, ...rest.movies].map((m: { tmdbId: number }) => m.tmdbId)
  expect(new Set(seen).size).toBe(count)
})

test('order=oldest lists oldest first', async () => {
  const c = await collection()
  await c.set(3, TO_WATCH)
  vi.setSystemTime(DAY2)
  await c.set(4, TO_WATCH)
  expect(await ids(await c.list('to_watch', '&order=oldest'))).toEqual([3, 4])
})

test('title keeps titles containing it, and counts both the matches and the whole list', async () => {
  const c = await collection()
  await c.set(3, TO_WATCH)
  await c.set(4, TO_WATCH)
  await c.set(5, TO_WATCH)
  const res = await (await c.list('to_watch', '&title=%20aLi%20')).json()
  expect(res).toMatchObject({ total: 3, matching: 1, nextOffset: null })
  expect(res.movies.map((m: { tmdbId: number }) => m.tmdbId)).toEqual([4])
  expect(await ids(await c.list('to_watch', '&title=%25'))).toEqual([])
})

test.each(['order=sideways', 'offset=-1', 'offset=two'])('the page needs a valid query, not %j', async (query) => {
  expect((await (await collection()).list('to_watch', `&${query}`)).status).toBe(400)
})

test.each(['status=someday', 'favourite=false', 'favourite=true&status=watched', ''])(
  'the collection needs a known filter, not %j',
  async (query) => {
    const c = await collection()
    expect((await c.app.request(`/api/collection?${query}`, { cookie: c.cookie })).status).toBe(400)
  },
)

test.each([TO_WATCH, FAVOURITE])('creating an entry with %j returns 404 for an unknown movie', async (change) => {
  expect((await (await collection()).set(99, change)).status).toBe(404)
})

test.each([TO_WATCH, FAVOURITE])('creating an entry with %j returns 502 when TMDB is down', async (change) => {
  const c = await collection()
  c.tmdb.down = true
  expect((await c.set(3, change)).status).toBe(502)
})

test('changing an existing entry does not need TMDB', async () => {
  const c = await collection()
  await c.set(3, TO_WATCH)
  c.tmdb.down = true
  expect((await c.set(3, WATCHED)).status).toBe(200)
})

test.each([DROP, UNFAVOURITE])('setting %j on a movie not in the collection does not need TMDB', async (change) => {
  const c = await collection()
  c.tmdb.down = true
  expect((await c.set(99, change)).status).toBe(200)
})

test.each([
  ['status', { status: 'favourite' }],
  ['status', {}],
  ['favourite', { favourite: 'yes' }],
  ['favourite', {}],
])('setting %s needs a valid body, not %j', async (field, body) => {
  expect((await (await collection()).put(`/api/collection/3/${field}`, body)).status).toBe(400)
})

test('collection routes need a session', async () => {
  const c = await collection()
  expect((await c.put('/api/collection/3/status', TO_WATCH, '')).status).toBe(401)
  expect((await c.put('/api/collection/3/favourite', FAVOURITE, '')).status).toBe(401)
  expect((await c.app.request('/api/collection?status=to_watch')).status).toBe(401)
})

test('a database failure on a change is a 500, not a TMDB error', async () => {
  const c = await collection()
  await c.app.db.execute(sql`drop table collection_entry`)
  const res = await c.set(3, TO_WATCH)
  expect(res.status).toBe(500)
  expect(await res.json()).toEqual({ error: 'Internal error' })
})
