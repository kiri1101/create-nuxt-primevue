import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { checkProject } from '../template/scripts/check-licences.mjs'
import { ensureV5, mainProject, sh, tarball, workRoot } from './helpers.ts'

const doctor = (args: string, cwd: string) => sh(`npx --yes --package "${tarball()}" create-nuxt-primevue doctor ${args}`, cwd)
const GIT = 'git -c user.name=e2e -c user.email=e2e@example.com'

describe('doctor on a project with primevue 5 installed and committed', () => {
  it('--check exits 1 and changes nothing', async () => {
    const dir = await mainProject()
    await ensureV5(dir)
    const before = readFileSync(join(dir, 'package.json'), 'utf8')
    const res = await doctor('--check', dir)
    expect(res.code).toBe(1)
    expect(res.out).toContain('not MIT')
    expect(readFileSync(join(dir, 'package.json'), 'utf8')).toBe(before)
  })

  it('refuses to fix a dirty working tree and leaves package.json unchanged', async () => {
    const dir = await mainProject()
    await ensureV5(dir)
    const before = readFileSync(join(dir, 'package.json'), 'utf8')
    writeFileSync(join(dir, 'stray.txt'), 'uncommitted\n')
    try {
      const res = await doctor('--yes-fix', dir)
      expect(res.code).toBe(1)
      expect(res.out).toContain('uncommitted changes')
      expect(readFileSync(join(dir, 'package.json'), 'utf8')).toBe(before)
    } finally {
      rmSync(join(dir, 'stray.txt'))
    }
  })

  it('--yes-fix on a clean tree pins the free versions, passes the check, and touches only package.json and the lockfile', async () => {
    const dir = await mainProject()
    await ensureV5(dir)
    const res = await doctor('--yes-fix', dir)
    expect(res.code, res.out.slice(-2000)).toBe(0)

    const deps = (JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')) as { dependencies: Record<string, string> }).dependencies
    // Spec 5.7: the last MIT versions.
    expect(deps.primevue).toBe('4.5.5')
    expect(deps['@primevue/nuxt-module']).toBe('4.5.5')
    expect(deps['@primeuix/themes']).toBe('2.0.3')
    expect(deps.primeicons).toBe('7.0.0')
    expect(checkProject(dir).status).toBe('ok')

    // Git prints line-ending warnings on stderr, which `sh` merges in; keep only the file names.
    const changed = (await sh('git diff --name-only', dir)).out
      .split(/\r?\n/)
      .filter((l) => l !== '' && !l.startsWith('warning:'))
      .sort()
    expect(changed).toEqual(['package-lock.json', 'package.json'])
  })
})

describe('doctor in a folder that a parent repository ignores', () => {
  it('refuses, because git could not undo the change, and leaves package.json unchanged', async () => {
    const parent = join(workRoot(), 'parent-repo')
    const child = join(parent, 'child')
    mkdirSync(join(child, 'node_modules', 'primevue'), { recursive: true })
    writeFileSync(join(parent, '.gitignore'), 'child/\n')
    const pkgText = JSON.stringify({ name: 'child', dependencies: { primevue: '5.0.4' } }, null, 2) + '\n'
    writeFileSync(join(child, 'package.json'), pkgText)
    writeFileSync(
      join(child, 'node_modules', 'primevue', 'package.json'),
      JSON.stringify({ name: 'primevue', version: '5.0.4', license: 'SEE LICENSE IN LICENSE.md' }),
    )
    expect((await sh('git init', parent)).code).toBe(0)
    expect((await sh(`git add -A && ${GIT} commit -m parent`, parent)).code).toBe(0)

    // The preconditions that make this the tricky case: clean status, package.json untracked.
    expect((await sh('git status --porcelain', child)).out.trim()).toBe('')
    expect((await sh('git ls-files --error-unmatch package.json', child)).code).not.toBe(0)

    const res = await doctor('--yes-fix', child)
    expect(res.code).toBe(1)
    expect(res.out).toContain('not tracked by git')
    expect(readFileSync(join(child, 'package.json'), 'utf8')).toBe(pkgText)
  })
})
