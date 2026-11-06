import pkg from '~~/package.json'

// The demo page reads the installed packages, so what it shows is what is really there. primevue has no
// "./package.json" export to import, so the manifests are read as files.
const manifests = import.meta.glob<{ version?: string; license?: unknown }>(
  '/node_modules/{primevue,@primevue/nuxt-module,@primeuix/themes,primeicons}/package.json',
  { eager: true, import: 'default' },
)
const NAMES = ['primevue', '@primevue/nuxt-module', '@primeuix/themes', 'primeicons']

export interface LicenceRow {
  name: string
  version: string
  /** The installed package's licence, or null when it could not be read here (then nothing is claimed). */
  licence: string | null
}

export function useProofLicences() {
  const declared = pkg.dependencies as Record<string, string>
  const rows: LicenceRow[] = NAMES.filter((name) => declared[name]).map((name) => {
    const manifest = manifests[`/node_modules/${name}/package.json`]
    const licence = manifest?.license === undefined ? null : typeof manifest.license === 'string' ? manifest.license : JSON.stringify(manifest.license)
    return { name, version: manifest?.version ?? (declared[name] as string), licence }
  })
  return {
    rows,
    /** True only when every row was read and is exactly MIT. */
    allMit: rows.length > 0 && rows.every((row) => row.licence === 'MIT'),
    version: (name: string) => rows.find((row) => row.name === name)?.version,
  }
}
