// Licence guard. Plain ESM, Node built-ins only.
// Fails closed: every installed Prime package must declare the exact licence "MIT".
import { readdirSync, readFileSync, realpathSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const GUIDE = 'https://github.com/kiri1101/create-nuxt-primevue/blob/main/docs/traps.md'

export function isPrimePackage(name) {
  return (
    name === 'primevue' ||
    name === 'primeicons' ||
    name.startsWith('@primevue/') ||
    name.startsWith('@primeuix/')
  )
}

export function declaredPrimePackages(pkg) {
  const names = new Set([
    ...Object.keys(pkg.dependencies ?? {}),
    ...Object.keys(pkg.devDependencies ?? {}),
  ])
  return [...names].filter(isPrimePackage)
}

function readJson(file) {
  try {
    return JSON.parse(readFileSync(file, 'utf8'))
  } catch {
    return null
  }
}

function subdirs(dir) {
  try {
    // Dirent.isDirectory() is false for symlinks and junctions, so links are never followed.
    return readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory())
  } catch {
    return []
  }
}

export function findInstalled(rootDir) {
  const found = []
  const seen = new Set()

  function visitPackage(dir) {
    const pkg = readJson(join(dir, 'package.json'))
    if (pkg && typeof pkg.name === 'string' && isPrimePackage(pkg.name) && !seen.has(dir)) {
      seen.add(dir)
      found.push({ name: pkg.name, version: String(pkg.version ?? ''), license: pkg.license, dir })
    }
    walkModules(join(dir, 'node_modules'))
  }

  function walkModules(modulesDir) {
    for (const entry of subdirs(modulesDir)) {
      const dir = join(modulesDir, entry.name)
      if (entry.name === '.bin' || entry.name === '.cache') continue
      if (entry.name.startsWith('.')) {
        // Package stores: pnpm (.pnpm), Bun (.bun), Yarn (.store), and the like.
        for (const store of subdirs(dir)) walkModules(join(dir, store.name, 'node_modules'))
      } else if (entry.name.startsWith('@')) {
        for (const scoped of subdirs(dir)) visitPackage(join(dir, scoped.name))
      } else {
        visitPackage(dir)
      }
    }
  }

  walkModules(join(rootDir, 'node_modules'))
  return found
}

export function checkProject(rootDir) {
  const pkg = readJson(join(rootDir, 'package.json')) ?? {}
  const declared = declaredPrimePackages(pkg)
  const installed = findInstalled(rootDir)
  const offenders = installed.filter((p) => p.license !== 'MIT')
  let status
  if (installed.length === 0) status = declared.length > 0 ? 'nothing-installed' : 'no-prime'
  else status = offenders.length > 0 ? 'offenders' : 'ok'
  return { status, offenders, installed }
}

function describeLicence(license) {
  return license === undefined ? '(none declared)' : JSON.stringify(license)
}

function main() {
  const rootDir = resolve(fileURLToPath(new URL('..', import.meta.url)))
  const { status, offenders, installed } = checkProject(rootDir)
  if (status === 'ok') {
    console.log(`Licence check passed: ${installed.length} Prime package(s), all MIT.`)
    return 0
  }
  if (status === 'no-prime') {
    console.log('Licence check: no Prime packages declared or installed.')
    return 0
  }
  if (status === 'nothing-installed') {
    console.error('Licence check FAILED: Prime packages are declared but none are installed, so nothing could be verified.')
    console.error('Run your package manager install, then try again.')
    console.error(`Guide: ${GUIDE}`)
    return 1
  }
  console.error('Licence check FAILED: these Prime packages are not on the MIT licence:')
  for (const p of offenders) {
    console.error(`  ${p.name}@${p.version}  licence: ${describeLicence(p.license)}  (${p.dir})`)
  }
  console.error(`How to go back to free versions: ${GUIDE}`)
  return 1
}

function runDirectly() {
  if (!process.argv[1]) return false
  const self = fileURLToPath(import.meta.url)
  try {
    // Node realpaths the module URL but not argv[1], so compare real paths.
    return realpathSync(resolve(process.argv[1])) === realpathSync(self)
  } catch {
    return resolve(process.argv[1]) === self
  }
}

if (runDirectly()) {
  process.exit(main())
}
