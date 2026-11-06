import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { applyAnswers } from '../src/create/apply.ts'
import { DEFAULTS } from '../src/create/options.ts'
import { copyTemplate } from '../src/create/scaffold.ts'
import type { PackageManager } from '../src/pm.ts'

const TEMPLATE = fileURLToPath(new URL('../template', import.meta.url))
const npm: PackageManager = { name: 'npm', major: 10 }
let root: string
let dir: string
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'apply-edge-'))
  dir = join(root, 'app')
  copyTemplate(TEMPLATE, dir)
})
afterEach(() => rmSync(root, { recursive: true, force: true }))

const answers = (over = {}) => ({ projectName: 'shiny-app', ...DEFAULTS, ...over })
const read = (p: string) => readFileSync(join(dir, p), 'utf8')
const template = (p: string) => readFileSync(join(TEMPLATE, p), 'utf8')

describe('applyAnswers: edge cases', () => {
  // The template ships Inter, with a preload link for it. The default answers keep it as it is.
  it('leaves nuxt.config.ts and the Inter files untouched for the default font', () => {
    applyAnswers(dir, answers(), npm)
    expect(read('nuxt.config.ts')).toBe(template('nuxt.config.ts'))
    expect(existsSync(join(dir, 'public/fonts/inter-latin-wght-normal.woff2'))).toBe(true)
  })

  // Worked by hand from template/nuxt.config.ts: font "none" removes the newline plus the three-line
  // `link: [ ... ],` block under `head`, and nothing else.
  it('font none removes exactly the preload link block from nuxt.config.ts', () => {
    applyAnswers(dir, answers({ font: 'none' }), npm)
    const block =
      "\n      link: [\n        { rel: 'preload', as: 'font', type: 'font/woff2', href: '/fonts/inter-latin-wght-normal.woff2', crossorigin: 'anonymous' },\n      ],"
    const source = template('nuxt.config.ts')
    expect(source).toContain(block)
    expect(read('nuxt.config.ts')).toBe(source.replace(block, ''))
  })

  it('does not fail when the other font files are already gone', () => {
    rmSync(join(dir, 'public/fonts/geist-latin-wght-normal.woff2'))
    rmSync(join(dir, 'public/fonts/OFL-Geist.txt'))
    expect(() => applyAnswers(dir, answers(), npm)).not.toThrow()
  })

  it('demo on keeps the demo components and does not hard-code a name', () => {
    applyAnswers(dir, answers(), npm)
    expect(read('app/pages/index.vue')).not.toContain("'my-app'")
    expect(existsSync(join(dir, 'app/components/demo'))).toBe(true)
  })

  it('demo off does not fail when the demo folder is already gone', () => {
    rmSync(join(dir, 'app/components/demo'), { recursive: true })
    expect(() => applyAnswers(dir, answers({ demo: false }), npm)).not.toThrow()
  })

  // Spec 5.4: without the demo, a minimal page with none of the demo components.
  it('demo off writes a small valid page that uses no demo component', () => {
    applyAnswers(dir, answers({ demo: false }), npm)
    const page = read('app/pages/index.vue')
    expect(page).toContain('<template>')
    expect(page).toContain('</template>')
    expect(page).not.toMatch(/<Demo|components\/demo/)
  })

  // Yarn 2+ defaults to Plug'n'Play, which the licence guard cannot read (doctor says so). The fix is
  // the node-modules linker, written as .yarnrc.yml.
  it('writes nodeLinker: node-modules for Yarn 4', () => {
    applyAnswers(dir, answers(), { name: 'yarn', major: 4 })
    expect(read('.yarnrc.yml')).toBe('nodeLinker: node-modules\n')
  })

  it('puts the project name in the README heading', () => {
    applyAnswers(dir, answers(), npm)
    expect(read('README.md').startsWith('# shiny-app\n')).toBe(true)
  })

  it('fails loudly, naming the file, when the README heading is not at the very start', () => {
    writeFileSync(join(dir, 'README.md'), 'Intro\n# my-app\n')
    expect(() => applyAnswers(dir, answers(), npm)).toThrow(/Template changed: .* no longer matches in .*README\.md/)
  })

  it.each([
    [{ name: 'yarn', major: 2 }, true],
    [{ name: 'yarn', major: null }, false],
    [{ name: 'pnpm', major: 9 }, false],
  ] as const)('.yarnrc.yml for %j: %s', (pm, expected) => {
    applyAnswers(dir, answers(), pm)
    expect(existsSync(join(dir, '.yarnrc.yml'))).toBe(expected)
  })
})

describe('applyAnswers: the generated README and demo follow the project', () => {
  it('uses the detected manager in the README commands', () => {
    applyAnswers(dir, answers(), { name: 'pnpm', major: 11 })
    const readme = read('README.md')
    expect(readme).toContain('`pnpm run dev`')
    expect(readme).toContain('`pnpm run build`')
    expect(readme).toContain('`pnpm run check:licences`')
    expect(readme).not.toMatch(/(^|[^p])npm run/)
  })
  // The demo's licence rows read installed packages through this composable, so it goes with the demo.
  it('demo off also removes the composable that only the demo uses, and demo on keeps it', () => {
    applyAnswers(dir, answers(), npm)
    expect(existsSync(join(dir, 'app/composables/useProofLicences.ts'))).toBe(true)
    const other = join(root, 'nodemo')
    copyTemplate(TEMPLATE, other)
    applyAnswers(other, answers({ demo: false }), npm)
    expect(existsSync(join(other, 'app/composables/useProofLicences.ts'))).toBe(false)
  })
  it('keeps npm commands for npm', () => {
    applyAnswers(dir, answers(), npm)
    expect(read('README.md')).toContain('`npm run dev`')
  })
  it('the demo takes the name from package.json instead of a hard-coded one', () => {
    applyAnswers(dir, answers(), npm)
    expect(read('app/pages/index.vue')).not.toContain("'my-app'")
    expect(JSON.parse(read('package.json')).name).toBe('shiny-app')
  })
  // The demo needs a 1600px breakpoint. It is named for the demo, so a project without the demo keeps Tailwind's defaults.
  it('keeps the demo breakpoint with the demo and removes it without', () => {
    applyAnswers(dir, answers(), npm)
    expect(read('app/assets/css/main.css')).toContain('--breakpoint-proof: 1600px;')
    expect(read('app/assets/css/main.css')).not.toMatch(/--breakpoint-(sm|lg|2xl)/)
  })
  it('removes the demo breakpoint when the demo is off, and nothing else in main.css', () => {
    const before = template('app/assets/css/main.css')
    applyAnswers(dir, answers({ demo: false }), npm)
    const after = read('app/assets/css/main.css')
    expect(after).not.toContain('breakpoint')
    expect(before.startsWith(after.trimEnd())).toBe(true)
  })
})
