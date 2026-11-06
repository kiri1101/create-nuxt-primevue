declare module '*/check-licences.mjs' {
  export interface Installed {
    name: string
    version: string
    license: unknown
    dir: string
  }
  export interface CheckResult {
    status: 'ok' | 'offenders' | 'nothing-installed' | 'no-prime'
    offenders: Installed[]
    installed: Installed[]
  }
  export function isPrimePackage(name: string): boolean
  export function declaredPrimePackages(pkg: object): string[]
  export function findInstalled(rootDir: string): Installed[]
  export function checkProject(rootDir: string): CheckResult
}
