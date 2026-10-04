import { existsSync } from 'node:fs'

// Real environment variables win over the file, so a deploy's own settings are never overridden.
const FILE = new URL('../.env', import.meta.url)
if (existsSync(FILE)) process.loadEnvFile(FILE)

/** The named variables from the environment or .env. Throws naming every one that is unset or empty. */
export function env<const K extends string>(...names: K[]) {
  const missing = names.filter((name) => !process.env[name])
  if (missing.length) throw new Error(`Set ${missing.join(', ')} in the environment or apps/server/.env`)
  return Object.fromEntries(names.map((name) => [name, process.env[name]!])) as Record<K, string>
}
