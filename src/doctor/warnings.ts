import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

export const GUIDE = 'https://github.com/kiri1101/create-nuxt-primevue/blob/main/docs/traps.md'

const CONFIGS = ['nuxt.config.ts', 'nuxt.config.mts', 'nuxt.config.js', 'nuxt.config.mjs']
// Where the theme options (and so cssLayer) can live in a Nuxt PrimeVue project.
const THEME_FILES = ['app/theme.ts', 'theme.ts', 'app/theme.js', 'theme.js']

function readIf(file: string): string | null {
  try {
    return existsSync(file) ? readFileSync(file, 'utf8') : null
  } catch {
    return null
  }
}

/** Setup problems that are not licence problems. Read-only. */
export function setupWarnings(dir: string): string[] {
  const warnings: string[] = []
  let pkg: { dependencies?: object; devDependencies?: object }
  try {
    pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'))
  } catch {
    return warnings
  }
  const deps = { ...pkg.dependencies, ...pkg.devDependencies } as Record<string, string>
  const has = (name: string) => name in deps
  const tailwind = has('tailwindcss') || has('@tailwindcss/vite')

  if (has('@primevue/themes')) {
    warnings.push(`@primevue/themes is deprecated; use @primeuix/themes instead (see ${GUIDE}).`)
  }
  if (tailwind && has('primevue') && !has('tailwindcss-primeui')) {
    warnings.push(`Tailwind and PrimeVue are installed without tailwindcss-primeui, so PrimeVue colour utilities such as bg-primary are missing (see ${GUIDE}).`)
  }
  if (tailwind && has('primevue')) {
    const config = CONFIGS.map((f) => readIf(join(dir, f))).find((t) => t !== null)
    if (config !== undefined) {
      const sources = [config, ...THEME_FILES.map((f) => readIf(join(dir, f)))]
      if (!sources.some((t) => t?.includes('cssLayer'))) {
        warnings.push(`Tailwind layers: no cssLayer setting found, so PrimeVue styles may override your Tailwind utilities (see ${GUIDE}).`)
      }
    }
  }
  return warnings
}
