import type { Installed } from '../../template/scripts/check-licences.mjs'
import type { PackageManager } from '../pm.ts'

/** The last MIT versions. `@primevue/*` means every package in that scope. */
export const PINS = {
  primevue: '4.5.5',
  '@primevue/*': '4.5.5',
  '@primeuix/themes': '2.0.3',
  primeicons: '7.0.0',
} as const

export type Change = { section: 'dependencies' | 'devDependencies'; name: string; from: string; to: string }

const SECTIONS = ['dependencies', 'devDependencies'] as const

function pinFor(name: string): string | undefined {
  if (name === 'primevue') return PINS.primevue
  if (name.startsWith('@primevue/')) return PINS['@primevue/*']
  if (name === '@primeuix/themes') return PINS['@primeuix/themes']
  if (name === 'primeicons') return PINS.primeicons
  return undefined
}

function mentionsPrime(value: unknown): boolean {
  if (value === null || typeof value !== 'object') return false
  return Object.entries(value).some(([key, v]) => {
    const bare = key.replace(/@[^@/]*$/, '') // "primevue@5" -> "primevue"
    return bare === 'primevue' || bare === 'primeicons' || bare.startsWith('@primevue/') || bare.startsWith('@primeuix/') || mentionsPrime(v)
  })
}

/**
 * Decides which direct pins can be rewritten safely. Anything else direct becomes manual steps. Offenders that
 * are not direct dependencies come in through the direct ones, so they are listed apart as `indirect`.
 */
export function planFix(pkg: object, offenders: Installed[]): { changes: Change[]; manual: string[]; indirect: Installed[] } {
  const p = pkg as Record<string, Record<string, unknown> | undefined>
  const overrides = [p.overrides, p.resolutions, (p.pnpm as Record<string, unknown> | undefined)?.overrides]
  if (overrides.some(mentionsPrime)) {
    return {
      changes: [],
      indirect: [],
      manual: [
        'Your package.json has "overrides" or "resolutions" that mention a Prime package. They decide which versions install, so they must be edited by hand: remove or change those entries, then reinstall.',
      ],
    }
  }

  const changes: Change[] = []
  const manual: string[] = []
  const indirect: Installed[] = []
  const seen = new Set<string>()
  for (const offender of offenders) {
    if (seen.has(offender.name)) continue
    seen.add(offender.name)

    const sections = SECTIONS.filter((s) => typeof p[s]?.[offender.name] === 'string')
    const to = pinFor(offender.name)
    if (sections.length === 0) {
      indirect.push(offender)
    } else if (to === undefined) {
      manual.push(`${offender.name}@${offender.version} is a direct dependency with no automatic fix. Replace it by hand, or remove it if you do not need it.`)
    } else {
      for (const section of sections) {
        const from = p[section]![offender.name] as string
        if (from === to) {
          manual.push(`${offender.name} is already pinned to ${to} in ${section}, but ${offender.version} is installed. Delete node_modules and your lockfile entry for it, then reinstall.`)
        } else {
          changes.push({ section, name: offender.name, from, to })
        }
      }
    }
  }
  return { changes, manual, indirect }
}

export function indirectStep(o: Installed): string {
  return `${o.name}@${o.version} is not a direct dependency. Another package brings it in; find which one (for example with "npm ls ${o.name}") and move that package to a version that uses the free v4 line.`
}

/** What doctor prints for offenders that are not direct dependencies. */
export function indirectLines(indirect: Installed[], hasChanges: boolean): string[] {
  if (indirect.length === 0) return []
  if (!hasChanges) return indirect.map(indirectStep)
  const names = indirect.map((o) => `${o.name}@${o.version}`).join(', ')
  return [`These also come in through the packages above, so they should be gone after the install (the check afterwards confirms it): ${names}.`]
}

/** git does not track node_modules, so checking out package.json and the lockfile alone leaves the new versions installed. */
export function undoAdvice(pm: PackageManager): string {
  return `To undo the change, run "git checkout ." and then "${pm.name} install": git does not track node_modules, so it still holds the new versions until you reinstall.`
}

// A minimal JSON scanner, so a version can be replaced in place without re-serialising the file.
export function skipWs(t: string, i: number): number {
  // Stryker disable next-line ConditionalExpression,EqualityOperator: past the end t[i] is undefined, which is not whitespace, so the bound is redundant.
  while (i < t.length && /[\s﻿]/.test(t[i]!)) i++
  return i
}
function stringEnd(t: string, i: number): number {
  i++
  while (t[i] !== '"') {
    // Stryker disable next-line EqualityOperator: at i === t.length the loop reads undefined and reaches the same throw one step later.
    if (i >= t.length) throw new Error('package.json is not valid JSON.')
    i += t[i] === '\\' ? 2 : 1
  }
  return i + 1
}
function valueEnd(t: string, i: number): number {
  if (t[i] === '"') return stringEnd(t, i)
  if (t[i] === '{' || t[i] === '[') {
    let depth = 0
    // Stryker disable next-line EqualityOperator: at i === t.length c is undefined, nothing changes, and the loop ends into the same throw.
    while (i < t.length) {
      const c = t[i]!
      if (c === '"') {
        i = stringEnd(t, i)
        continue
      }
      if (c === '{' || c === '[') depth++
      if (c === '}' || c === ']') depth--
      i++
      if (depth === 0) return i
    }
    throw new Error('package.json is not valid JSON.')
  }
  // Stryker disable next-line EqualityOperator: a scalar that runs to the end of the text is followed by a missing closing brace, which throws the same error either way.
  while (i < t.length && !/[\s,}\]]/.test(t[i]!)) i++
  return i
}
export function members(t: string, objStart: number): { key: string; keyStart: number; start: number; end: number }[] {
  // Stryker disable next-line ArrayDeclaration: an extra non-object entry has no key, so the lookups by key never match it.
  const out: { key: string; keyStart: number; start: number; end: number }[] = []
  let i = skipWs(t, objStart + 1)
  while (t[i] !== '}') {
    if (t[i] !== '"') throw new Error('package.json is not valid JSON.')
    const keyStart = i
    const keyEnd = stringEnd(t, i)
    const key = JSON.parse(t.slice(i, keyEnd)) as string
    i = skipWs(t, keyEnd)
    if (t[i] !== ':') throw new Error('package.json is not valid JSON.')
    const start = skipWs(t, i + 1)
    const end = valueEnd(t, start)
    out.push({ key, keyStart, start, end })
    i = skipWs(t, end)
    if (t[i] === ',') i = skipWs(t, i + 1)
  }
  return out
}

/** Replaces only the version strings named in `changes`; every other byte of the file is kept. */
export function applyChanges(packageJsonText: string, changes: Change[]): string {
  let text = packageJsonText
  for (const change of changes) {
    const top = members(text, skipWs(text, 0))
    const section = top.find((m) => m.key === change.section)
    const entry = section && text[section.start] === '{' ? members(text, section.start).find((m) => m.key === change.name) : undefined
    if (!entry || JSON.parse(text.slice(entry.start, entry.end)) !== change.from) {
      throw new Error(`Could not find "${change.name}": "${change.from}" in ${change.section}.`)
    }
    text = text.slice(0, entry.start) + JSON.stringify(change.to) + text.slice(entry.end)
  }
  return text
}
