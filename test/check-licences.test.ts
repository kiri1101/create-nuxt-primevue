import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  checkProject,
  isPrimePackage,
} from '../template/scripts/check-licences.mjs'

let root: string

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'licences-'))
})
afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

function writeJson(dir: string, data: unknown) {
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'package.json'), JSON.stringify(data))
}
function project(deps: Record<string, string>) {
  writeJson(root, { name: 'app', dependencies: deps })
}
function pkg(dir: string, name: string, license: unknown, version = '4.5.5') {
  const data: Record<string, unknown> = { name, version }
  if (license !== undefined) data.license = license
  writeJson(dir, data)
}

describe('isPrimePackage', () => {
  it('accepts Prime packages', () => {
    for (const n of ['primevue', 'primeicons', '@primevue/forms', '@primeuix/styled']) {
      expect(isPrimePackage(n)).toBe(true)
    }
  })
  it('rejects look-alikes', () => {
    for (const n of ['primevue-extra', '@primevuex/a', 'vue']) {
      expect(isPrimePackage(n)).toBe(false)
    }
  })
})

describe('checkProject', () => {
  it('passes when every Prime package is MIT', () => {
    project({ primevue: '4.5.5' })
    pkg(join(root, 'node_modules/primevue'), 'primevue', 'MIT')
    pkg(join(root, 'node_modules/@primeuix/themes'), '@primeuix/themes', 'MIT', '2.0.3')
    const r = checkProject(root)
    expect(r.status).toBe('ok')
    expect(r.offenders).toEqual([])
    expect(r.installed).toHaveLength(2)
  })

  it('flags a non-MIT licence', () => {
    project({ primevue: '5.0.4' })
    pkg(join(root, 'node_modules/primevue'), 'primevue', 'SEE LICENSE IN LICENSE.md', '5.0.4')
    const r = checkProject(root)
    expect(r.status).toBe('offenders')
    expect(r.offenders.map((o) => o.name)).toEqual(['primevue'])
    expect(r.offenders[0].version).toBe('5.0.4')
  })

  it('flags a missing licence field and an object licence', () => {
    project({ primevue: '4.5.5' })
    pkg(join(root, 'node_modules/primevue'), 'primevue', undefined)
    pkg(join(root, 'node_modules/primeicons'), 'primeicons', { type: 'MIT' }, '7.0.0')
    const r = checkProject(root)
    expect(r.status).toBe('offenders')
    expect(r.offenders.map((o) => o.name).sort()).toEqual(['primeicons', 'primevue'])
  })

  it('finds a non-MIT package nested inside another package', () => {
    project({ primevue: '4.5.5' })
    pkg(join(root, 'node_modules/primevue'), 'primevue', 'MIT')
    pkg(
      join(root, 'node_modules/some-lib/node_modules/@primeuix/themes'),
      '@primeuix/themes',
      'Commercial',
      '3.0.0',
    )
    const r = checkProject(root)
    expect(r.status).toBe('offenders')
    expect(r.offenders.map((o) => o.name)).toEqual(['@primeuix/themes'])
  })

  it('finds a non-MIT package in the pnpm store, once', () => {
    project({ primevue: '5.0.4' })
    pkg(join(root, 'node_modules/.pnpm/primevue@5.0.4/node_modules/primevue'), 'primevue', 'Commercial', '5.0.4')
    // pnpm links the store copy into the top level
    symlinkSync(
      join(root, 'node_modules/.pnpm/primevue@5.0.4/node_modules/primevue'),
      join(root, 'node_modules/primevue'),
      'junction',
    )
    const r = checkProject(root)
    expect(r.status).toBe('offenders')
    expect(r.offenders).toHaveLength(1)
  })

  it('does not hang on a symlink loop and reports a package once', () => {
    project({ primevue: '5.0.4' })
    pkg(join(root, 'node_modules/real-lib/node_modules/primevue'), 'primevue', 'Commercial', '5.0.4')
    symlinkSync(root, join(root, 'node_modules/loop'), 'junction')
    symlinkSync(join(root, 'node_modules/real-lib/node_modules/primevue'), join(root, 'node_modules/primevue'), 'junction')
    const r = checkProject(root)
    expect(r.offenders).toHaveLength(1)
  })

  it('reports nothing-installed when Prime packages are declared but node_modules is absent', () => {
    project({ primevue: '4.5.5' })
    expect(checkProject(root).status).toBe('nothing-installed')
  })

  it('reports no-prime when nothing Prime is declared or installed', () => {
    project({ vue: '3.5.0' })
    pkg(join(root, 'node_modules/vue'), 'vue', 'MIT', '3.5.0')
    expect(checkProject(root).status).toBe('no-prime')
  })
})
