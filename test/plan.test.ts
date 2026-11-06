import { describe, expect, it } from 'vitest'
import { applyChanges, planFix } from '../src/doctor/plan.ts'

const off = (name: string, version: string, license: unknown = 'SEE LICENSE IN LICENSE') => ({
  name,
  version,
  license,
  dir: `/p/node_modules/${name}`,
})

describe('planFix', () => {
  it('maps primevue, @primeuix/themes and primeicons to the free pins, in their own sections', () => {
    const pkg = {
      dependencies: { primevue: '^5.0.4', '@primeuix/themes': '3.1.0' },
      devDependencies: { primeicons: '8.0.2' },
    }
    const r = planFix(pkg, [off('primevue', '5.0.4'), off('@primeuix/themes', '3.1.0'), off('primeicons', '8.0.2')])
    expect(r.manual).toEqual([])
    expect(r.changes).toHaveLength(3)
    expect(r.changes).toEqual(
      expect.arrayContaining([
        { section: 'dependencies', name: 'primevue', from: '^5.0.4', to: '4.5.5' },
        { section: 'dependencies', name: '@primeuix/themes', from: '3.1.0', to: '2.0.3' },
        { section: 'devDependencies', name: 'primeicons', from: '8.0.2', to: '7.0.0' },
      ]),
    )
  })

  it('maps @primevue/nuxt-module to 4.5.5', () => {
    const r = planFix({ dependencies: { '@primevue/nuxt-module': '^5.0.0' } }, [off('@primevue/nuxt-module', '5.0.0')])
    expect(r.changes).toEqual([{ section: 'dependencies', name: '@primevue/nuxt-module', from: '^5.0.0', to: '4.5.5' }])
  })

  // A real v5 tree brings in nine more non-MIT packages through the four direct ones. They are listed
  // apart from the manual steps, because the automatic fix clears them.
  it('lists an offender that is not a direct dependency as indirect, once, and not as a manual step', () => {
    const r = planFix({ dependencies: { vue: '^3.5.0' } }, [off('@primeuix/styled', '2.0.0'), off('@primeuix/styled', '2.0.0')])
    expect(r.changes).toEqual([])
    expect(r.manual).toEqual([])
    expect(r.indirect.map((o) => o.name)).toEqual(['@primeuix/styled'])
  })

  it.each(['overrides', 'resolutions'])('changes nothing when %s mention primevue', (key) => {
    const pkg = { dependencies: { primevue: '^5.0.4' }, [key]: { primevue: '5.0.4' } }
    const r = planFix(pkg, [off('primevue', '5.0.4')])
    expect(r.changes).toEqual([])
    expect(r.manual).toHaveLength(1)
  })

  it('gives manual steps for a direct @primeuix package other than themes', () => {
    const r = planFix({ dependencies: { '@primeuix/styled': '2.0.0' } }, [off('@primeuix/styled', '2.0.0')])
    expect(r.changes).toEqual([])
    expect(r.manual).toHaveLength(1)
    expect(r.manual[0]).toContain('@primeuix/styled')
  })

  it('changes a package listed in both sections in both places', () => {
    const pkg = { dependencies: { primevue: '^5.0.4' }, devDependencies: { primevue: '5.0.0' } }
    const r = planFix(pkg, [off('primevue', '5.0.4')])
    expect(r.manual).toEqual([])
    expect(r.changes).toEqual([
      { section: 'dependencies', name: 'primevue', from: '^5.0.4', to: '4.5.5' },
      { section: 'devDependencies', name: 'primevue', from: '5.0.0', to: '4.5.5' },
    ])
  })

  it('gives a manual step when the pin is already right but an old copy is installed', () => {
    const r = planFix({ dependencies: { primevue: '4.5.5' } }, [off('primevue', '5.0.4')])
    expect(r.changes).toEqual([])
    expect(r.manual).toHaveLength(1)
    expect(r.manual[0]).toContain('primevue')
  })

  it('plans once for an offender listed twice (nested copies)', () => {
    const r = planFix({ dependencies: { primevue: '^5.0.4' } }, [off('primevue', '5.0.4'), off('primevue', '5.0.4')])
    expect(r.changes).toEqual([{ section: 'dependencies', name: 'primevue', from: '^5.0.4', to: '4.5.5' }])
  })

  it('changes nothing when pnpm.overrides mention a Prime package', () => {
    const pkg = { dependencies: { primevue: '^5.0.4' }, pnpm: { overrides: { primeicons: '8.0.2' } } }
    const r = planFix(pkg, [off('primevue', '5.0.4')])
    expect(r.changes).toEqual([])
    expect(r.manual).toHaveLength(1)
  })

  it('treats a name@range override key as the package', () => {
    const pkg = { dependencies: { primevue: '^5.0.4' }, overrides: { 'primevue@^5': '5.0.4' } }
    const r = planFix(pkg, [off('primevue', '5.0.4')])
    expect(r.changes).toEqual([])
    expect(r.manual).toHaveLength(1)
  })

  it('leaves an MIT direct @primevue/themes alone', () => {
    const pkg = { dependencies: { primevue: '^5.0.4', '@primevue/themes': '4.5.4' } }
    const r = planFix(pkg, [off('primevue', '5.0.4')])
    expect(r.changes.map((c) => c.name)).toEqual(['primevue'])
  })
})

describe('applyChanges', () => {
  // Decoys with the same version text come BEFORE the real targets.
  const build = (dep: string, dev: string) =>
    [
      '{',
      '    "scripts": {',
      '        "note": "echo \\"primevue\\": \\"^5.0.4\\""',
      '    },',
      '    "peerDependencies": {',
      '        "primevue": "^5.0.4",',
      '        "primeicons": "8.0.2"',
      '    },',
      '    "dependencies": {',
      `        "primevue": "${dep}",`,
      '        "vue": "^3.5.0"',
      '    },',
      '    "devDependencies": {',
      `        "primeicons": "${dev}"`,
      '    },',
      '    "name": "x"',
      '}',
    ].join('\r\n')

  it('changes only the targeted version strings, keeping indentation, CRLF, key order and the missing final newline', () => {
    const out = applyChanges(build('^5.0.4', '8.0.2'), [
      { section: 'dependencies', name: 'primevue', from: '^5.0.4', to: '4.5.5' },
      { section: 'devDependencies', name: 'primeicons', from: '8.0.2', to: '7.0.0' },
    ])
    expect(out).toBe(build('4.5.5', '7.0.0'))
  })
})
