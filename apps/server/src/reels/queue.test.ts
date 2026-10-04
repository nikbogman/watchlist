import { describe, expect, test } from 'vitest'
import { testApp } from '../test/test-app'
import type { Reel } from './schema'
import { createReelQueue } from './queue'

const URL = 'https://www.instagram.com/reel/DNBbfSkMPuy/'
const REEL: Reel = {
  url: URL,
  description: 'Son of the White Mare',
  comments: [{ author: 'someone', text: 'what movie is this?', likes: 3, createdAt: '2026-10-04T00:00:00.000Z' }],
}

async function setup() {
  const t = await testApp()
  const cookie = await t.login()
  const enqueue = async (url = URL) => (await (await t.post('/api/reels', { url }, cookie)).json()).id as string
  const poll = async (id: string) => (await t.request(`/api/reels/${id}`, { cookie })).json()
  const { runNext } = createReelQueue(t.db)
  return { ...t, cookie, enqueue, poll, runNext }
}

describe('reel scrape queue', () => {
  test('needs a session', async () => {
    const { post, request } = await setup()
    expect((await post('/api/reels', { url: URL })).status).toBe(401)
    expect((await request('/api/reels/00000000-0000-0000-0000-000000000000')).status).toBe(401)
  })

  test('rejects a URL that is not an Instagram reel or post', async () => {
    const { post, cookie } = await setup()
    for (const url of ['https://www.instagram.com/nasa/', 'https://example.com/reel/abc123/', 42]) {
      expect((await post('/api/reels', { url }, cookie)).status).toBe(400)
    }
  })

  test('queues a reel, then a worker run stores its scrape', async () => {
    const { runNext, enqueue, poll } = await setup()
    const id = await enqueue()
    expect(await poll(id)).toEqual({ status: 'queued', reel: null, error: null })

    const scraped: string[] = []
    expect(await runNext(async (url) => (scraped.push(url), REEL))).toBe(true)

    // Stored as the /p/ link, the one the scraper opens.
    expect(scraped).toEqual(['https://www.instagram.com/p/DNBbfSkMPuy/'])
    expect(await poll(id)).toEqual({ status: 'done', reel: REEL, error: null })
  })

  test('records why a scrape failed', async () => {
    const { runNext, enqueue, poll } = await setup()
    const id = await enqueue()

    await runNext(async () => {
      throw new Error('Instagram session expired')
    })

    expect(await poll(id)).toEqual({ status: 'failed', reel: null, error: 'Instagram session expired' })
  })

  test('runs jobs oldest first, one per run, and reports an empty queue', async () => {
    const { runNext, enqueue, poll } = await setup()
    const first = await enqueue('https://www.instagram.com/p/first/')
    const second = await enqueue('https://www.instagram.com/p/second/')

    const scraped: string[] = []
    const scrape = async (url: string) => (scraped.push(url), { ...REEL, url })
    await runNext(scrape)
    expect((await poll(second)).status).toBe('queued')
    await runNext(scrape)
    expect(await runNext(scrape)).toBe(false)

    expect(scraped).toEqual(['https://www.instagram.com/p/first/', 'https://www.instagram.com/p/second/'])
    expect((await poll(first)).status).toBe('done')
  })

  test('lists every request newest first, with its title once identified', async () => {
    const { runNext, enqueue, request, cookie } = await setup()
    const first = await enqueue('https://www.instagram.com/p/first/')
    await runNext(async (url) => ({ ...REEL, url, title: { name: 'Heat', year: 1995, kind: 'movie', tmdbId: 949 } }))
    const second = await enqueue('https://www.instagram.com/p/second/')

    const list = await (await request('/api/reels', { cookie })).json()

    expect(list).toMatchObject([
      { id: second, url: 'https://www.instagram.com/p/second/', status: 'queued', title: null, error: null },
      { id: first, status: 'done', title: { name: 'Heat', year: 1995, kind: 'movie', tmdbId: 949 } },
    ])
    expect(list[0].createdAt).toEqual(expect.any(String))
    expect(list[1]).not.toHaveProperty('reel')
  })

  test('sharing the same reel again returns its request, moved to the top', async () => {
    const { enqueue, request, cookie } = await setup()
    const id = await enqueue('https://www.instagram.com/reel/DNBbfSkMPuy/?igsh=abc')
    await enqueue('https://www.instagram.com/p/other/')
    expect(await enqueue('https://www.instagram.com/p/DNBbfSkMPuy/')).toBe(id)

    const list = await (await request('/api/reels', { cookie })).json()
    expect(list.map((r: { id: string }) => r.id)[0]).toBe(id)
    expect(list).toHaveLength(2)
  })

  test('sharing a failed reel again re-queues it', async () => {
    const { runNext, enqueue, poll } = await setup()
    const id = await enqueue()
    await runNext(async () => {
      throw new Error('boom')
    })

    expect(await enqueue()).toBe(id)
    expect(await poll(id)).toEqual({ status: 'queued', reel: null, error: null })
  })

  test('retries a failed request, and only a failed one', async () => {
    const { runNext, enqueue, poll, post, cookie } = await setup()
    const id = await enqueue()
    expect((await post(`/api/reels/${id}/retry`, {}, cookie)).status).toBe(404)

    await runNext(async () => {
      throw new Error('boom')
    })
    expect((await post(`/api/reels/${id}/retry`, {}, cookie)).status).toBe(202)
    expect(await poll(id)).toEqual({ status: 'queued', reel: null, error: null })
    expect((await post('/api/reels/not-a-uuid/retry', {}, cookie)).status).toBe(404)
  })

  test('404s an unknown scrape', async () => {
    const { request, cookie } = await setup()
    expect((await request('/api/reels/00000000-0000-0000-0000-000000000000', { cookie })).status).toBe(404)
    expect((await request('/api/reels/not-a-uuid', { cookie })).status).toBe(404)
  })
})
