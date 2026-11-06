import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/** Parses package.json text. A leading byte order mark, which some Windows tools add and npm accepts, is ignored. */
export function parsePackageJson(text: string): unknown {
  return JSON.parse(text.charCodeAt(0) === 0xfeff ? text.slice(1) : text)
}

/** The package.json of a folder as an object, or null when it is missing, invalid, or not an object. */
export function readPackageJson(dir: string): Record<string, unknown> | null {
  try {
    const value = parsePackageJson(readFileSync(join(dir, 'package.json')).toString())
    return value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null
  } catch {
    return null
  }
}
