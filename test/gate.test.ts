import { describe, expect, it } from 'vitest'
import { gitGate } from '../src/doctor/gate.ts'

describe('gitGate', () => {
  it('refuses outside a git repository', () => {
    expect(gitGate(false, '', false)).toEqual(expect.any(String))
  })
  it('refuses a dirty tree', () => {
    expect(gitGate(true, ' M package.json\n', true)).toEqual(expect.any(String))
  })
  it('refuses a clean repository whose package.json git does not track', () => {
    expect(gitGate(true, '', false)).toContain('not tracked')
  })
  it('allows a clean repository', () => {
    expect(gitGate(true, '', true)).toBeNull()
  })
})

describe('gitGate: git is not installed', () => {
  // Without git, "run git init" would be useless advice.
  it('says git is missing, not that the folder is not a repository', () => {
    const message = gitGate(false, '', false, true)
    expect(message).toContain('git is not installed')
    expect(message).not.toContain('git init')
  })
  it('still says "not a git repository" when git is there', () => {
    expect(gitGate(false, '', false, false)).toContain('not a git repository')
  })
})
