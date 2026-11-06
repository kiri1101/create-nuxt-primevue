// Licence guard. Plain ESM, Node built-ins only.
// Fails closed: every installed Prime package must declare the exact licence "MIT", and every Prime
// package that package.json depends on must be found installed.
import { existsSync, readdirSync, readFileSync, realpathSync, statSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const GUIDE = 'https://github.com/kiri1101/create-nuxt-primevue/blob/main/docs/traps.md#the-licence-change'

export function isPrimePackage(name) {
  return (
    name === 'primevue' ||
    name === 'primeicons' ||
    name.startsWith('@primevue/') ||
    name.startsWith('@primeuix/')
  )
}

function namesIn(pkg, sections) {
  const names = new Set()
  for (const section of sections) for (const name of Object.keys(pkg[section] ?? {})) names.add(name)
  return [...names].filter(isPrimePackage)
}

/** Prime packages the project depends on in any way, peer and optional ones included. */
export function declaredPrimePackages(pkg) {
  return namesIn(pkg, ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'])
}

/** Prime packages that must be installed: the dependencies and devDependencies. */
export function requiredPrimePackages(pkg) {
  return namesIn(pkg, ['dependencies', 'devDependencies'])
}

/** The parsed object; undefined when the file cannot be read; null when it is there but is not a JSON object. */
function readJson(file) {
  let text
  try {
    text = readFileSync(file).toString()
  } catch {
    return undefined
  }
  // Windows tools add a byte order mark, which npm accepts and JSON.parse does not.
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1)
  try {
    const value = JSON.parse(text)
    return typeof value === 'object' && !Array.isArray(value) ? value : null
  } catch {
    return null
  }
}

/** The real path of something that exists, or undefined when it does not (or is a link that leads nowhere). */
function realPath(path) {
  return existsSync(path) ? realpathSync(path) : undefined
}

function isDirectory(path) {
  return statSync(path, { throwIfNoEntry: false })?.isDirectory() === true
}

/** The names inside a folder, or none when it is not one. Files and broken links among them are harmless: nothing is found in them. */
function subdirs(dir) {
  // Stryker disable next-line ArrayDeclaration: an entry in place of [] names a path that does not exist, where nothing is found.
  return isDirectory(dir) ? readdirSync(dir) : []
}

/**
 * The node_modules folders to walk for a package folder: the one inside it, and the one that holds it when
 * it sits directly in one (pnpm keeps a package's dependencies beside it).
 */
function modulesAround(packageDir) {
  const own = join(packageDir, 'node_modules')
  const parent = dirname(packageDir)
  if (basename(parent) === 'node_modules') return [own, parent]
  const grandparent = dirname(parent)
  if (basename(parent).startsWith('@') && basename(grandparent) === 'node_modules') return [own, grandparent]
  return [own]
}

/**
 * The nearest folder above `startDir` that is a workspace root: it has a pnpm-workspace.yaml, or a
 * package.json with a "workspaces" field. Undefined when there is none.
 */
export function workspaceRoot(startDir) {
  let dir = resolve(startDir)
  for (;;) {
    const parent = dirname(dir)
    if (parent === dir) return undefined
    dir = parent
    if (existsSync(join(dir, 'pnpm-workspace.yaml'))) return dir
    if (readJson(join(dir, 'package.json'))?.workspaces !== undefined) return dir
  }
}

export function findInstalled(rootDir) {
  const found = []
  // Real paths already handled. Links are followed, so this is what stops loops and double reports.
  const visited = new Set()

  function once(path) {
    const real = realPath(path)
    // Stryker disable next-line ConditionalExpression: with the first test false, an undefined path is remembered once and returns undefined all the same.
    if (real === undefined || visited.has(real)) return undefined
    visited.add(real)
    return real
  }

  function visitPackage(dir, folderName) {
    const real = once(dir)
    if (real === undefined) return
    const pkg = readJson(join(real, 'package.json'))
    if (pkg === null) {
      // A package.json that cannot be parsed: trust the folder name rather than skip it.
      if (isPrimePackage(folderName)) found.push({ name: folderName, version: '', license: undefined, dir })
    } else if (pkg && typeof pkg.name === 'string' && isPrimePackage(pkg.name)) {
      found.push({ name: pkg.name, version: String(pkg.version ?? ''), license: pkg.license, dir })
    }
    for (const modulesDir of modulesAround(real)) walkModules(modulesDir)
  }

  function walkModules(modulesDir) {
    if (once(modulesDir) === undefined) return
    for (const name of subdirs(modulesDir)) {
      const dir = join(modulesDir, name)
      if (name === '.bin' || name === '.cache') continue
      if (name.startsWith('.')) {
        // Package stores: pnpm (.pnpm), Bun (.bun), Yarn (.store), and the like.
        for (const store of subdirs(dir)) walkModules(join(dir, store, 'node_modules'))
      } else if (name.startsWith('@')) {
        for (const scoped of subdirs(dir)) visitPackage(join(dir, scoped), `${name}/${scoped}`)
      } else {
        visitPackage(dir, name)
      }
    }
  }

  walkModules(join(rootDir, 'node_modules'))
  // In a workspace, Node also resolves packages from the root's node_modules, where installs hoist them.
  const workspace = workspaceRoot(rootDir)
  if (workspace !== undefined) walkModules(join(workspace, 'node_modules'))
  return found
}

export function checkProject(rootDir) {
  const pkg = readJson(join(rootDir, 'package.json')) ?? {}
  const declared = declaredPrimePackages(pkg)
  const required = requiredPrimePackages(pkg)
  const installed = findInstalled(rootDir)
  const offenders = installed.filter((p) => p.license !== 'MIT')
  const present = new Set(installed.map((p) => p.name))
  const missing = required.filter((name) => !present.has(name))
  let status
  if (installed.length === 0) {
    if (required.length > 0) status = 'nothing-installed'
    else status = declared.length > 0 ? 'ok' : 'no-prime'
  } else if (offenders.length > 0) status = 'offenders'
  else status = missing.length > 0 ? 'missing' : 'ok'
  return { status, offenders, installed, missing }
}

function describeLicence(license) {
  return license === undefined ? '(none declared)' : JSON.stringify(license)
}

function main() {
  const rootDir = resolve(fileURLToPath(new URL('..', import.meta.url)))
  const { status, offenders, installed, missing } = checkProject(rootDir)
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
  if (status === 'missing') {
    console.error('Licence check FAILED: these Prime packages are declared in package.json but were not found installed, so they could not be verified:')
    for (const name of missing) console.error(`  ${name}`)
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
