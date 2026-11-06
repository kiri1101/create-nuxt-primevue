import * as p from '@clack/prompts'
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { checkProject } from '../../template/scripts/check-licences.mjs'
import { installArgs, projectPackageManager, scriptArgs, type PackageManager } from '../pm.ts'
import { capture, run } from '../run.ts'
import { gitGate } from './gate.ts'
import { GUARD_COMMAND, GUARD_FILE, addGuard, guardProblem, guardUndo } from './guard.ts'
import { applyChanges, indirectLines, planFix, undoAdvice } from './plan.ts'
import { parsePackageJson } from '../package-json.ts'
import { packageVersion } from '../version.ts'
import { setupWarnings } from './warnings.ts'

// From src/doctor or dist/doctor, two levels up is the package root, where `template/` ships.
const GUARD_SOURCE = fileURLToPath(new URL('../../template/scripts/check-licences.mjs', import.meta.url))

const log = (line = '') => console.log(line)

/** True only for a yes. A cancel (Ctrl-C) is reported separately by `askLicenceKey`. */
async function confirm(message: string): Promise<boolean> {
  const answer = await p.confirm({ message, initialValue: false })
  return answer === true
}

async function gateProblem(dir: string): Promise<string | null> {
  const inside = await capture('git', ['rev-parse', '--is-inside-work-tree'], dir)
  const isRepo = inside.code === 0 && inside.stdout.trim() === 'true'
  const status = isRepo ? await capture('git', ['status', '--porcelain'], dir) : { code: 0, stdout: '' }
  const tracked = isRepo && (await capture('git', ['ls-files', '--error-unmatch', 'package.json'], dir)).code === 0
  // If git status itself fails we cannot prove the tree is clean, so treat it as not clean.
  return gitGate(isRepo, status.code === 0 ? status.stdout : 'unknown', tracked, inside.code === 127)
}

async function offerGuard(dir: string, fixedWith: PackageManager | null): Promise<void> {
  const file = join(dir, 'package.json')
  const text = readFileSync(file, 'utf8')
  const problem = guardProblem(text, existsSync(join(dir, GUARD_FILE)))
  if (problem) return log(`- ${problem}`)
  const edit = addGuard(text)
  log('\nThe licence guard fails your build if a non-MIT Prime package is ever installed. Adding it will:')
  log(`  copy ${GUARD_FILE}`)
  log('  change the "build" script in package.json (nothing else in the file changes):')
  log(`    - "build": ${JSON.stringify(edit.before)}`)
  log(`    + "build": ${JSON.stringify(edit.after)}`)
  log(`  add the script "check:licences": ${JSON.stringify(GUARD_COMMAND)}`)
  if (!(await confirm('Add the licence guard to this project?'))) return log('- Guard not added.')
  mkdirSync(join(dir, 'scripts'), { recursive: true })
  copyFileSync(GUARD_SOURCE, join(dir, GUARD_FILE))
  writeFileSync(file, edit.text)
  log('✓ Licence guard added. ' + guardUndo(fixedWith))
}

/** Returns the process exit code: 0 fine, 1 a problem remains, 2 the project could not be scanned. */
export async function doctor(argv: string[], cwd: string = process.cwd()): Promise<number> {
  if (argv.includes('--help') || argv.includes('-h')) {
    log('Usage: create-nuxt-primevue doctor [--check | --yes-fix | --version]')
    return 0
  }
  if (argv.includes('--version')) {
    log(packageVersion())
    return 0
  }
  const unknown = argv.filter((a) => a !== '--check' && a !== '--yes-fix')
  if (unknown.length > 0) {
    console.error(`Unknown option ${unknown[0]}. Usage: create-nuxt-primevue doctor [--check | --yes-fix | --version]`)
    return 2
  }
  const check = argv.includes('--check')
  const yesFix = argv.includes('--yes-fix')

  const pkgFile = join(cwd, 'package.json')
  if (!existsSync(pkgFile)) {
    console.error('No package.json here. Run doctor from the root of your project.')
    return 2
  }
  let pkg: object
  try {
    pkg = parsePackageJson(readFileSync(pkgFile, 'utf8')) as object
  } catch {
    console.error('package.json is not valid JSON.')
    return 2
  }

  const result = checkProject(cwd)
  const warnings = setupWarnings(cwd)
  const printWarnings = () => {
    for (const w of warnings) log(`⚠ ${w}`)
  }

  if (result.status === 'no-prime') {
    log('No Prime packages were found in this project, so there is no licence problem to check.')
    printWarnings()
    return 0
  }
  if (result.status === 'nothing-installed') {
    if (existsSync(join(cwd, '.pnp.cjs')) && !existsSync(join(cwd, 'node_modules'))) {
      console.error('This looks like a Yarn Plug\'n\'Play project: there is no node_modules folder to read, so the licences cannot be checked.')
      console.error('Set "nodeLinker: node-modules" in .yarnrc.yml, reinstall, and run doctor again.')
    } else {
      console.error('Prime packages are declared in package.json but none are installed, so nothing could be checked.')
      console.error('Install your dependencies first (for example "npm install"), then run doctor again.')
    }
    return 1
  }
  if (result.status === 'missing') {
    console.error('These Prime packages are declared in package.json but were not found installed, so they could not be checked:')
    for (const name of result.missing) console.error(`  ${name}`)
    console.error('Install your dependencies first (for example "npm install"), then run doctor again.')
    return 1
  }
  if (result.status === 'ok') {
    log(`✓ ${result.installed.length} Prime package(s) installed, all on the MIT licence.`)
    printWarnings()
    if (check || !process.stdin.isTTY) return 0
    const problem = await gateProblem(cwd)
    if (problem === null) await offerGuard(cwd, null)
    else log(`- The licence guard was not offered: ${problem}`)
    return 0
  }

  // Offenders.
  for (const o of result.offenders) {
    log(`✗ ${o.name} ${o.version}  licence: ${o.license === undefined ? '(none declared)' : JSON.stringify(o.license)}  (not MIT)`)
  }
  printWarnings()
  if (check) return 1
  if (!yesFix && !process.stdin.isTTY) {
    console.error('Not running in a terminal, so doctor cannot ask. Use "doctor --check" to scan, or "doctor --yes-fix" to apply the fix.')
    return 1
  }

  if (!yesFix) {
    const answer = await p.confirm({ message: 'Do you have a PrimeUI licence key?', initialValue: false })
    if (p.isCancel(answer)) {
      log('Cancelled. Nothing was changed.')
      return 1
    }
    if (answer) {
      log('Nothing to fix: your licence covers these packages.')
      return 0
    }
  }

  const { changes, manual, indirect } = planFix(pkg, result.offenders)
  const steps = changes.length === 0 ? [...manual, ...indirectLines(indirect, false)] : manual
  if (steps.length > 0) {
    log('\nThese need manual steps:')
    for (const m of steps) log(`  - ${m}`)
  }
  if (changes.length === 0) {
    log('\ndoctor has no automatic fix for this project.')
    return 1
  }
  log('\nProposed fix:')
  for (const c of changes) log(`  ${c.name.padEnd(24)} ${c.from} → ${c.to}   (${c.section})`)
  log('\n⚠ Going back to v4 can break code that uses v5-only features.')
  for (const line of indirectLines(indirect, true)) log(line)

  const problem = await gateProblem(cwd)
  if (problem) {
    console.error(`\n${problem}`)
    return 1
  }
  if (!yesFix && !(await confirm('Apply?'))) {
    log('No changes made.')
    return 1
  }

  const pm = projectPackageManager(cwd, process.env.npm_config_user_agent)
  const undo = undoAdvice(pm)
  writeFileSync(pkgFile, applyChanges(readFileSync(pkgFile, 'utf8'), changes))
  log('✓ Pins updated in package.json')

  if ((await run(pm.name, installArgs(pm), cwd)) !== 0) {
    console.error(`✗ Install failed. ${undo}`)
    return 1
  }
  log('✓ Installed')

  const scripts = (parsePackageJson(readFileSync(pkgFile, 'utf8')) as { scripts?: Record<string, string> }).scripts ?? {}
  if (scripts.build !== undefined) {
    if ((await run(pm.name, scriptArgs(pm, 'build'), cwd)) !== 0) {
      console.error(`✗ The build failed after the change. Code written for v5 may not build on v4. ${undo}`)
      return 1
    }
    log('✓ Build passes')
  } else {
    log('- No build script, so the build step was skipped.')
  }

  const after = checkProject(cwd)
  if (after.status !== 'ok') {
    console.error('✗ The licence check still fails:')
    for (const o of after.offenders) console.error(`    ${o.name} ${o.version}  licence: ${JSON.stringify(o.license)}`)
    if (after.status === 'nothing-installed') console.error('    Nothing could be verified: no Prime packages are installed.')
    const stillIndirect = indirect.filter((i) => after.offenders.some((o) => o.name === i.name))
    for (const line of indirectLines(stillIndirect, false)) console.error(`    ${line}`)
    for (const name of after.missing) console.error(`    ${name} is declared but was not found installed.`)
    console.error(undo)
    return 1
  }
  log('✓ Licence check passes')
  log('Nothing was committed. Review the change with "git diff". ' + undo)

  if (!yesFix) await offerGuard(cwd, pm)
  return 0
}
