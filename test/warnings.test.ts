import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { setupWarnings } from '../src/doctor/warnings.ts'

const TEMPLATE = fileURLToPath(new URL('../template', import.meta.url))
let dir: string
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'warn-'))
})
afterEach(() => rmSync(dir, { recursive: true, force: true }))

function project(deps: Record<string, string>, config?: string) {
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'app', dependencies: deps }))
  if (config !== undefined) writeFileSync(join(dir, 'nuxt.config.ts'), config)
}
const layered = 'export default defineNuxtConfig({ primevue: { options: { cssLayer: true } } })'

describe('setupWarnings', () => {
  it('has nothing to say about a generated project', () => {
    expect(setupWarnings(TEMPLATE)).toEqual([])
  })
  it('warns when Tailwind is used without tailwindcss-primeui', () => {
    project({ primevue: '4.5.5', tailwindcss: '^4.3.0' }, layered)
    const w = setupWarnings(dir)
    expect(w).toHaveLength(1)
    expect(w[0]).toContain('tailwindcss-primeui')
  })
  it('warns when the config has no cssLayer', () => {
    project({ primevue: '4.5.5', tailwindcss: '^4.3.0', 'tailwindcss-primeui': '^0.6.0' }, 'export default defineNuxtConfig({})')
    const w = setupWarnings(dir)
    expect(w).toHaveLength(1)
    expect(w[0]).toContain('cssLayer')
  })
  it('warns about the deprecated @primevue/themes', () => {
    project({ primevue: '4.5.5', '@primevue/themes': '4.5.4' })
    const w = setupWarnings(dir)
    expect(w).toHaveLength(1)
    expect(w[0]).toContain('@primevue/themes')
  })
})
