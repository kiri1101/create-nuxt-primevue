import { existsSync, rmSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { detectPackageManager, installArgs, scriptArgs } from '../pm.ts'
import { run } from '../run.ts'
import { applyAnswers } from './apply.ts'
import { initRepo } from './git.ts'
import { packageVersion } from '../version.ts'
import { type Answers, DEFAULTS, decideYes, parseCreateArgs, validateProjectName } from './options.ts'
import { askMissing } from './prompts.ts'
import { copyTemplate, ensureEmptyTarget, projectNameProblem } from './scaffold.ts'

// From src/create or dist/create, two levels up is the package root, where `template/` ships.
const TEMPLATE_DIR = fileURLToPath(new URL('../../template', import.meta.url))

export const USAGE = [
  'Usage: create-nuxt-primevue [project-name] [options]',
  '       create-nuxt-primevue doctor [--check | --yes-fix | --version]',
  '',
  'Options:',
  '  --theme <aura|lara|nora|material>   --primary <emerald|blue|violet|#rrggbb>',
  '  --font <inter|geist|none>            --demo / --no-demo    --git / --no-git',
  '  --yes, -y   accept the defaults for anything not given (needed without a terminal)',
  '  --help, -h  show this text        --version   show the version',
].join('\n')

/** Returns the process exit code. */
export async function create(argv: string[]): Promise<number> {
  const { answers: given, yes: yesFlag, help, version, errors } = parseCreateArgs(argv)
  if (errors.length > 0) {
    for (const e of errors) console.error(e)
    return 1
  }
  if (help) {
    console.log(USAGE)
    return 0
  }
  if (version) {
    console.log(packageVersion())
    return 0
  }
  const { yes, problem: promptProblem } = decideYes(yesFlag, process.stdin.isTTY, process.env.npm_config_yes)
  if (promptProblem) {
    console.error(promptProblem)
    return 1
  }

  if (given.projectName !== undefined) {
    const problem = projectNameProblem(given.projectName, process.cwd())
    if (problem) {
      console.error(problem)
      return 1
    }
  }

  let answers: Answers
  if (yes) {
    if (given.projectName === undefined) {
      console.error('Give the project a name: create-nuxt-primevue my-app --yes')
      return 1
    }
    answers = { ...DEFAULTS, ...given, projectName: given.projectName }
  } else {
    const asked = await askMissing(given)
    if (asked === null) return 0
    answers = asked
  }

  const nameProblem = validateProjectName(answers.projectName)
  if (nameProblem) {
    console.error(nameProblem)
    return 1
  }
  const target = resolve(process.cwd(), answers.projectName)
  const targetProblem = ensureEmptyTarget(target)
  if (targetProblem) {
    console.error(targetProblem)
    return 1
  }
  if (!existsSync(TEMPLATE_DIR)) {
    console.error(`The bundled template is missing (${TEMPLATE_DIR}). Reinstall create-nuxt-primevue.`)
    return 1
  }

  const pm = detectPackageManager(process.env.npm_config_user_agent)
  try {
    copyTemplate(TEMPLATE_DIR, target)
    applyAnswers(target, answers, pm)
  } catch (e) {
    // A half-written folder would block a retry, so it is removed.
    rmSync(target, { recursive: true, force: true })
    console.error(`Could not create the project: ${e instanceof Error ? e.message : String(e)}`)
    console.error(`The folder ./${answers.projectName} was removed. Nothing else was changed.`)
    return 1
  }
  console.log(`\n✓ Project created in ./${answers.projectName}`)
  console.log('✓ Prime packages pinned to free MIT versions')

  console.log(`\nInstalling with ${pm.name}...`)
  if ((await run(pm.name, installArgs(pm), target)) !== 0) {
    console.error(`\nInstall failed. The project is kept. To retry:\n  cd ${answers.projectName}\n  ${pm.name} ${installArgs(pm).join(' ')}`)
    return 1
  }

  if ((await run('node', ['scripts/check-licences.mjs'], target)) !== 0) {
    console.error('\nThe licence check failed on the new project. See the message above.')
    return 1
  }
  console.log('✓ Licence check passed')

  if (answers.git) {
    const result = await initRepo(target, run)
    if (result === 'committed') console.log('✓ Git repository created with one initial commit')
    else if (result === 'initialised') console.log('! Git repository created, but the initial commit failed (is your git name and email set?). Nothing was committed.')
    else console.log('- Git skipped (git is missing or this folder is already inside a repository)')
  }

  console.log(`\nNext steps:\n  cd ${answers.projectName}\n  ${pm.name} ${scriptArgs(pm, 'dev').join(' ')}\n`)
  return 0
}
