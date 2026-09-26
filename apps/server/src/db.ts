// Lets apps/mobile typecheck this file through the hc AppType import.
/// <reference types="node" />
import { fileURLToPath } from 'node:url'
import { createClient } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import { migrate } from 'drizzle-orm/libsql/migrator'
import * as schema from './schema/index.js'

export async function createDb(url: string) {
  const db = drizzle(createClient({ url }), { schema })
  await migrate(db, { migrationsFolder: fileURLToPath(new URL('../drizzle', import.meta.url)) })
  return db
}

export type Db = Awaited<ReturnType<typeof createDb>>
