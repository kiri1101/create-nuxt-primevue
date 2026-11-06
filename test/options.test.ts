import { describe, expect, it } from 'vitest'
import { parseCreateArgs, validatePrimary, validateProjectName } from '../src/create/options.ts'

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
})
