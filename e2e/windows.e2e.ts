import { describe, it } from 'vitest'
import { checkDefaultCreate } from './helpers.ts'

// Run by path from the Windows CI job (E2E_WINDOWS=1); left out of the normal run, where create.e2e.ts covers it.
describe('create on Windows, from the packed tarball', () => {
  it('default: creates a project with .gitignore, one commit, no node_modules in git, and a passing build', checkDefaultCreate)
})
