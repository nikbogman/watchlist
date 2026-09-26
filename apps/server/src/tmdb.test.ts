import { expect, test } from 'vitest'
import { createTmdbClient } from './tmdb.js'

const stubFetch = (body: unknown, status = 200) =>
  (async (url: string) => {
    stubFetch.lastUrl = url
    return new Response(JSON.stringify(body), { status })
  }) as unknown as typeof fetch
stubFetch.lastUrl = ''

test('search maps TMDB results, dropping adult titles', async () => {
  const tmdb = createTmdbClient(
    'KEY',
    stubFetch({
      results: [
        { id: 1, title: 'Heat', release_date: '1995-12-15', poster_path: '/heat.jpg', adult: false },
        { id: 2, title: 'Unknown', release_date: '', poster_path: null, adult: false },
        { id: 3, title: 'Adult', release_date: '2000-01-01', poster_path: null, adult: true },
      ],
    }),
  )
  expect(await tmdb.search('heat')).toEqual([
    { tmdbId: 1, title: 'Heat', year: 1995, posterUrl: 'https://image.tmdb.org/t/p/w185/heat.jpg' },
    { tmdbId: 2, title: 'Unknown', year: null, posterUrl: null },
  ])
  expect(stubFetch.lastUrl).toContain('include_adult=false')
  expect(stubFetch.lastUrl).toContain('api_key=KEY')
})

test('search throws when TMDB errors', async () => {
  await expect(createTmdbClient('KEY', stubFetch({}, 500)).search('heat')).rejects.toThrow()
})

test('details maps a TMDB movie with a w500 poster', async () => {
  const tmdb = createTmdbClient(
    'KEY',
    stubFetch({ id: 1, title: 'Heat', release_date: '1995-12-15', poster_path: '/heat.jpg', overview: 'A heist.' }),
  )
  expect(await tmdb.details(1)).toEqual({
    tmdbId: 1,
    title: 'Heat',
    year: 1995,
    posterUrl: 'https://image.tmdb.org/t/p/w500/heat.jpg',
    overview: 'A heist.',
  })
  expect(stubFetch.lastUrl).toContain('/movie/1?')
})

test('details returns null for an id TMDB does not know', async () => {
  expect(await createTmdbClient('KEY', stubFetch({}, 404)).details(1)).toBeNull()
})

test('details throws when TMDB errors', async () => {
  await expect(createTmdbClient('KEY', stubFetch({}, 500)).details(1)).rejects.toThrow()
})
