import type { run } from '../run.ts'

const MESSAGE = 'Initial commit from create-nuxt-primevue'

/**
 * Makes one initial commit so `doctor` can help later.
 * `skipped`: git is missing, the folder is already in a repository, or `git init` failed.
 * `initialised`: a repository exists but the commit failed (usually no git identity).
 * The caller must have written `.gitignore` first.
 */
export async function initRepo(dir: string, runner: typeof run): Promise<'committed' | 'initialised' | 'skipped'> {
  if ((await runner('git', ['--version'], dir, { quiet: true })) !== 0) return 'skipped'
  if ((await runner('git', ['rev-parse', '--is-inside-work-tree'], dir, { quiet: true })) === 0) return 'skipped'
  if ((await runner('git', ['init'], dir, { quiet: true })) !== 0) return 'skipped'
  if ((await runner('git', ['add', '-A'], dir)) !== 0) return 'initialised'
  if ((await runner('git', ['commit', '-m', MESSAGE], dir)) !== 0) return 'initialised'
  return 'committed'
}
