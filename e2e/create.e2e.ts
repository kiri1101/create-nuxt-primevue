import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ensureBuilt, mainProject, sh } from './helpers.ts'

describe('create, from the packed tarball', () => {
  it('default: creates a project with .gitignore, one commit, no node_modules in git, and a passing build', async () => {
    const dir = await mainProject()
    expect(existsSync(join(dir, 'package.json'))).toBe(true)
    // npm drops .gitignore from published tarballs, so the CLI must write it itself.
    expect(existsSync(join(dir, '.gitignore'))).toBe(true)

    const tracked = await sh('git ls-files', dir)
    expect(tracked.code).toBe(0)
    expect(tracked.out).not.toContain('node_modules')
    expect(tracked.out).toContain('package.json')

    const log = await sh('git log --oneline', dir)
    expect(log.out.trim().split(/\r?\n/)).toHaveLength(1)

    await ensureBuilt(dir)
  })
})
