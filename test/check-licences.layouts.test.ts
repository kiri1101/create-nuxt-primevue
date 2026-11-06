import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  checkProject,
  declaredPrimePackages,
  requiredPrimePackages,
  workspaceRoot,
} from '../template/scripts/check-licences.mjs'

// Layouts a real project can have: workspaces (hoisting to the root), pnpm links into a store, linked
// packages that carry their own node_modules. Expected results are worked out by hand from how Node
// resolves a package, not from running the guard.
let root: string
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'layouts-'))
})
afterEach(() => rmSync(root, { recursive: true, force: true }))

function write(dir: string, data: unknown) {
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'package.json'), typeof data === 'string' ? data : JSON.stringify(data))
}
const pkg = (dir: string, name: string, license: unknown, version = '4.5.5') => write(dir, { name, version, license })
const link = (target: string, path: string) => {
  mkdirSync(join(path, '..'), { recursive: true })
  symlinkSync(target, path, 'junction')
}
const names = (r: { installed: { name: string }[] }) => r.installed.map((p) => p.name).sort()

describe('npm and Yarn workspaces: packages hoisted to the workspace root', () => {
  const member = () => join(root, 'apps/web')
  beforeEach(() => {
    write(root, { name: 'ws', private: true, workspaces: ['apps/*'] })
    write(member(), { name: 'web', dependencies: { primevue: '4.5.5', primeicons: '7.0.0' } })
  })

  it('passes when every Prime package is MIT and installed only at the root', () => {
    pkg(join(root, 'node_modules/primevue'), 'primevue', 'MIT')
    pkg(join(root, 'node_modules/primeicons'), 'primeicons', 'MIT', '7.0.0')
    const r = checkProject(member())
    expect(r.status).toBe('ok')
    expect(names(r)).toEqual(['primeicons', 'primevue'])
  })

  it('fails when primevue 5 is hoisted to the root and one MIT Prime package is local', () => {
    pkg(join(root, 'node_modules/primevue'), 'primevue', 'SEE LICENSE IN LICENSE.md', '5.0.4')
    pkg(join(member(), 'node_modules/primeicons'), 'primeicons', 'MIT', '7.0.0')
    const r = checkProject(member())
    expect(r.status).toBe('offenders')
    expect(r.offenders.map((o) => o.name)).toEqual(['primevue'])
  })

  it('also finds a workspace root declared only by pnpm-workspace.yaml', () => {
    rmSync(join(root, 'package.json'))
    writeFileSync(join(root, 'pnpm-workspace.yaml'), 'packages:\n  - apps/*\n')
    pkg(join(root, 'node_modules/primevue'), 'primevue', 'MIT')
    pkg(join(root, 'node_modules/primeicons'), 'primeicons', 'MIT', '7.0.0')
    expect(checkProject(member()).status).toBe('ok')
  })
})

describe('pnpm workspace member: only links locally, the store lives at the root', () => {
  const member = () => join(root, 'apps/web')
  const store = () => join(root, 'node_modules/.pnpm/primevue@4.5.5/node_modules')
  beforeEach(() => {
    writeFileSync(join(root, 'pnpm-workspace.yaml'), 'packages:\n  - apps/*\n')
    write(member(), { name: 'web', dependencies: { primevue: '4.5.5' } })
    pkg(join(store(), 'primevue'), 'primevue', 'MIT')
    link(join(store(), 'primevue'), join(member(), 'node_modules/primevue'))
  })

  it('passes, and counts the package and its sibling dependency once each', () => {
    pkg(join(store(), '@primeuix/styled'), '@primeuix/styled', 'MIT', '0.7.4')
    const r = checkProject(member())
    expect(r.status).toBe('ok')
    expect(names(r)).toEqual(['@primeuix/styled', 'primevue'])
  })

  it('fails on a non-MIT dependency that sits beside the linked package in the store', () => {
    pkg(join(store(), '@primeuix/styled'), '@primeuix/styled', 'Commercial', '2.0.0')
    const r = checkProject(member())
    expect(r.status).toBe('offenders')
    expect(r.offenders.map((o) => o.name)).toEqual(['@primeuix/styled'])
  })

  it('finds the dependencies beside a linked scoped package', () => {
    write(member(), { name: 'web', dependencies: { '@primeuix/themes': '2.0.3' } })
    const scopedStore = join(root, 'node_modules/.pnpm/@primeuix+themes@2.0.3/node_modules')
    pkg(join(scopedStore, '@primeuix/themes'), '@primeuix/themes', 'MIT', '2.0.3')
    pkg(join(scopedStore, '@primeuix/styled'), '@primeuix/styled', 'Commercial', '2.0.0')
    link(join(scopedStore, '@primeuix/themes'), join(member(), 'node_modules/@primeuix/themes'))
    const r = checkProject(member())
    expect(r.offenders.map((o) => o.name)).toEqual(['@primeuix/styled'])
  })
})

describe('a linked or file: package that carries its own node_modules', () => {
  it('finds a primevue 5 nested inside it', () => {
    write(root, { name: 'app', dependencies: { 'my-lib': 'file:libs/my-lib' } })
    write(join(root, 'libs/my-lib'), { name: 'my-lib', version: '1.0.0' })
    pkg(join(root, 'libs/my-lib/node_modules/primevue'), 'primevue', 'SEE LICENSE IN LICENSE.md', '5.0.4')
    link(join(root, 'libs/my-lib'), join(root, 'node_modules/my-lib'))
    const r = checkProject(root)
    expect(r.status).toBe('offenders')
    expect(r.offenders.map((o) => o.name)).toEqual(['primevue'])
  })
})

describe('a declared Prime package that is not installed', () => {
  it('fails when primevue is declared and missing, though primeicons is installed', () => {
    write(root, { name: 'app', dependencies: { primevue: '5.0.4', primeicons: '7.0.0' } })
    pkg(join(root, 'node_modules/primeicons'), 'primeicons', 'MIT', '7.0.0')
    const r = checkProject(root)
    expect(r.status).toBe('missing')
    expect(r.missing).toEqual(['primevue'])
  })

  it('counts devDependencies as required too', () => {
    write(root, { name: 'app', devDependencies: { primevue: '4.5.5' }, dependencies: { primeicons: '7.0.0' } })
    pkg(join(root, 'node_modules/primeicons'), 'primeicons', 'MIT', '7.0.0')
    expect(checkProject(root).missing).toEqual(['primevue'])
  })

  it('reports an offender before a missing package', () => {
    write(root, { name: 'app', dependencies: { primevue: '5.0.4', primeicons: '7.0.0' } })
    pkg(join(root, 'node_modules/primeicons'), 'primeicons', 'Commercial', '8.0.2')
    expect(checkProject(root).status).toBe('offenders')
  })
})

describe('peerDependencies and optionalDependencies', () => {
  it('count as declared but are not required to be installed', () => {
    const p = { peerDependencies: { primevue: '^4.0.0' }, optionalDependencies: { primeicons: '7.0.0' }, dependencies: { vue: '3.5.0' } }
    expect(declaredPrimePackages(p).sort()).toEqual(['primeicons', 'primevue'])
    expect(requiredPrimePackages(p)).toEqual([])
  })

  it('a project that only has a peer dependency on primevue is not "no-prime", and nothing is required', () => {
    write(root, { name: 'lib', peerDependencies: { primevue: '^4.0.0' } })
    const r = checkProject(root)
    expect(r.status).toBe('ok')
    expect(r.missing).toEqual([])
  })

  it('a peer dependency that is installed is still checked', () => {
    write(root, { name: 'lib', peerDependencies: { primevue: '^5.0.0' } })
    pkg(join(root, 'node_modules/primevue'), 'primevue', 'SEE LICENSE IN LICENSE.md', '5.0.4')
    expect(checkProject(root).status).toBe('offenders')
  })
})

describe('a package.json that cannot be parsed', () => {
  it('fails closed for a Prime-named folder, using the folder name', () => {
    write(root, { name: 'app', dependencies: { primevue: '4.5.5' } })
    write(join(root, 'node_modules/primevue'), '{ not json')
    write(join(root, 'node_modules/@primeuix/themes'), '[]')
    write(join(root, 'node_modules/some-lib'), '{ not json')
    const r = checkProject(root)
    expect(r.status).toBe('offenders')
    expect(r.offenders.map((o) => o.name).sort()).toEqual(['@primeuix/themes', 'primevue'])
    expect(r.offenders[0]?.version).toBe('')
    expect(r.offenders[0]?.license).toBeUndefined()
  })
})

describe('a package.json with a byte order mark', () => {
  const bom = String.fromCharCode(0xfeff)
  it('is read: a declared package with nothing installed is not "no-prime"', () => {
    write(root, `${bom}${JSON.stringify({ name: 'app', dependencies: { primevue: '4.5.5' } })}`)
    expect(checkProject(root).status).toBe('nothing-installed')
  })
  it('is read in an installed package too', () => {
    write(root, { name: 'app', dependencies: { primevue: '4.5.5' } })
    write(join(root, 'node_modules/primevue'), `${bom}${JSON.stringify({ name: 'primevue', version: '4.5.5', license: 'MIT' })}`)
    expect(checkProject(root).status).toBe('ok')
  })
})

describe('links that lead nowhere', () => {
  it('a broken link is ignored', () => {
    write(root, { name: 'app', dependencies: { primevue: '4.5.5' } })
    pkg(join(root, 'node_modules/primevue'), 'primevue', 'MIT')
    mkdirSync(join(root, 'gone'))
    link(join(root, 'gone'), join(root, 'node_modules/dangling'))
    rmSync(join(root, 'gone'), { recursive: true })
    expect(checkProject(root).status).toBe('ok')
  })
})

describe('workspaceRoot', () => {
  it('is the nearest folder above with pnpm-workspace.yaml or a "workspaces" field', () => {
    write(root, { name: 'outer', workspaces: ['packages/*'] })
    write(join(root, 'inner'), { name: 'inner', workspaces: { packages: ['x'] } })
    mkdirSync(join(root, 'inner/apps/web'), { recursive: true })
    expect(workspaceRoot(join(root, 'inner/apps/web'))).toBe(join(root, 'inner'))
    expect(workspaceRoot(join(root, 'inner'))).toBe(root)
  })
  it('does not count a package.json without workspaces, and never counts the folder itself', () => {
    write(root, { name: 'plain' })
    mkdirSync(join(root, 'a'))
    writeFileSync(join(root, 'a/pnpm-workspace.yaml'), 'packages: []\n')
    expect(workspaceRoot(join(root, 'a'))).toBeUndefined()
  })
})
