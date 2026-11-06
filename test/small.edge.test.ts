import { describe, expect, it } from 'vitest'
import { gitGate } from '../src/doctor/gate.ts'
import { detectPackageManager, installArgs, scriptArgs } from '../src/pm.ts'
import { renderFontsCss, renderTheme } from '../src/create/render.ts'
import { DEFAULTS } from '../src/create/options.ts'

describe('gitGate messages', () => {
  it('says the folder is not a git repository', () => {
    expect(gitGate(false, '', true)).toContain('not a git repository')
  })
  it('says there are uncommitted changes', () => {
    expect(gitGate(true, ' M package.json\n', true)).toContain('uncommitted changes')
  })
  // `git status --porcelain` prints nothing for a clean tree; stray whitespace is not a change.
  it('treats whitespace-only status output as a clean tree', () => {
    expect(gitGate(true, '\n', true)).toBeNull()
    expect(gitGate(true, '  \r\n', true)).toBeNull()
  })
})

describe('package manager commands (spec 5.3: the detected manager runs install and run)', () => {
  const managers = ['npm', 'pnpm', 'yarn', 'bun'] as const
  it.each(managers)('%s installs with "install"', (name) => {
    expect(installArgs({ name, major: 1 })).toStrictEqual(['install'])
  })
  it.each(managers)('%s runs a script with "run <script>"', (name) => {
    expect(scriptArgs({ name, major: 1 }, 'dev')).toStrictEqual(['run', 'dev'])
  })
  it('reads the major from the first word only', () => {
    expect(detectPackageManager('pnpm/9.1.0 npm/? node/v22')).toStrictEqual({ name: 'pnpm', major: 9 })
  })
  it('gives a null major when the version is missing or not a number', () => {
    expect(detectPackageManager('yarn')).toStrictEqual({ name: 'yarn', major: null })
    expect(detectPackageManager('yarn/abc')).toStrictEqual({ name: 'yarn', major: null })
  })
  it('treats an empty or unknown agent as npm with no version', () => {
    expect(detectPackageManager('')).toStrictEqual({ name: 'npm', major: null })
    expect(detectPackageManager('deno/1.0.0')).toStrictEqual({ name: 'npm', major: null })
  })
})

describe('render output', () => {
  it('names every preset and font in the theme file', () => {
    const nora = renderTheme({ ...DEFAULTS, theme: 'nora', font: 'geist' })
    expect(nora).toContain("import Nora from '@primeuix/themes/nora'")
    expect(nora).toContain("preset: 'Nora'")
    expect(nora).toContain("font: 'Geist'")
    const material = renderTheme({ ...DEFAULTS, theme: 'material', font: 'none' })
    expect(material).toContain("import Material from '@primeuix/themes/material'")
    expect(material).toContain("preset: 'Material'")
    expect(material).toContain("font: 'None'")
    expect(renderTheme({ ...DEFAULTS }) ).toContain("font: 'Inter'")
  })
  it('writes a comment only, with no @font-face, when there is no custom font', () => {
    const css = renderFontsCss('none')
    expect(css).toMatch(/^\/\* No custom font.*\*\/\n$/)
    expect(css).not.toContain('@font-face')
  })
  // Fontsource's variable fonts register these family names.
  it('uses the Inter and Geist variable family names', () => {
    expect(renderFontsCss('inter')).toContain('font-family: "Inter Variable"')
    expect(renderFontsCss('inter')).toContain('--font-sans: "Inter Variable"')
    expect(renderFontsCss('geist')).toContain('font-family: "Geist Variable"')
    expect(renderFontsCss('geist')).toContain('--font-sans: "Geist Variable"')
    expect(renderFontsCss('geist')).toContain('/fonts/geist-latin-wght-normal.woff2')
  })
})
