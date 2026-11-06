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

  // bunx runs the #!/usr/bin/env node entry under Node and (as the first CI run showed) does not set a bun user agent,
  // so the user agent is empty or a stale npm one inherited from an outer npm. Other signals must still find bun.
  it.each([
    ['no user agent, run from bunx', undefined, { _: '/home/runner/.bun/bin/bunx' }],
    ['a stale npm user agent, run from bunx', 'npm/10.9.9 node/v22', { _: '/usr/local/bin/bunx' }],
    ['an empty user agent, bun as npm_execpath', '', { npm_execpath: '/home/u/.bun/bin/bun' }],
    ['Windows bun.exe', undefined, { npm_execpath: String.raw`C:\Users\u\.bun\bin\bun.exe` }],
  ] as const)('bun is found from the environment: %s', (_label, ua, env) => {
    expect(detectPackageManager(ua, env)).toEqual({ name: 'bun', major: null })
  })

  it('bun is found from the bunx cache folder the CLI runs from, even with no other sign', () => {
    expect(detectPackageManager(undefined, {}, '/tmp/bunx-1001-create-nuxt-primevue@latest/node_modules/create-nuxt-primevue/dist/cli.js')).toEqual({ name: 'bun', major: null })
    expect(detectPackageManager('npm/10.9.9 node/v22', {}, String.raw`C:\Temp\bunx-0-create-nuxt-primevue\node_modules\x\cli.js`)).toEqual({ name: 'bun', major: null })
  })

  it('an ordinary install path is not mistaken for bunx', () => {
    expect(detectPackageManager(undefined, {}, '/home/u/project/node_modules/create-nuxt-primevue/dist/cli.js')).toEqual({ name: 'npm', major: null })
  })

  it('a pnpm user agent wins over a bun-looking environment', () => {
    expect(detectPackageManager('pnpm/9.1.0 npm/? node/v22', { _: '/x/bunx' })).toEqual({ name: 'pnpm', major: 9 })
  })

  it('a plain npm environment stays npm', () => {
    expect(detectPackageManager('npm/10.9.9 node/v22', { _: '/usr/bin/npx', npm_execpath: '/usr/lib/node_modules/npm/bin/npx-cli.js' })).toEqual({ name: 'npm', major: 10 })
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
