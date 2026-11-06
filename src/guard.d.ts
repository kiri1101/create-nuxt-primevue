declare module '*/check-licences.mjs' {
  export interface Installed {
    name: string
    version: string
    license: unknown
    dir: string
  }
  export interface CheckResult {
    status: 'ok' | 'offenders' | 'missing' | 'nothing-installed' | 'no-prime'
    offenders: Installed[]
    installed: Installed[]
    missing: string[]
  }
  export function isPrimePackage(name: string): boolean
  export function declaredPrimePackages(pkg: object): string[]
  export function requiredPrimePackages(pkg: object): string[]
  export function workspaceRoot(startDir: string): string | undefined
  export function findInstalled(rootDir: string): Installed[]
  export function checkProject(rootDir: string): CheckResult
}
