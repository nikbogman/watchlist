import { expect, test } from 'vitest'
import type { Tmdb } from '../tmdb/tmdb'
import { createIdentifier } from './identify'
import type { Reel } from './schema'

const REEL: Reel = {
  url: 'https://www.instagram.com/reel/abc/',
  description: 'best ending ever',
  comments: [
    { author: 'a', text: 'what movie?', likes: 1, createdAt: '2026-10-04T00:00:00.000Z' },
    { author: 'b', text: 'Heat (1995), Mann at his best', likes: 40, createdAt: '2026-10-04T00:00:00.000Z' },
  ],
}

const gemini = (answer: object) => {
  const sent: string[] = []
  const fetchFn = (async (_url: string, init: RequestInit) => {
    sent.push(init.body as string)
    return Response.json({ candidates: [{ content: { parts: [{ text: JSON.stringify(answer) }] } }] })
  }) as unknown as typeof fetch
  return { fetchFn, sent }
}

const tmdb: Tmdb = {
  search: async () => [
    { tmdbId: 2, title: 'Heat', year: 1986, posterPath: null },
    { tmdbId: 949, title: 'Heat', year: 1995, posterPath: null },
  ],
  details: async () => null,
}

test('matches a movie to TMDB by year, prompting with the most liked comments first', async () => {
  const { fetchFn, sent } = gemini({ found: true, name: 'Heat', year: 1995, kind: 'movie' })
  expect(await createIdentifier('KEY', tmdb, fetchFn)(REEL)).toEqual({ name: 'Heat', year: 1995, kind: 'movie', tmdbId: 949 })
  const text = JSON.parse(sent[0]!).contents[0].parts[0].text as string
  expect(text.indexOf('Heat (1995)')).toBeLessThan(text.indexOf('what movie?'))
})

test('keeps Gemini’s answer unmatched when no TMDB result has its year', async () => {
  const { fetchFn } = gemini({ found: true, name: 'Heat', year: 2013, kind: 'movie' })
  expect(await createIdentifier('KEY', tmdb, fetchFn)(REEL)).toEqual({ name: 'Heat', year: 2013, kind: 'movie', tmdbId: null })
})

test('throws when Gemini errors, so the scrape job fails', async () => {
  const failing = (async () => new Response('quota exceeded', { status: 429 })) as unknown as typeof fetch
  await expect(createIdentifier('KEY', tmdb, failing)(REEL)).rejects.toThrow('Gemini failed with 429')
})

test('a TV show has no TMDB match', async () => {
  const { fetchFn } = gemini({ found: true, name: 'Severance', year: 2022, kind: 'tv' })
  expect(await createIdentifier('KEY', tmdb, fetchFn)(REEL)).toEqual({ name: 'Severance', year: 2022, kind: 'tv', tmdbId: null })
})

test('null when the reel does not say what it shows', async () => {
  const { fetchFn } = gemini({ found: false, name: '', year: null, kind: 'movie' })
  expect(await createIdentifier('KEY', tmdb, fetchFn)(REEL)).toBeNull()
})
