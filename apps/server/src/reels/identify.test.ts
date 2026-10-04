import { describe, expect, test } from 'vitest'
import type { Tmdb } from '../tmdb/tmdb'
import { createIdentifier, identifyInBatches, type Identify } from './identify'
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

const comments = (n: number) => Array.from({ length: n }, (_, i) => ({ ...REEL.comments[0]!, text: `c${i}` }))

describe('identifyInBatches', () => {
  const HEAT = { name: 'Heat', year: 1995, kind: 'movie' as const, tmdbId: 949 }
  /** Finds the title once it sees comment `answerAt`; records each batch it was asked about. */
  const fake = (answerAt?: number) => {
    const asked: string[][] = []
    const identify: Identify = async (reel) => {
      asked.push(reel.comments.map((c) => c.text))
      return reel.comments.some((c) => c.text === `c${answerAt}`) ? HEAT : null
    }
    return { identify, asked }
  }

  test('asks about each full batch of new comments and stops at the one that names the title', async () => {
    const { identify, asked } = fake(25)
    const batches = identifyInBatches(identify, 20)

    expect(await batches.until({ ...REEL, comments: comments(15) }, false)).toBe(false)
    expect(asked).toEqual([])
    expect(await batches.until({ ...REEL, comments: comments(30) }, false)).toBe(false)
    expect(await batches.until({ ...REEL, comments: comments(45) }, false)).toBe(true)

    expect(asked.map((b) => [b[0], b.length])).toEqual([
      ['c0', 20],
      ['c20', 20],
    ])
    expect(batches.title()).toEqual(HEAT)
  })

  test('asks about the leftover comments when the scrape ends', async () => {
    const { identify, asked } = fake()
    const batches = identifyInBatches(identify, 20)
    await batches.until({ ...REEL, comments: comments(25) }, false)
    await batches.until({ ...REEL, comments: comments(25) }, true)

    expect(asked.map((b) => b.length)).toEqual([20, 5])
    expect(batches.title()).toBeNull()
  })

  test('asks once, on the caption alone, about a reel with no comments', async () => {
    const { identify, asked } = fake()
    await identifyInBatches(identify).until({ ...REEL, comments: [] }, true)
    expect(asked).toEqual([[]])
  })

  test('does not ask again when the comments end on a full batch', async () => {
    const { identify, asked } = fake()
    const batches = identifyInBatches(identify, 20)
    await batches.until({ ...REEL, comments: comments(20) }, false)
    await batches.until({ ...REEL, comments: comments(20) }, true)
    expect(asked).toHaveLength(1)
  })
})
