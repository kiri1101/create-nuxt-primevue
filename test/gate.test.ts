import { describe, expect, it } from 'vitest'
import { gitGate } from '../src/doctor/gate.ts'

describe('gitGate', () => {
  it('refuses outside a git repository', () => {
    expect(gitGate(false, '')).toEqual(expect.any(String))
  })
  it('refuses a dirty tree', () => {
    expect(gitGate(true, ' M package.json\n')).toEqual(expect.any(String))
  })
  it('allows a clean repository', () => {
    expect(gitGate(true, '')).toBeNull()
  })
})
