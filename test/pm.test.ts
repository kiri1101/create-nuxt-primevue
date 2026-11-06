import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { detectPackageManager, projectPackageManager } from '../src/pm.ts'

describe('detectPackageManager', () => {
  it.each([
    ['pnpm/9.1.0 npm/? node/v22', 'pnpm', 9],
    ['yarn/4.5.0 npm/? node/v22', 'yarn', 4],
    ['bun/1.1.0', 'bun', 1],
    ['npm/10.8.0 node/v22', 'npm', 10],
    [undefined, 'npm', null],
  ] as const)('%s', (ua, name, major) => {
    expect(detectPackageManager(ua)).toEqual({ name, major })
  })
})

describe('projectPackageManager: the lockfile says which manager a project uses', () => {
  let root: string
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'pm-'))
  })
  afterEach(() => rmSync(root, { recursive: true, force: true }))
  const touch = (...parts: string[]) => {
    mkdirSync(join(root, ...parts, '..'), { recursive: true })
    writeFileSync(join(root, ...parts), '')
  }
  const member = () => join(root, 'apps/web')

  it.each([
    ['pnpm-lock.yaml', 'pnpm'],
    ['yarn.lock', 'yarn'],
    ['bun.lock', 'bun'],
    ['bun.lockb', 'bun'],
    ['package-lock.json', 'npm'],
  ] as const)('%s means %s', (file, name) => {
    touch('app', file)
    expect(projectPackageManager(join(root, 'app'), 'npm/10.0.0')).toEqual({ name, major: null })
  })

  // A workspace member has no lockfile of its own: it lives at the workspace root.
  it('finds the lockfile at the workspace root for a member', () => {
    touch('pnpm-workspace.yaml')
    touch('pnpm-lock.yaml')
    mkdirSync(member(), { recursive: true })
    expect(projectPackageManager(member(), 'npm/10.0.0')).toEqual({ name: 'pnpm', major: null })
  })

  it('prefers the project own lockfile over the root one', () => {
    touch('pnpm-workspace.yaml')
    touch('pnpm-lock.yaml')
    touch('apps/web/yarn.lock')
    expect(projectPackageManager(member(), 'npm/10.0.0').name).toBe('yarn')
  })

  it('falls back to the manager that ran the command when there is no lockfile anywhere', () => {
    mkdirSync(member(), { recursive: true })
    expect(projectPackageManager(member(), 'bun/1.1.0')).toEqual({ name: 'bun', major: 1 })
  })
})
