import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { doctor } from '../src/doctor/index.ts'
import pkg from '../package.json'

let dir: string
let out: string[]
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'doctor-cli-'))
  out = []
  vi.spyOn(console, 'log').mockImplementation((...a: unknown[]) => void out.push(a.join(' ')))
  vi.spyOn(console, 'error').mockImplementation((...a: unknown[]) => void out.push(a.join(' ')))
})
afterEach(() => {
  vi.restoreAllMocks()
  rmSync(dir, { recursive: true, force: true })
})

describe('doctor --version and --help', () => {
  it('--version prints the package version and exits 0, before any project is read', async () => {
    expect(await doctor(['--version'], dir)).toBe(0)
    expect(out).toEqual([pkg.version])
  })
  it.each(['--help', '-h'])('%s prints the usage and exits 0', async (flag) => {
    expect(await doctor([flag], dir)).toBe(0)
    expect(out.join('\n')).toContain('Usage: create-nuxt-primevue doctor')
  })
})
