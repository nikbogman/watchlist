import { beforeEach, expect, test } from 'vitest'
import { createApp } from './app.js'
import { createAuth } from './auth.js'
import { createDb, type Db } from './db.js'
import { seed } from './seed.js'

const EMAIL = 'me@example.com'
const PASSWORD = 'correct horse battery'

let db: Db
let app: ReturnType<typeof createApp>
let ip = 0

beforeEach(async () => {
  ip++ // the rate limiter keys on client IP
  db = await createDb(':memory:')
  app = createApp(db)
  // Stand-in for any non-auth route; the middleware must guard it without the route opting in.
  app.get('/api/probe', (c) => c.text('ok'))
  await seed(createAuth(db), EMAIL, PASSWORD)
})

const post = (path: string, body: unknown, cookie?: string) =>
  app.request(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': `10.0.0.${ip}`, ...(cookie && { cookie }) },
    body: JSON.stringify(body),
  })

async function login(password = PASSWORD) {
  const res = await post('/api/auth/sign-in/email', { email: EMAIL, password })
  expect(res.status).toBe(200)
  return res.headers.get('set-cookie')!.split(';')[0]
}

const probe = (cookie?: string) => app.request('/api/probe', { headers: cookie ? { cookie } : {} })

test('non-auth routes need a session', async () => {
  expect((await probe()).status).toBe(401)
  expect((await probe(await login())).status).toBe(200)
})

test('wrong password is rejected', async () => {
  const res = await post('/api/auth/sign-in/email', { email: EMAIL, password: 'nope' })
  expect(res.status).toBe(401)
})

test('repeated failed logins are rate-limited', async () => {
  const statuses = []
  for (let i = 0; i < 5; i++) statuses.push((await post('/api/auth/sign-in/email', { email: EMAIL, password: 'nope' })).status)
  expect(statuses).toContain(429)
})

test('sign-up is rejected', async () => {
  const res = await post('/api/auth/sign-up/email', { email: 'x@example.com', password: 'whatever123', name: 'x' })
  expect(res.ok).toBe(false)
  expect((await post('/api/auth/sign-in/email', { email: 'x@example.com', password: 'whatever123' })).ok).toBe(false)
})

test('logout ends the session on the server', async () => {
  const cookie = await login()
  expect((await post('/api/auth/sign-out', {}, cookie)).status).toBe(200)
  expect((await probe(cookie)).status).toBe(401)
})

test('re-seeding changes the password and ends old sessions', async () => {
  const cookie = await login()
  await seed(createAuth(db), EMAIL, 'a new password!')
  expect((await probe(cookie)).status).toBe(401)
  expect((await post('/api/auth/sign-in/email', { email: EMAIL, password: PASSWORD })).status).toBe(401)
  await login('a new password!')
})

test('seed refuses a second account', async () => {
  await expect(seed(createAuth(db), 'other@example.com', PASSWORD)).rejects.toThrow()
  expect((await post('/api/auth/sign-in/email', { email: 'other@example.com', password: PASSWORD })).ok).toBe(false)
})
