/** Returns a refusal message, or null when it is safe to change the project. */
export function gitGate(isRepo: boolean, porcelain: string, packageJsonTracked: boolean, gitMissing = false): string | null {
  if (gitMissing) {
    return 'git is not installed (or is not on your PATH), and doctor only changes projects under git, so you can undo the change. Install git, commit your work, then run doctor again.'
  }
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
