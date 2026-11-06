import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { workspaceRoot } from '../template/scripts/check-licences.mjs'
import { readPackageJson } from './package-json.ts'
export type PackageManager = { name: 'npm' | 'pnpm' | 'yarn' | 'bun'; major: number | null }

const NAMES = ['npm', 'pnpm', 'yarn', 'bun'] as const

/** Reads `npm_config_user_agent`, e.g. `pnpm/9.1.0 npm/? node/v22`. Unknown or missing means npm. */
export function detectPackageManager(userAgent: string | undefined): PackageManager {
  // Stryker disable next-line StringLiteral: any text that is not a manager name gives the same npm result, and split() always returns a first element, so neither fallback string is observable.
  const first = (userAgent ?? '').split(' ')[0] ?? ''
  const [name, version] = first.split('/')
  const found = NAMES.find((n) => n === name)
  if (!found) return { name: 'npm', major: null }
  // Stryker disable next-line StringLiteral: parseInt of '' and of any non-numeric text are both NaN, so the fallback string cannot change the result.
  const major = Number.parseInt(version ?? '', 10)
  return { name: found, major: Number.isNaN(major) ? null : major }
}

/**
 * The manager for a new project: `--pm` when given, else the user agent. bunx does not tell the CLI who launched
 * it, so `--pm bun` is the only way to get Bun. Yarn's major comes from the user agent when it is Yarn's; with
 * `--pm yarn` and none, it is taken as Yarn 2+ (what `yarn dlx` runs), so `.yarnrc.yml` is written.
 */
export function packageManagerFor(flag: PackageManager['name'] | undefined, userAgent: string | undefined): PackageManager {
  const detected = detectPackageManager(userAgent)
  if (flag === undefined) return detected
  if (flag === 'yarn') return { name: 'yarn', major: detected.name === 'yarn' && detected.major !== null ? detected.major : 2 }
  return { name: flag, major: detected.name === flag ? detected.major : null }
}

export function installArgs(_pm: PackageManager): string[] {
  return ['install']
}

export function scriptArgs(_pm: PackageManager, script: string): string[] {
  return ['run', script]
}

const LOCKFILES: [string, PackageManager['name']][] = [
  ['pnpm-lock.yaml', 'pnpm'],
  ['yarn.lock', 'yarn'],
  ['bun.lock', 'bun'],
  ['bun.lockb', 'bun'],
  ['package-lock.json', 'npm'],
]

/** `pnpm@9.1.0+sha512...` (the field corepack reads) as a package manager, or undefined when it is not one of the four. */
function fromPackageManagerField(value: unknown): PackageManager | undefined {
  const match = /^(npm|pnpm|yarn|bun)@(\d+)/.exec(String(value))
  return match ? { name: match[1] as PackageManager['name'], major: Number(match[2]) } : undefined
}

/**
 * Which package manager a project uses: its `packageManager` field, then its lockfile; npx always reports npm.
 * A workspace member keeps neither of its own, so the workspace root is looked at too. With neither anywhere,
 * the manager that ran us.
 */
export function projectPackageManager(dir: string, userAgent: string | undefined): PackageManager {
  const root = workspaceRoot(dir)
  const folders = root === undefined ? [dir] : [dir, root]
  // Innermost folder first, and in each folder the field before the lockfile.
  for (const folder of folders) {
    const declared = fromPackageManagerField(readPackageJson(folder)?.packageManager)
    if (declared) return declared
    for (const [file, name] of LOCKFILES) if (existsSync(join(folder, file))) return { name, major: null }
  }
  return detectPackageManager(userAgent)
}
