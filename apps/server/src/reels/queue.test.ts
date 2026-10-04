import { describe, expect, test } from 'vitest'
import { testApp } from '../test/test-app.js'
import { runNext, type Reel } from './queue.js'

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
  return { ...t, cookie, enqueue, poll }
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
    const { db, enqueue, poll } = await setup()
    const id = await enqueue()
    expect(await poll(id)).toEqual({ status: 'queued', reel: null, error: null })

    const scraped: string[] = []
    expect(await runNext(db, async (url) => (scraped.push(url), REEL))).toBe(true)

    expect(scraped).toEqual([URL])
    expect(await poll(id)).toEqual({ status: 'done', reel: REEL, error: null })
  })

  test('records why a scrape failed', async () => {
    const { db, enqueue, poll } = await setup()
    const id = await enqueue()

    await runNext(db, async () => {
      throw new Error('Instagram session expired')
    })

    expect(await poll(id)).toEqual({ status: 'failed', reel: null, error: 'Instagram session expired' })
  })

  test('runs jobs oldest first, one per run, and reports an empty queue', async () => {
    const { db, enqueue, poll } = await setup()
    const first = await enqueue('https://www.instagram.com/p/first/')
    const second = await enqueue('https://www.instagram.com/p/second/')

    const scraped: string[] = []
    const scrape = async (url: string) => (scraped.push(url), { ...REEL, url })
    await runNext(db, scrape)
    expect((await poll(second)).status).toBe('queued')
    await runNext(db, scrape)
    expect(await runNext(db, scrape)).toBe(false)

    expect(scraped).toEqual(['https://www.instagram.com/p/first/', 'https://www.instagram.com/p/second/'])
    expect((await poll(first)).status).toBe('done')
  })

  test('404s an unknown scrape', async () => {
    const { request, cookie } = await setup()
    expect((await request('/api/reels/00000000-0000-0000-0000-000000000000', { cookie })).status).toBe(404)
    expect((await request('/api/reels/not-a-uuid', { cookie })).status).toBe(404)
  })
})
