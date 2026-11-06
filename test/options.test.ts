import { describe, expect, it } from 'vitest'
import { decideYes, parseCreateArgs, validatePrimary, validateProjectName } from '../src/create/options.ts'

describe('validateProjectName', () => {
  it.each(['my-app', 'my.app_2'])('accepts %s', (name) => {
    expect(validateProjectName(name)).toBeNull()
  })
  it.each(['my app', '../x', 'C:\\x', '.', '..', '', '-x'])('refuses %j', (name) => {
    expect(validateProjectName(name)).toEqual(expect.any(String))
  })
})

describe('validatePrimary', () => {
  it.each(['emerald', 'blue', 'violet', '#1a2b3c', '#ABCDEF'])('accepts %s', (v) => {
    expect(validatePrimary(v)).toBeNull()
  })
  it.each(['red', '#12345', '#gggggg', '1a2b3c'])('refuses %s', (v) => {
    expect(validatePrimary(v)).toEqual(expect.any(String))
  })
})

describe('parseCreateArgs', () => {
  it('reads every flag', () => {
    const r = parseCreateArgs(['my-app', '--theme', 'nora', '--primary', '#112233', '--font', 'none', '--no-demo', '--no-git', '--yes'])
    expect(r.answers).toEqual({ projectName: 'my-app', theme: 'nora', primary: '#112233', font: 'none', demo: false, git: false })
    expect(r.yes).toBe(true)
    expect(r.errors).toEqual([])
  })
  it('reports a bad theme by flag name', () => {
    const r = parseCreateArgs(['--theme', 'bad'])
    expect(r.errors).toHaveLength(1)
    expect(r.errors[0]).toContain('--theme')
  })
  it.each(['npm', 'pnpm', 'yarn', 'bun'])('reads --pm %s, spaced and with =', (name) => {
    expect(parseCreateArgs(['--pm', name]).pm).toBe(name)
    expect(parseCreateArgs([`--pm=${name}`]).pm).toBe(name)
    expect(parseCreateArgs(['--pm', name]).errors).toEqual([])
  })
  it('leaves pm unset without the flag, and keeps it out of the answers', () => {
    const r = parseCreateArgs(['my-app', '--pm', 'bun'])
    expect(parseCreateArgs(['my-app']).pm).toBeUndefined()
    expect(r.answers).toEqual({ projectName: 'my-app' })
  })
  it('reports a bad --pm value once, naming the flag, and sets nothing', () => {
    const r = parseCreateArgs(['--pm', 'deno'])
    expect(r.errors).toEqual(['--pm: "deno" is not one of npm, pnpm, yarn, bun.'])
    expect(r.pm).toBeUndefined()
  })
  it('reports --pm with no value', () => {
    expect(parseCreateArgs(['--pm']).errors).toEqual(['--pm: a value is required.'])
  })
})

describe('decideYes: create must never wait for a prompt that nobody can answer', () => {
  it('keeps --yes in any case', () => {
    expect(decideYes(true, false, undefined)).toEqual({ yes: true, problem: null })
    expect(decideYes(true, true, undefined)).toEqual({ yes: true, problem: null })
  })
  it('asks in a terminal, and ignores npm_config_yes there (npx --yes only means "do not ask before downloading")', () => {
    expect(decideYes(false, true, 'true')).toEqual({ yes: false, problem: null })
    expect(decideYes(false, true, undefined)).toEqual({ yes: false, problem: null })
  })
  // npm keeps --yes for itself and exports npm_config_yes=true to the command it runs.
  it('without a terminal, honours npm_config_yes=true', () => {
    expect(decideYes(false, false, 'true')).toEqual({ yes: true, problem: null })
    expect(decideYes(false, undefined, 'true')).toEqual({ yes: true, problem: null })
  })
  it.each([undefined, '', 'false', '1'])('without a terminal, refuses when npm_config_yes is %j', (value) => {
    const r = decideYes(false, false, value)
    expect(r.yes).toBe(false)
    expect(r.problem).toBe(
      'Not running in a terminal, so create-nuxt-primevue cannot ask its questions. Pass --yes to accept the defaults for anything not given by a flag, for example: npm create nuxt-primevue@latest my-app -- --yes',
    )
  })
})
