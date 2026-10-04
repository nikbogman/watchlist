import type { Tmdb } from '../tmdb/tmdb'
import type { Reel, Title } from './schema'

// Free tier on a Google AI Studio key. A small model is enough: the caption or comments usually name the title.
const MODEL = 'gemini-3.1-flash-lite'
const API = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`

const ANSWER = {
  type: 'object',
  properties: {
    found: { type: 'boolean' },
    name: { type: 'string' },
    year: { type: ['integer', 'null'] },
    kind: { type: 'string', enum: ['movie', 'tv'] },
  },
  required: ['found', 'name', 'year', 'kind'],
}
type Answer = Omit<Title, 'tmdbId'> & { found: boolean }

const prompt = (reel: Reel) =>
  [
    'Which movie or TV show is this Instagram reel a clip of or about? Use the caption and the comments.',
    'Answer found: false when they do not make it clear. Give the original release year when you know it.',
    '',
    `Caption: ${reel.description ?? '(none)'}`,
    'Comments, most liked first:',
    ...reel.comments.toSorted((a, b) => b.likes - a.likes).map((c) => `- ${c.text}`),
  ].join('\n')

/** Asks Gemini what the reel shows, then matches a movie to TMDB. Null when the reel doesn't say. */
export function createIdentifier(apiKey: string, tmdb: Tmdb, fetchFn: typeof fetch = fetch) {
  return async (reel: Reel): Promise<Title | null> => {
    const res = await fetchFn(API, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt(reel) }] }],
        generationConfig: { responseMimeType: 'application/json', responseJsonSchema: ANSWER },
      }),
    })
    if (!res.ok) throw new Error(`Gemini failed with ${res.status}: ${await res.text()}`)
    const body = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] }
    const text = body.candidates?.[0]?.content?.parts?.[0]?.text
    if (!text) throw new Error('Gemini returned no answer')
    const { found, name, year, kind } = JSON.parse(text) as Answer
    if (!found || !name) return null

    // ponytail: the Tmdb client only searches movies, so TV shows stay unmatched.
    if (kind === 'tv') return { name, year, kind, tmdbId: null }
    // ponytail: first search result with Gemini's year (any result when it gave none); no fuzzy title match.
    const match = (await tmdb.search(name)).find((m) => year === null || m.year === year)
    return match ? { name: match.title, year: match.year, kind, tmdbId: match.tmdbId } : { name, year, kind, tmdbId: null }
  }
}
