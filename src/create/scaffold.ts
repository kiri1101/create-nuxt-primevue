import { cpSync, existsSync, mkdirSync, readdirSync, statSync } from 'node:fs'
import { basename, relative } from 'node:path'

const SKIP = new Set(['node_modules', '.nuxt', '.output'])

/** Returns an error message when the target exists and is not an empty folder. */
export function ensureEmptyTarget(path: string): string | null {
  if (!existsSync(path)) return null
  if (!statSync(path).isDirectory()) return `${path} already exists and is not a folder.`
  if (readdirSync(path).length > 0) return `${path} already exists and is not empty. Pick another name or empty it first.`
  return null
}

export function copyTemplate(from: string, to: string): void {
  mkdirSync(to, { recursive: true })
  cpSync(from, to, {
    recursive: true,
    filter: (src) => !SKIP.has(basename(src)) && relative(from, src) !== 'package-lock.json',
  })
}
