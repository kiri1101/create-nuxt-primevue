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

export function installArgs(_pm: PackageManager): string[] {
  return ['install']
}

export function scriptArgs(_pm: PackageManager, script: string): string[] {
  return ['run', script]
}
