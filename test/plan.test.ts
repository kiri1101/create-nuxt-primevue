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

  it('gives manual steps for an offender that is not a direct dependency', () => {
    const r = planFix({ dependencies: { vue: '^3.5.0' } }, [off('@primeuix/styled', '2.0.0')])
    expect(r.changes).toEqual([])
    expect(r.manual).toHaveLength(1)
    expect(r.manual[0]).toContain('@primeuix/styled')
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

  it('leaves an MIT direct @primevue/themes alone', () => {
    const pkg = { dependencies: { primevue: '^5.0.4', '@primevue/themes': '4.5.4' } }
    const r = planFix(pkg, [off('primevue', '5.0.4')])
    expect(r.changes.map((c) => c.name)).toEqual(['primevue'])
  })
})

describe('applyChanges', () => {
  const text = [
    '{',
    '    "scripts": {',
    '        "note": "echo \\"primevue\\": \\"5.0.4\\""',
    '    },',
    '    "dependencies": {',
    '        "primevue": "^5.0.4",',
    '        "vue": "^3.5.0"',
    '    },',
    '    "peerDependencies": {',
    '        "primevue": "^5.0.4"',
    '    },',
    '    "name": "x"',
    '}',
  ].join('\r\n')

  it('changes only the version string, keeping indentation, CRLF, key order and the missing final newline', () => {
    const out = applyChanges(text, [{ section: 'dependencies', name: 'primevue', from: '^5.0.4', to: '4.5.5' }])
    expect(out).toBe(text.replace('"^5.0.4"', '"4.5.5"'))
  })
})
