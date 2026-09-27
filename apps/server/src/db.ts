// Lets apps/mobile typecheck this file through the hc AppType import.
/// <reference types="node" />
import { fileURLToPath } from 'node:url'
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core'
import * as schema from './schema/index.js'

export const MIGRATIONS = fileURLToPath(new URL('../drizzle', import.meta.url))

export async function createDb(url: string) {
  const db = drizzle({ connection: url, schema })
  await migrate(db, { migrationsFolder: MIGRATIONS })
  return db
}

export type Db = PgDatabase<PgQueryResultHKT, typeof schema>
