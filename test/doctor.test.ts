import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { doctor } from '../src/doctor/index.ts'

let dir: string
let out: string[]
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'doctor-'))
  out = []
  const capture = (...args: unknown[]) => void out.push(args.join(' '))
  vi.spyOn(console, 'log').mockImplementation(capture)
  vi.spyOn(console, 'error').mockImplementation(capture)
})
afterEach(() => {
  vi.restoreAllMocks()
  rmSync(dir, { recursive: true, force: true })
})

function project(deps: Record<string, string>) {
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'app', dependencies: deps }))
}
function installed(name: string, license: string) {
  const d = join(dir, 'node_modules', ...name.split('/'))
  mkdirSync(d, { recursive: true })
  writeFileSync(join(d, 'package.json'), JSON.stringify({ name, version: '1.0.0', license }))
}

describe('doctor --check', () => {
  it('exits 0 when every Prime package is MIT', async () => {
    project({ primevue: '4.5.5' })
    installed('primevue', 'MIT')
    expect(await doctor(['--check'], dir)).toBe(0)
  })
  it('exits 1 when a Prime package is not MIT', async () => {
    project({ primevue: '5.0.4' })
    installed('primevue', 'SEE LICENSE IN LICENSE')
    expect(await doctor(['--check'], dir)).toBe(1)
  })
  it('exits 1 when Prime packages are declared but nothing is installed', async () => {
    project({ primevue: '4.5.5' })
    expect(await doctor(['--check'], dir)).toBe(1)
  })
  it('exits 0 and says so when there are no Prime packages at all', async () => {
    project({ vue: '^3.5.0' })
    expect(await doctor(['--check'], dir)).toBe(0)
    expect(out.join('\n')).toContain('No Prime packages')
  })
  it('exits 2 without a package.json', async () => {
    expect(await doctor(['--check'], dir)).toBe(2)
  })
})
