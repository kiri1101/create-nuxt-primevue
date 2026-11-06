import { describe, expect, it } from 'vitest'
import { applyChanges, planFix } from '../src/doctor/plan.ts'

const off = (name: string, version: string) => ({ name, version, license: 'Commercial', dir: `/p/node_modules/${name}` })
const dep = (extra: object = {}) => ({ dependencies: { primevue: '^5.0.4' }, ...extra })
const primevue = [off('primevue', '5.0.4')]

describe('planFix: overrides that block an automatic fix', () => {
  // Any key naming a Prime package (spec 5.7: overrides decide which versions install) blocks the fix.
  it.each(['primevue', 'primeicons', '@primevue/forms', '@primeuix/styled', '@primevue/forms@^5', 'primevue@5'])(
    'blocks on an override of %s',
    (key) => {
      const r = planFix(dep({ overrides: { [key]: '4.5.5' } }), primevue)
      expect(r.changes).toEqual([])
      expect(r.manual).toHaveLength(1)
      expect(r.manual[0]).toContain('overrides')
    },
  )
  it('blocks on a Prime override nested inside another override', () => {
    const r = planFix(dep({ overrides: { 'some-lib': { primevue: '4.5.5' } } }), primevue)
    expect(r.changes).toEqual([])
    expect(r.manual).toHaveLength(1)
  })
  it('blocks when only one of several override keys is a Prime package', () => {
    const r = planFix(dep({ overrides: { vue: '3.5.0', primevue: '4.5.5' } }), primevue)
    expect(r.changes).toEqual([])
    expect(r.manual).toHaveLength(1)
  })
  it('does not block on overrides of other packages', () => {
    const r = planFix(dep({ overrides: { vue: '3.5.0', 'some-lib': { vue: '3.5.0' } } }), primevue)
    expect(r.manual).toEqual([])
    expect(r.changes).toHaveLength(1)
  })
  it('copes with null values and a null overrides field', () => {
    const r = planFix(dep({ overrides: null, resolutions: { vue: null } }), primevue)
    expect(r.manual).toEqual([])
    expect(r.changes).toHaveLength(1)
  })
})

describe('planFix: an offender that is not a direct dependency', () => {
  it('says so, even when a pin exists for that package', () => {
    const r = planFix({ dependencies: { vue: '^3.5.0' } }, primevue)
    expect(r.changes).toEqual([])
    expect(r.manual).toHaveLength(1)
    expect(r.manual[0]).toContain('primevue@5.0.4 is not a direct dependency')
  })
})

describe('applyChanges: scanning real-world package.json text', () => {
  const change = { section: 'dependencies', name: 'primevue', from: '^5.0.4', to: '4.5.5' } as const

  it('handles compact JSON with scalars, arrays and nested objects before the target', () => {
    const text = '{"a":1,"b":true,"c":null,"files":["x","y"],"n":{"m":[[1,2],[3]]},"dependencies":{"primevue":"^5.0.4"}}'
    expect(applyChanges(text, [change])).toBe(text.replace('"^5.0.4"', '"4.5.5"'))
  })

  it('handles strings with commas, braces, brackets and an odd number of escaped quotes', () => {
    const text = [
      '{',
      '  "description": "a, b",',
      '  "scripts": { "x": "echo }", "y": "say \\"hi", "z": "[ {" },',
      '  "dependencies": { "primevue": "^5.0.4" }',
      '}',
    ].join('\n')
    expect(applyChanges(text, [change])).toBe(text.replace('"^5.0.4"', '"4.5.5"'))
  })

  it('handles leading whitespace and a byte order mark', () => {
    const text = '﻿ \n{ "dependencies": { "primevue": "^5.0.4" } }'
    expect(applyChanges(text, [change])).toBe(text.replace('"^5.0.4"', '"4.5.5"'))
  })

  it('changes the named member even when it is not the first in its section', () => {
    const text = '{ "dependencies": { "primevue": "^5.0.4", "vue": "^3.5.0" } }'
    const out = applyChanges(text, [{ section: 'dependencies', name: 'vue', from: '^3.5.0', to: '3.5.1' }])
    expect(out).toBe('{ "dependencies": { "primevue": "^5.0.4", "vue": "3.5.1" } }')
  })

  it('reports the exact package, version and section when the entry cannot be found', () => {
    const text = '{ "dependencies": { "primevue": "^5.0.4" } }'
    expect(() => applyChanges(text, [{ ...change, from: '9.9.9' }])).toThrow('Could not find "primevue": "9.9.9" in dependencies.')
    expect(() => applyChanges(text, [{ ...change, name: 'nope' }])).toThrow('Could not find "nope": "^5.0.4" in dependencies.')
    expect(() => applyChanges(text, [{ ...change, section: 'devDependencies' }])).toThrow(
      'Could not find "primevue": "^5.0.4" in devDependencies.',
    )
  })

  it('reports not found, not a crash, when the section is not an object', () => {
    expect(() => applyChanges('{ "dependencies": "oops" }', [change])).toThrow('Could not find "primevue"')
  })

  it.each([
    ['an unterminated string', '{"a":"abc'],
    ['an unterminated object value', '{"a":{"b":1'],
    ['an unterminated scalar', '{"a":1'],
    ['an unquoted key', '{ a: 1, "b": 2 }'],
    ['a missing colon', '{"a" 1}'],
  ])('says package.json is not valid JSON for %s', (_label, text) => {
    expect(() => applyChanges(text, [change])).toThrow('package.json is not valid JSON.')
  })
})
