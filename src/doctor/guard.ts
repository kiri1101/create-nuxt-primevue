import type { PackageManager } from '../pm.ts'
import { members, skipWs } from './plan.ts'

export const GUARD_FILE = 'scripts/check-licences.mjs'
export const GUARD_COMMAND = 'node scripts/check-licences.mjs'

type Member = ReturnType<typeof members>[number]

/** The top-level scripts and the build script, found by scanning the text (nothing is re-serialised). */
function locate(text: string): { scripts: Member[]; build: Member } | null {
  const scripts = members(text, skipWs(text, 0)).find((m) => m.key === 'scripts')
  if (!scripts || text[scripts.start] !== '{') return null
  const list = members(text, scripts.start)
  const build = list.find((m) => m.key === 'build')
  return build ? { scripts: list, build } : null
}

const valueOf = (text: string, m: Member): unknown => JSON.parse(text.slice(m.start, m.end))

/**
 * How to take the guard out again. After a fix nothing is committed, so checking out package.json would also
 * revert the pins and leave v5 declared with v4 installed; then the script entries are removed by hand, or
 * everything is undone. `fixedWith` is the package manager of a fix just made, or null when there was none.
 */
export function guardUndo(fixedWith: PackageManager | null): string {
  if (fixedWith === null) return `To remove the guard again, run "git checkout package.json" and delete ${GUARD_FILE}.`
  return `To remove the guard again, delete ${GUARD_FILE}, take "${GUARD_COMMAND} && " out of the "build" script and delete the "check:licences" script in package.json. Or undo everything: run "git checkout ." and then "${fixedWith.name} install".`
}

/** Returns why the guard must not be added to this package.json, or null when it can be. */
export function guardProblem(text: string, guardFileExists: boolean): string | null {
  if (guardFileExists) return `${GUARD_FILE} already exists, so it was not overwritten.`
  const found = locate(text)
  if (!found) {
    return `Your package.json has no "build" script, so there is nothing to put the guard in front of. Add "${GUARD_COMMAND}" to your build step yourself.`
  }
  const build = valueOf(text, found.build)
  if (typeof build !== 'string') return `The "build" script in your package.json is not a string, so the guard was not added. Add "${GUARD_COMMAND}" to your build step yourself.`
  if (found.scripts.some((m) => m.key === 'check:licences')) {
    return 'Your package.json already has a "check:licences" script, so the guard was not added.'
  }
  if (build.includes('check-licences')) return 'Your "build" script already calls a check-licences script, so the guard was not added.'
  return null
}

/**
 * Puts the guard in front of the build script and adds a `check:licences` script after it.
 * Only those two places change: every other byte of the file is kept, the existing build value included
 * (the prefix goes right after its opening quote, so an escape sequence in it is not re-encoded).
 */
export function addGuard(text: string): { text: string; before: string; after: string } {
  const found = locate(text)
  if (!found) throw new Error('Your package.json has no "build" script.')
  const before = valueOf(text, found.build) as string
  const after = `${GUARD_COMMAND} && ${before}`

  // A new member copies the line indentation and line ending of "build"; on a one-line object it follows inline.
  const lineStart = text.lastIndexOf('\n', found.build.keyStart) + 1
  const lead = text.slice(lineStart, found.build.keyStart)
  const eol = text[lineStart - 2] === '\r' ? '\r\n' : '\n'
  const separator = /^[ \t]*$/.test(lead) ? `,${eol}${lead}` : ', '
  const added = `${separator}"check:licences": ${JSON.stringify(GUARD_COMMAND)}`

  return {
    text: text.slice(0, found.build.start + 1) + `${GUARD_COMMAND} && ` + text.slice(found.build.start + 1, found.build.end) + added + text.slice(found.build.end),
    before,
    after,
  }
}
