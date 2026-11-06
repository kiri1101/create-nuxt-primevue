/** Returns a refusal message, or null when it is safe to change the project. */
export function gitGate(isRepo: boolean, porcelain: string): string | null {
  if (!isRepo) {
    return 'This folder is not a git repository. doctor only changes projects under git, so you can undo the change. Run "git init" and commit your work first.'
  }
  if (porcelain.trim() !== '') {
    return 'Your git working tree has uncommitted changes. Commit or stash them first, so the fix is the only change and easy to undo.'
  }
  return null
}
