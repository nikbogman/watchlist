import type { Auth } from './auth'

// Sign-up is disabled, so the one account is written through Better Auth's internal adapter.
export async function seed(auth: Auth, email: string, password: string) {
  const ctx = await auth.$context
  const hash = await ctx.password.hash(password)
  const existing = await ctx.internalAdapter.findUserByEmail(email)

  if (existing) {
    await ctx.internalAdapter.updatePassword(existing.user.id, hash)
    await ctx.internalAdapter.deleteUserSessions(existing.user.id)
    return 'updated'
  }
  if ((await ctx.internalAdapter.countTotalUsers()) > 0) {
    throw new Error(`Another account already exists; refusing to create ${email}`)
  }
  const user = await ctx.internalAdapter.createUser({ email, name: email, emailVerified: true }, { method: 'admin' })
  await ctx.internalAdapter.linkAccount({ userId: user.id, accountId: user.id, providerId: 'credential', password: hash })
  return 'created'
}

if (import.meta.main) {
  const { env } = await import('../env')
  const { SEED_EMAIL, SEED_PASSWORD, DATABASE_URL } = env('SEED_EMAIL', 'SEED_PASSWORD', 'DATABASE_URL', 'BETTER_AUTH_SECRET')
  const { createAuth } = await import('./auth')
  const { createDb } = await import('../db')
  const db = await createDb(DATABASE_URL)
  console.log(`Account ${await seed(createAuth(db), SEED_EMAIL, SEED_PASSWORD)}: ${SEED_EMAIL}`)
}
