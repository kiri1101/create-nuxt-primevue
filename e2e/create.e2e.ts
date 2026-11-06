import { describe, it } from 'vitest'
import { checkDefaultCreate } from './helpers.ts'

describe('create, from the packed tarball', () => {
  it('default: creates a project with .gitignore, one commit, no node_modules in git, and a passing build', checkDefaultCreate)
})
