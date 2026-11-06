import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { INSTALL_SCRIPT_PACKAGES } from '../src/create/render.ts'
import { SUPPORTED_NODE } from '../src/node-version.ts'
import { PINS } from '../src/doctor/plan.ts'

const tpl = (p: string) => readFileSync(fileURLToPath(new URL(`../template/${p}`, import.meta.url)), 'utf8')
const pkg = JSON.parse(tpl('package.json')) as { scripts: Record<string, string>; dependencies: Record<string, string>; engines: { node: string } }
const lock = JSON.parse(tpl('package-lock.json')) as { packages: Record<string, { hasInstallScript?: boolean }> }

describe('the template runs the licence guard on every package manager', () => {
  // Spec goal 3. Yarn 2+ does not run "pre" hooks for user scripts, so the guard is part of the build script itself.
  it('build runs the guard first, then nuxt build, and there is no prebuild hook', () => {
    expect(pkg.scripts.build).toBe('node scripts/check-licences.mjs && nuxt build')
    expect(pkg.scripts).not.toHaveProperty('prebuild')
  })
})

describe('template stays in sync with the code that repeats it', () => {
  it('the pins doctor writes are the exact versions the template pins', () => {
    expect(pkg.dependencies.primevue).toBe(PINS.primevue)
    expect(pkg.dependencies['@primevue/nuxt-module']).toBe(PINS['@primevue/*'])
    expect(pkg.dependencies['@primeuix/themes']).toBe(PINS['@primeuix/themes'])
    expect(pkg.dependencies.primeicons).toBe(PINS.primeicons)
  })

  it('the Node range is the one Nuxt supports, in the CLI package and in the template', () => {
    expect(pkg.engines.node).toBe(SUPPORTED_NODE)
    const root = JSON.parse(readFileSync(fileURLToPath(new URL('../package.json', import.meta.url)), 'utf8')) as { engines: { node: string } }
    expect(root.engines.node).toBe(SUPPORTED_NODE)
  })

  it('tailwindcss-primeui is pinned exactly, like the other packages that PrimeTek publishes', () => {
    expect(pkg.dependencies['tailwindcss-primeui']).toBe('0.6.1')
  })

  // pnpm refuses to install while any dependency has an unreviewed install script, so applyAnswers lists them all.
  it('pnpm is told about every package in the template tree that has an install script, plus fsevents', () => {
    const found = new Set(
      Object.entries(lock.packages)
        .filter(([, v]) => v.hasInstallScript)
        .map(([k]) => k.split('node_modules/').pop() as string),
    )
    found.add('fsevents')
    expect([...INSTALL_SCRIPT_PACKAGES].sort()).toEqual([...found].sort())
  })
})
