export type PackageManager = { name: 'npm' | 'pnpm' | 'yarn' | 'bun'; major: number | null }

const NAMES = ['npm', 'pnpm', 'yarn', 'bun'] as const

/** Reads `npm_config_user_agent`, e.g. `pnpm/9.1.0 npm/? node/v22`. Unknown or missing means npm. */
export function detectPackageManager(userAgent: string | undefined): PackageManager {
  const first = (userAgent ?? '').split(' ')[0] ?? ''
  const [name, version] = first.split('/')
  const found = NAMES.find((n) => n === name)
  if (!found) return { name: 'npm', major: null }
  const major = Number.parseInt(version ?? '', 10)
  return { name: found, major: Number.isNaN(major) ? null : major }
}

export function installArgs(_pm: PackageManager): string[] {
  return ['install']
}

export function scriptArgs(_pm: PackageManager, script: string): string[] {
  return ['run', script]
}
