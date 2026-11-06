import { describe, expect, it } from 'vitest'
import { detectPackageManager } from '../src/pm.ts'

describe('detectPackageManager', () => {
  it.each([
    ['pnpm/9.1.0 npm/? node/v22', 'pnpm', 9],
    ['yarn/4.5.0 npm/? node/v22', 'yarn', 4],
    ['bun/1.1.0', 'bun', 1],
    ['npm/10.8.0 node/v22', 'npm', 10],
    [undefined, 'npm', null],
  ] as const)('%s', (ua, name, major) => {
    expect(detectPackageManager(ua)).toEqual({ name, major })
  })
})
