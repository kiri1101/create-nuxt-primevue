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
