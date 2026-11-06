import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { DEFAULTS } from '../src/create/options.ts'
import { GITIGNORE, renderFontsCss, renderTheme } from '../src/create/render.ts'

const tpl = (p: string) => readFileSync(fileURLToPath(new URL(`../template/${p}`, import.meta.url)), 'utf8')
const base = { projectName: 'x', ...DEFAULTS }

describe('renderTheme', () => {
  it('lara + violet', () => {
    const out = renderTheme({ ...base, theme: 'lara', primary: 'violet' })
    expect(out).toContain("from '@primeuix/themes/lara'")
    expect(out).toContain("palette('{violet}')")
    expect(out).toContain("preset: 'Lara'")
  })
  it('uses a hex colour as given', () => {
    expect(renderTheme({ ...base, primary: '#112233' })).toContain("palette('#112233')")
  })
  it.each(['aura', 'lara', 'nora', 'material'] as const)('%s keeps the dark selector', (theme) => {
    expect(renderTheme({ ...base, theme })).toContain("darkModeSelector: '.dark'")
  })
})

describe('template stays in sync', () => {
  it('app/theme.ts equals renderTheme(defaults)', () => {
    expect(renderTheme(base)).toBe(tpl('app/theme.ts'))
  })
  it('fonts.css equals renderFontsCss(inter)', () => {
    expect(renderFontsCss('inter')).toBe(tpl('app/assets/css/fonts.css'))
  })
})

describe('generated .gitignore', () => {
  it('keeps Yarn 2+ install state out of the first commit and later diffs', () => {
    expect(GITIGNORE.split('\n')).toEqual(expect.arrayContaining(['.yarn/install-state.gz', '.pnp.*']))
  })
})

describe('renderTheme comment', () => {
  // Claims are limited to the three preset colours; a custom colour is the user's to check.
  it('names no single preset and limits the contrast claim to the three preset colours', () => {
    const out = renderTheme(base)
    expect(out).not.toContain("Aura's")
    expect(out).toContain('emerald, blue and violet')
    expect(out).toContain('check your own')
  })
})
