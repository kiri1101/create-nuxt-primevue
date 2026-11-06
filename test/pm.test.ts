import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { detectPackageManager, packageManagerFor, projectPackageManager } from '../src/pm.ts'

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

describe('packageManagerFor: --pm wins over the user agent', () => {
  it.each([
    ['pnpm', undefined, { name: 'pnpm', major: null }],
    ['bun', 'npm/10.9.9 node/v22', { name: 'bun', major: null }],
    ['npm', 'pnpm/9.1.0 npm/? node/v22', { name: 'npm', major: null }],
    ['pnpm', 'pnpm/9.1.0 npm/? node/v22', { name: 'pnpm', major: 9 }],
    ['yarn', 'yarn/4.5.0 npm/? node/v22', { name: 'yarn', major: 4 }],
    ['yarn', 'yarn/1.22.0 npm/? node/v22', { name: 'yarn', major: 1 }],
    ['yarn', undefined, { name: 'yarn', major: 2 }],
    ['yarn', 'pnpm/9.1.0 npm/? node/v22', { name: 'yarn', major: 2 }],
    ['yarn', 'yarn', { name: 'yarn', major: 2 }],
  ] as const)('--pm %s with user agent %s', (flag, ua, expected) => {
    expect(packageManagerFor(flag, ua)).toEqual(expected)
  })

  it('without --pm it is the user agent', () => {
    expect(packageManagerFor(undefined, 'pnpm/9.1.0 npm/? node/v22')).toEqual({ name: 'pnpm', major: 9 })
    expect(packageManagerFor(undefined, undefined)).toEqual({ name: 'npm', major: null })
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

describe('projectPackageManager: the packageManager field comes before any lockfile', () => {
  let root: string
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'pm-field-'))
  })
  afterEach(() => rmSync(root, { recursive: true, force: true }))
  const pkg = (dir: string, data: object) => {
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, 'package.json'), JSON.stringify(data))
  }

  // A stale yarn.lock beside a current package-lock.json must not win over what the project declares.
  it('reads name and major from the field, over a stale lockfile', () => {
    pkg(root, { packageManager: 'pnpm@9.1.0+sha512.abc' })
    writeFileSync(join(root, 'yarn.lock'), '')
    expect(projectPackageManager(root, undefined)).toEqual({ name: 'pnpm', major: 9 })
  })
  it('reads the field from the workspace root for a member', () => {
    pkg(root, { packageManager: 'yarn@4.5.0', workspaces: ['apps/*'] })
    pkg(join(root, 'apps/web'), { name: 'web' })
    expect(projectPackageManager(join(root, 'apps/web'), 'npm/10.0.0')).toEqual({ name: 'yarn', major: 4 })
  })
  it.each(['deno@1.0.0', 'pnpm', 'pnpm@latest', '', 5])('ignores the unusable value %j and falls back to the lockfile', (value) => {
    pkg(root, { packageManager: value })
    writeFileSync(join(root, 'bun.lock'), '')
    expect(projectPackageManager(root, undefined)).toEqual({ name: 'bun', major: null })
  })
  it('lets the member own lockfile outrank the field on the workspace root', () => {
    pkg(root, { packageManager: 'pnpm@9.1.0', workspaces: ['apps/*'] })
    pkg(join(root, 'apps/web'), { name: 'web' })
    writeFileSync(join(root, 'apps/web/yarn.lock'), '')
    expect(projectPackageManager(join(root, 'apps/web'), 'npm/10.0.0')).toEqual({ name: 'yarn', major: null })
  })
  it('reads a two-digit major', () => {
    pkg(root, { packageManager: 'pnpm@10.2.0' })
    expect(projectPackageManager(root, undefined)).toEqual({ name: 'pnpm', major: 10 })
  })
  it('ignores a field that only mentions a manager after other text', () => {
    pkg(root, { packageManager: 'use pnpm@9.0.0' })
    writeFileSync(join(root, 'bun.lock'), '')
    expect(projectPackageManager(root, undefined).name).toBe('bun')
  })
  it('does not read a package.json that is broken', () => {
    mkdirSync(root, { recursive: true })
    writeFileSync(join(root, 'package.json'), '{ nope')
    writeFileSync(join(root, 'yarn.lock'), '')
    expect(projectPackageManager(root, undefined).name).toBe('yarn')
  })
})
