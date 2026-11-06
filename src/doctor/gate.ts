/** Returns a refusal message, or null when it is safe to change the project. */
export function gitGate(isRepo: boolean, porcelain: string, packageJsonTracked: boolean): string | null {
  if (!isRepo) {
    return 'This folder is not a git repository. doctor only changes projects under git, so you can undo the change. Run "git init" and commit your work first.'
  }
  if (porcelain.trim() !== '') {
    return 'Your git working tree has uncommitted changes. Commit or stash them first, so the fix is the only change and easy to undo.'
  }
  if (!packageJsonTracked) {
    return 'package.json is not tracked by git (the folder may be ignored by a parent repository), so "git checkout ." could not undo the change. Track it with git first.'
  }
  return null
}
