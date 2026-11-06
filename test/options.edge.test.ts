import { describe, expect, it } from 'vitest'
import { DEFAULTS, parseCreateArgs, validatePrimary, validateProjectName } from '../src/create/options.ts'

// Expected values come from the spec (section 5: flags, defaults, name rules) or are worked by hand.

describe('DEFAULTS (spec: --yes accepts Aura, emerald, Inter, demo on; git on)', () => {
  it('has exactly those values', () => {
    expect(DEFAULTS).toStrictEqual({ theme: 'aura', primary: 'emerald', font: 'inter', demo: true, git: true })
  })
})

describe('validateProjectName messages', () => {
  it('tells the user to give a name when it is empty', () => {
    expect(validateProjectName('')).toContain('Give the project a name')
  })
  it.each(['.', '..'])('says %j is not a folder name to use', (name) => {
    expect(validateProjectName(name)).toContain('not "." or ".."')
  })
  it.each(['a/b', 'a\\b'])('says %j contains a slash', (name) => {
    expect(validateProjectName(name)).toContain('slash')
  })
  it('explains the allowed characters for an unsafe name', () => {
    expect(validateProjectName('My App')).toContain('lowercase letters')
  })
  // npm allows package names up to 214 characters: 214 is fine, 215 is not.
  it('accepts 214 characters and refuses 215', () => {
    expect(validateProjectName('a'.repeat(214))).toBeNull()
    expect(validateProjectName('a'.repeat(215))).toEqual(expect.any(String))
  })
})

describe('validatePrimary', () => {
  // "#" + exactly six hex digits, nothing before or after.
  it.each(['x#112233', '#1122334', '#112233 '])('refuses %j', (v) => {
    expect(validatePrimary(v)).toEqual(expect.any(String))
  })
  it('names the bad value and lists the choices', () => {
    const message = validatePrimary('red') as string
    expect(message).toContain('"red"')
    expect(message).toContain('emerald, blue, violet')
    expect(message).toContain('hex colour')
  })
})

describe('parseCreateArgs', () => {
  it('reads --flag=value for theme, font and primary', () => {
    const r = parseCreateArgs(['--theme=lara', '--font=geist', '--primary=#aabbcc'])
    expect(r.answers).toStrictEqual({ theme: 'lara', font: 'geist', primary: '#aabbcc' })
    expect(r.errors).toEqual([])
  })
  it('reads a value in the next argument when it is the first argument', () => {
    expect(parseCreateArgs(['--theme', 'lara']).answers).toStrictEqual({ theme: 'lara' })
  })
  it.each([
    [['--theme'], '--theme'],
    [['--font'], '--font'],
    [['--primary', '--yes'], '--primary'],
  ])('reports a missing value for %j', (argv, flag) => {
    const r = parseCreateArgs(argv)
    expect(r.errors).toStrictEqual([`${flag}: a value is required.`])
  })
  it('does not take the next flag as a value, and still reads that flag', () => {
    const r = parseCreateArgs(['--theme', '--yes'])
    expect(r.yes).toBe(true)
    expect(r.answers).toStrictEqual({})
  })
  it('keeps a bad theme or font out of the answers and lists the allowed values', () => {
    const t = parseCreateArgs(['--theme', 'bad'])
    expect(t.answers).toStrictEqual({})
    expect(t.errors[0]).toContain('aura, lara, nora, material')
    const f = parseCreateArgs(['--font', 'bad'])
    expect(f.answers).toStrictEqual({})
    expect(f.errors[0]).toContain('inter, geist, none')
  })
  it('keeps a bad colour out of the answers and prefixes the error with --primary', () => {
    const r = parseCreateArgs(['--primary', 'red'])
    expect(r.answers).toStrictEqual({})
    expect(r.errors).toHaveLength(1)
    expect(r.errors[0]).toMatch(/^--primary: "red" is not valid/)
  })
  it('sets demo and git on with --demo and --git', () => {
    expect(parseCreateArgs(['--demo']).answers).toStrictEqual({ demo: true })
    expect(parseCreateArgs(['--git']).answers).toStrictEqual({ git: true })
  })
  it('lets the last of --no-demo / --demo win', () => {
    expect(parseCreateArgs(['--no-demo', '--demo']).answers).toStrictEqual({ demo: true })
    expect(parseCreateArgs(['--no-git', '--git']).answers).toStrictEqual({ git: true })
  })
  it('is not "yes" unless asked, and -y means yes', () => {
    expect(parseCreateArgs([]).yes).toBe(false)
    expect(parseCreateArgs(['-y']).yes).toBe(true)
  })
  it.each(['--bogus', '-x'])('refuses the unknown option %s by name', (arg) => {
    expect(parseCreateArgs([arg]).errors).toStrictEqual([`Unknown option ${arg}.`])
  })
  it('refuses a second project name by name and keeps the first', () => {
    const r = parseCreateArgs(['first', 'second'])
    expect(r.answers.projectName).toBe('first')
    expect(r.errors).toStrictEqual(['Unexpected extra argument "second".'])
  })
})

describe('validateProjectName: names a file system or npm cannot use', () => {
  // Windows reserves these device names, with or without an extension.
  it.each(['con', 'prn', 'aux', 'nul', 'com1', 'com9', 'lpt1', 'lpt9', 'con.txt', 'nul.app'])('refuses the reserved Windows name %j', (name) => {
    expect(validateProjectName(name)).toContain('reserved')
  })
  it.each(['com0', 'lpt0', 'console', 'my-con', 'com10'])('accepts %j', (name) => {
    expect(validateProjectName(name)).toBeNull()
  })
  it('refuses a name that ends with a dot, which Windows drops', () => {
    expect(validateProjectName('trailing.')).toContain('end with')
  })
  it.each(['node_modules', 'favicon.ico'])('refuses %j, which npm does not accept as a package name', (name) => {
    expect(validateProjectName(name)).toContain('npm')
  })
})

describe('parseCreateArgs: help and version', () => {
  it.each(['--help', '-h'])('%s asks for the usage text', (flag) => {
    expect(parseCreateArgs([flag])).toMatchObject({ help: true, errors: [] })
  })
  it('--version asks for the version', () => {
    expect(parseCreateArgs(['--version'])).toMatchObject({ version: true, errors: [] })
  })
  it('are off by default', () => {
    expect(parseCreateArgs(['my-app'])).toMatchObject({ help: false, version: false })
  })
})
