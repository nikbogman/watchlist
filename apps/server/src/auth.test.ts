import { beforeEach, expect, test } from 'vitest'
import { createAuth } from './auth.js'
import { seed } from './seed.js'
import { EMAIL, PASSWORD, testApp } from './test-app.js'

let t: Awaited<ReturnType<typeof testApp>>

beforeEach(async () => {
  t = await testApp()
  // Stand-in for any non-auth route; the middleware must guard it without the route opting in.
  t.app.get('/api/probe', (c) => c.text('ok'))
})

const probe = (cookie?: string) => t.request('/api/probe', { cookie })

test('non-auth routes need a session', async () => {
  expect((await probe()).status).toBe(401)
  expect((await probe(await t.login())).status).toBe(200)
})

test('wrong password is rejected', async () => {
  const res = await t.post('/api/auth/sign-in/email', { email: EMAIL, password: 'nope' })
  expect(res.status).toBe(401)
})

test('repeated failed logins are rate-limited', async () => {
  const statuses = []
  for (let i = 0; i < 5; i++) statuses.push((await t.post('/api/auth/sign-in/email', { email: EMAIL, password: 'nope' })).status)
  expect(statuses).toContain(429)
})

test('sign-up is rejected', async () => {
  const res = await t.post('/api/auth/sign-up/email', { email: 'x@example.com', password: 'whatever123', name: 'x' })
  expect(res.ok).toBe(false)
  expect((await t.post('/api/auth/sign-in/email', { email: 'x@example.com', password: 'whatever123' })).ok).toBe(false)
})

test('logout ends the session on the server', async () => {
  const cookie = await t.login()
  expect((await t.post('/api/auth/sign-out', {}, cookie)).status).toBe(200)
  expect((await probe(cookie)).status).toBe(401)
})

test('re-seeding changes the password and ends old sessions', async () => {
  const cookie = await t.login()
  await seed(createAuth(t.db), EMAIL, 'a new password!')
  expect((await probe(cookie)).status).toBe(401)
  expect((await t.post('/api/auth/sign-in/email', { email: EMAIL, password: PASSWORD })).status).toBe(401)
  await t.login('a new password!')
})

test('seed refuses a second account', async () => {
  await expect(seed(createAuth(t.db), 'other@example.com', PASSWORD)).rejects.toThrow()
  expect((await t.post('/api/auth/sign-in/email', { email: 'other@example.com', password: PASSWORD })).ok).toBe(false)
})
