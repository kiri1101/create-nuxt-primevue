import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { initRepo } from '../src/create/git.ts'

let dir: string
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'git-'))
  writeFileSync(join(dir, '.gitignore'), 'node_modules\n')
})
afterEach(() => rmSync(dir, { recursive: true, force: true }))

// Exit codes are looked up by the first argument, then by the first two.
function fake(codes: Record<string, number>) {
  const calls: string[] = []
  const gitignoreAtAdd: boolean[] = []
  const runner = async (_cmd: string, args: string[]) => {
    const key = args.slice(0, 2).join(' ')
    calls.push(key)
    if (args[0] === 'add') gitignoreAtAdd.push(existsSync(join(dir, '.gitignore')))
    return codes[key] ?? codes[args[0] ?? ''] ?? 0
  }
  return { runner, calls, gitignoreAtAdd }
}

describe('initRepo', () => {
  it('skips when git is missing', async () => {
    const f = fake({ '--version': 1 })
    expect(await initRepo(dir, f.runner)).toBe('skipped')
    expect(f.calls).toEqual(['--version'])
  })
  it('skips inside an existing repository, without init', async () => {
    const f = fake({})
    expect(await initRepo(dir, f.runner)).toBe('skipped')
    expect(f.calls).not.toContain('init')
  })
  it('initialises without committing when the commit fails', async () => {
    const f = fake({ 'rev-parse --is-inside-work-tree': 128, commit: 128 })
    expect(await initRepo(dir, f.runner)).toBe('initialised')
    expect(f.calls).toContain('init')
  })
  it('commits after .gitignore exists', async () => {
    const f = fake({ 'rev-parse --is-inside-work-tree': 128 })
    expect(await initRepo(dir, f.runner)).toBe('committed')
    expect(f.gitignoreAtAdd).toEqual([true])
    expect(f.calls.indexOf('init')).toBeLessThan(f.calls.indexOf('add -A'))
  })
})
