import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { applyAnswers } from '../src/create/apply.ts'
import { DEFAULTS } from '../src/create/options.ts'
import { MINIMAL_PAGE, renderFontsCss } from '../src/create/render.ts'
import { copyTemplate, ensureEmptyTarget } from '../src/create/scaffold.ts'
import type { PackageManager } from '../src/pm.ts'

const TEMPLATE = fileURLToPath(new URL('../template', import.meta.url))
const npm: PackageManager = { name: 'npm', major: 10 }
let root: string
let dir: string
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'apply-'))
  dir = join(root, 'app')
  copyTemplate(TEMPLATE, dir)
})
afterEach(() => rmSync(root, { recursive: true, force: true }))

const answers = (over = {}) => ({ projectName: 'shiny-app', ...DEFAULTS, ...over })
const read = (p: string) => readFileSync(join(dir, p), 'utf8')
const inter = 'public/fonts/inter-latin-wght-normal.woff2'
const geist = 'public/fonts/geist-latin-wght-normal.woff2'

describe('applyAnswers', () => {
  it('font none removes both font files and writes the empty fonts.css', () => {
    applyAnswers(dir, answers({ font: 'none' }), npm)
    expect(existsSync(join(dir, inter))).toBe(false)
    expect(existsSync(join(dir, geist))).toBe(false)
    expect(read('app/assets/css/fonts.css')).toBe(renderFontsCss('none'))
    expect(read('nuxt.config.ts')).not.toContain('preload')
  })
  it('font geist removes only inter and preloads geist', () => {
    applyAnswers(dir, answers({ font: 'geist' }), npm)
    expect(existsSync(join(dir, inter))).toBe(false)
    expect(existsSync(join(dir, geist))).toBe(true)
    expect(read('nuxt.config.ts')).toContain('/fonts/geist-latin-wght-normal.woff2')
    expect(read('nuxt.config.ts')).not.toContain('inter-latin')
  })
  it('demo off removes the demo components and uses the minimal page', () => {
    applyAnswers(dir, answers({ demo: false }), npm)
    expect(existsSync(join(dir, 'app/components/demo'))).toBe(false)
    expect(read('app/pages/index.vue')).toBe(MINIMAL_PAGE)
  })
  it('names the package and keeps the four pins', () => {
    applyAnswers(dir, answers(), npm)
    const pkg = JSON.parse(read('package.json'))
    expect(pkg.name).toBe('shiny-app')
    expect(pkg.dependencies).toMatchObject({
      primevue: '4.5.5',
      '@primevue/nuxt-module': '4.5.5',
      '@primeuix/themes': '2.0.3',
      primeicons: '7.0.0',
    })
  })
  it('always writes .gitignore, even when the source had none', () => {
    rmSync(join(dir, '.gitignore'), { force: true })
    applyAnswers(dir, answers(), npm)
    const lines = read('.gitignore').split(/\r?\n/)
    expect(lines).toEqual(expect.arrayContaining(['node_modules', '.nuxt', '.output']))
  })
  it.each([
    [{ name: 'yarn', major: 4 }, true],
    [{ name: 'yarn', major: 1 }, false],
    [{ name: 'npm', major: 10 }, false],
  ] as const)('.yarnrc.yml for %j: %s', (pm, expected) => {
    applyAnswers(dir, answers(), pm)
    expect(existsSync(join(dir, '.yarnrc.yml'))).toBe(expected)
  })
})

describe('pnpm workspace file', () => {
  // pnpm stops the install while a dependency has an install script nobody has reviewed. esbuild (a hard
  // dependency of Nitro) and fsevents (macOS) have one; the project needs neither script, so both are declined.
  it('writes allowBuilds: false for esbuild and fsevents when the manager is pnpm', () => {
    applyAnswers(dir, answers(), { name: 'pnpm', major: 11 })
    expect(read('pnpm-workspace.yaml')).toBe(['allowBuilds:', '  esbuild: false', '  fsevents: false', ''].join('\n'))
  })
  it.each([
    [{ name: 'npm', major: 10 }],
    [{ name: 'yarn', major: 4 }],
    [{ name: 'bun', major: 1 }],
  ] as const)('writes no pnpm-workspace.yaml for %j', (pm) => {
    applyAnswers(dir, answers(), pm)
    expect(existsSync(join(dir, 'pnpm-workspace.yaml'))).toBe(false)
  })
})

describe('ensureEmptyTarget', () => {
  it('accepts a missing folder and an empty folder', () => {
    expect(ensureEmptyTarget(join(root, 'missing'))).toBeNull()
    mkdirSync(join(root, 'empty'))
    expect(ensureEmptyTarget(join(root, 'empty'))).toBeNull()
  })
  it('refuses a path that is a file, naming it', () => {
    writeFileSync(join(root, 'afile'), 'x')
    expect(ensureEmptyTarget(join(root, 'afile'))).toBe(`${join(root, 'afile')} already exists and is not a folder.`)
  })
  it('refuses a folder with a file and leaves it', () => {
    mkdirSync(join(root, 'full'))
    writeFileSync(join(root, 'full', 'a.txt'), 'keep')
    expect(ensureEmptyTarget(join(root, 'full'))).toBe(`${join(root, 'full')} already exists and is not empty. Pick another name or empty it first.`)
    expect(readFileSync(join(root, 'full', 'a.txt'), 'utf8')).toBe('keep')
  })
})
