import { expo } from '@better-auth/expo'
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import type { Db } from './db.js'
import * as schema from './schema.js'

const DAY = 60 * 60 * 24

export function createAuth(db: Db) {
  return betterAuth({
    database: drizzleAdapter(db, { provider: 'sqlite', schema }),
    emailAndPassword: { enabled: true, disableSignUp: true },
    session: { expiresIn: 90 * DAY, updateAge: DAY },
    rateLimit: { enabled: true },
    plugins: [expo()],
    trustedOrigins: ['watcher://', 'exp://', 'exp://**'],
  })
}

export type Auth = ReturnType<typeof createAuth>
