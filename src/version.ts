import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

/** This package's own version. From src/ or dist/, the package root is one level up. */
export function packageVersion(): string {
  const file = fileURLToPath(new URL('../package.json', import.meta.url))
  return (JSON.parse(readFileSync(file, 'utf8')) as { version: string }).version
}
