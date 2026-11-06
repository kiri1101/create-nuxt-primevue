import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, normalize } from 'node:path'
import { pathToFileURL } from 'node:url'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { checkProject, declaredPrimePackages } from '../template/scripts/check-licences.mjs'

// A package reached through a link lives in a store outside the project (pnpm can place its virtual store
// anywhere). Its dependencies sit beside it, but only when the link target is inside a node_modules folder.
let root: string
let elsewhere: string
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'store-project-'))
  elsewhere = mkdtempSync(join(tmpdir(), 'store-other-'))
})
afterEach(() => {
  rmSync(root, { recursive: true, force: true })
  rmSync(elsewhere, { recursive: true, force: true })
})

function write(dir: string, data: unknown) {
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'package.json'), typeof data === 'string' ? data : JSON.stringify(data))
}
const pkg = (dir: string, name: string, license: unknown, version = '4.5.5') => write(dir, { name, version, license })
const link = (target: string, path: string) => {
  mkdirSync(join(path, '..'), { recursive: true })
  symlinkSync(target, path, 'junction')
}
const project = (deps: Record<string, string>) => write(root, { name: 'app', dependencies: deps })
const offenders = (r: { offenders: { name: string }[] }) => r.offenders.map((o) => o.name).sort()

describe('dependencies beside a linked package', () => {
  it('are checked when the package sits directly in a node_modules folder', () => {
    project({ primevue: '4.5.5' })
    pkg(join(elsewhere, 'store/node_modules/primevue'), 'primevue', 'MIT')
    pkg(join(elsewhere, 'store/node_modules/@primeuix/styled'), '@primeuix/styled', 'Commercial', '2.0.0')
    link(join(elsewhere, 'store/node_modules/primevue'), join(root, 'node_modules/primevue'))
    expect(offenders(checkProject(root))).toEqual(['@primeuix/styled'])
  })

  it('are checked when the package is scoped', () => {
    project({ '@primeuix/themes': '2.0.3' })
    pkg(join(elsewhere, 'store/node_modules/@primeuix/themes'), '@primeuix/themes', 'MIT', '2.0.3')
    pkg(join(elsewhere, 'store/node_modules/primeicons'), 'primeicons', 'Commercial', '8.0.2')
    link(join(elsewhere, 'store/node_modules/@primeuix/themes'), join(root, 'node_modules/@primeuix/themes'))
    expect(offenders(checkProject(root))).toEqual(['primeicons'])
  })

  // The decoys below are Prime packages that Node could not reach from the linked package, so they must not be reported.
  it('are not looked for when the package is nested deeper in a node_modules folder', () => {
    project({ nested: '1.0.0' })
    write(join(elsewhere, 'store/node_modules/foo/nested'), { name: 'nested', version: '1.0.0' })
    pkg(join(elsewhere, 'store/node_modules/primeicons'), 'primeicons', 'Commercial', '8.0.2')
    link(join(elsewhere, 'store/node_modules/foo/nested'), join(root, 'node_modules/nested'))
    expect(checkProject(root).offenders).toEqual([])
  })

  it('are not looked for when the folder above merely ends with an @', () => {
    project({ pkg: '1.0.0' })
    write(join(elsewhere, 'store/node_modules/odd@/pkg'), { name: 'pkg', version: '1.0.0' })
    pkg(join(elsewhere, 'store/node_modules/primeicons'), 'primeicons', 'Commercial', '8.0.2')
    link(join(elsewhere, 'store/node_modules/odd@/pkg'), join(root, 'node_modules/pkg'))
    expect(checkProject(root).offenders).toEqual([])
  })

  it('are not looked for when a scope folder is not inside a node_modules folder', () => {
    project({ '@primeuix/themes': '2.0.3' })
    pkg(join(elsewhere, 'libs/@primeuix/themes'), '@primeuix/themes', 'MIT', '2.0.3')
    pkg(join(elsewhere, 'libs/@primeuix/styled'), '@primeuix/styled', 'Commercial', '2.0.0')
    link(join(elsewhere, 'libs/@primeuix/themes'), join(root, 'node_modules/@primeuix/themes'))
    expect(checkProject(root).offenders).toEqual([])
  })

  it('are not looked for when the package is a plain folder outside any node_modules', () => {
    project({ 'my-lib': '1.0.0' })
    write(join(elsewhere, 'libs/my-lib'), { name: 'my-lib', version: '1.0.0' })
    pkg(join(elsewhere, 'libs/primevue'), 'primevue', 'Commercial', '5.0.4')
    // A folder inside the package is not an installed package either.
    pkg(join(elsewhere, 'libs/my-lib/examples'), 'primeicons', 'Commercial', '8.0.2')
    link(join(elsewhere, 'libs/my-lib'), join(root, 'node_modules/my-lib'))
    expect(checkProject(root).offenders).toEqual([])
  })
})

describe('what is not a folder', () => {
  it.each(['@dangling', '.dangling'])('a link named %s that leads nowhere is ignored', (name) => {
    project({ primevue: '4.5.5' })
    pkg(join(root, 'node_modules/primevue'), 'primevue', 'MIT')
    mkdirSync(join(elsewhere, 'gone'))
    link(join(elsewhere, 'gone'), join(root, 'node_modules', name))
    rmSync(join(elsewhere, 'gone'), { recursive: true })
    expect(checkProject(root).status).toBe('ok')
  })
  it('a node_modules that is a file counts as nothing installed', () => {
    project({ primevue: '4.5.5' })
    writeFileSync(join(root, 'node_modules'), 'not a folder')
    expect(checkProject(root).status).toBe('nothing-installed')
  })
  it('a file inside node_modules is not a package', () => {
    project({ primevue: '4.5.5' })
    pkg(join(root, 'node_modules/primevue'), 'primevue', 'MIT')
    writeFileSync(join(root, 'node_modules/primeicons'), 'a file named like a package')
    expect(checkProject(root).installed).toHaveLength(1)
  })
})

describe('a package.json that is valid JSON but not an object', () => {
  it.each(['"text"', '5', 'true'])('fails closed for a Prime-named folder holding %s', (text) => {
    project({ primevue: '4.5.5' })
    write(join(root, 'node_modules/primevue'), text)
    expect(offenders(checkProject(root))).toEqual(['primevue'])
  })
})

describe('declaredPrimePackages reads each section', () => {
  it.each(['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'])('%s', (section) => {
    expect(declaredPrimePackages({ [section]: { primevue: '1.0.0', vue: '3.5.0' } })).toEqual(['primevue'])
  })
})

describe('every node_modules folder is listed once, however many packages link to it', () => {
  let counts: Map<string, number>
  beforeEach(() => {
    counts = new Map()
    vi.doMock('node:fs', async (original) => {
      const real = await original<typeof import('node:fs')>()
      return {
        ...real,
        readdirSync: ((...args: Parameters<typeof real.readdirSync>) => {
          const key = normalize(String(args[0]))
          counts.set(key, (counts.get(key) ?? 0) + 1)
          return real.readdirSync(...args)
        }) as typeof real.readdirSync,
      }
    })
  })
  afterEach(() => vi.doUnmock('node:fs'))

  it('lists the store folder once for two linked packages', async () => {
    project({ a: '1.0.0', b: '1.0.0' })
    const store = join(root, 'node_modules/.pnpm/store/node_modules')
    write(join(store, 'a'), { name: 'a' })
    write(join(store, 'b'), { name: 'b' })
    link(join(store, 'a'), join(root, 'node_modules/a'))
    link(join(store, 'b'), join(root, 'node_modules/b'))
    const url = pathToFileURL(join(process.cwd(), 'template/scripts/check-licences.mjs')).href
    const guard = (await import(`${url}?count=1`)) as typeof import('../template/scripts/check-licences.mjs')
    guard.checkProject(root)
    expect(counts.get(normalize(store))).toBe(1)
  })
})
