// Lets apps/mobile typecheck this file through the hc AppType import.
/// <reference types="node" />
import { setTimeout } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core'
import * as schema from './schema'

export const MIGRATIONS = fileURLToPath(new URL('../drizzle', import.meta.url))

// Network failures and Postgres "starting up" (57P03) are worth waiting out; anything else is a real error.
const TRANSIENT = new Set(['ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND', 'EAI_AGAIN', 'ECONNRESET', '57P03'])

export async function createDb(url: string, attempts = 10) {
  const db = drizzle({ connection: url, schema })
  for (let attempt = 1; ; attempt++) {
    try {
      await migrate(db, { migrationsFolder: MIGRATIONS })
      return db
    } catch (e) {
      const { code } = ((e as { cause?: unknown }).cause ?? e) as { code?: string }
      if (!code || !TRANSIENT.has(code)) throw e
      if (attempt === attempts) throw new Error(`Database unreachable after ${attempts} attempts (${code})`, { cause: e })
      const delay = Math.min(1000 * 2 ** (attempt - 1), 15_000)
      console.warn(`Database unreachable (${code}), retrying in ${delay / 1000}s [${attempt}/${attempts}]`)
      await setTimeout(delay)
    }
  }
}

export type Db = PgDatabase<PgQueryResultHKT, typeof schema>
