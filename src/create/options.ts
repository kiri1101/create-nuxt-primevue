export const THEMES = ['aura', 'lara', 'nora', 'material'] as const
export const COLOURS = ['emerald', 'blue', 'violet'] as const
export const FONTS = ['inter', 'geist', 'none'] as const

export type Answers = {
  projectName: string
  theme: (typeof THEMES)[number]
  primary: string
  font: (typeof FONTS)[number]
  demo: boolean
  git: boolean
}

export const DEFAULTS: Omit<Answers, 'projectName'> = {
  theme: 'aura',
  primary: 'emerald',
  font: 'inter',
  demo: true,
  git: true,
}

export function validateProjectName(name: string): string | null {
  if (name === '') return 'Give the project a name.'
  if (name === '.' || name === '..') return 'Use a new folder name, not "." or "..".'
  if (/[\\/]/.test(name)) return 'The project name cannot contain slashes: it becomes a single new folder.'
  if (!/^[a-z0-9][a-z0-9._-]*$/.test(name) || name.length > 214) {
    return 'Use lowercase letters, digits, "-", "_" and "." only, starting with a letter or digit (it becomes the package name).'
  }
  return null
}

export function validatePrimary(value: string): string | null {
  if ((COLOURS as readonly string[]).includes(value) || /^#[0-9a-fA-F]{6}$/.test(value)) return null
  return `"${value}" is not valid. Use ${COLOURS.join(', ')}, or a hex colour like #1a2b3c.`
}

function oneOf<T extends string>(flag: string, value: string, allowed: readonly T[], errors: string[]): T | undefined {
  if ((allowed as readonly string[]).includes(value)) return value as T
  errors.push(`${flag}: "${value}" is not one of ${allowed.join(', ')}.`)
  return undefined
}

export function parseCreateArgs(argv: string[]): { answers: Partial<Answers>; yes: boolean; errors: string[] } {
  const answers: Partial<Answers> = {}
  const errors: string[] = []
  let yes = false

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i] as string
    const equals = arg.indexOf('=')
    // Stryker disable next-line StringLiteral,UnaryOperator: eq only matters when flag is compared with '--theme', '--primary' or '--font', which needs a '--' prefix anyway, so another prefix or sentinel value for other arguments changes nothing.
    const eq = arg.startsWith('--') ? equals : -1
    const flag = eq === -1 ? arg : arg.slice(0, eq)

    if (flag === '--theme' || flag === '--primary' || flag === '--font') {
      let value: string | undefined
      if (eq !== -1) value = arg.slice(eq + 1)
      else if (argv[i + 1] !== undefined && !argv[i + 1]!.startsWith('--')) value = argv[++i]
      if (value === undefined) {
        errors.push(`${flag}: a value is required.`)
        continue
      }
      if (flag === '--theme') {
        const v = oneOf(flag, value, THEMES, errors)
        if (v) answers.theme = v
      } else if (flag === '--font') {
        const v = oneOf(flag, value, FONTS, errors)
        if (v) answers.font = v
      } else {
        const problem = validatePrimary(value)
        if (problem) errors.push(`--primary: ${problem}`)
        else answers.primary = value
      }
    } else if (arg === '--demo') answers.demo = true
    else if (arg === '--no-demo') answers.demo = false
    else if (arg === '--git') answers.git = true
    else if (arg === '--no-git') answers.git = false
    else if (arg === '--yes' || arg === '-y') yes = true
    else if (arg.startsWith('-')) errors.push(`Unknown option ${arg}.`)
    else if (answers.projectName === undefined) answers.projectName = arg
    else errors.push(`Unexpected extra argument "${arg}".`)
  }
  return { answers, yes, errors }
}

/**
 * Decides whether create asks questions. npm keeps `--yes` for itself and exports `npm_config_yes=true` to the
 * command it runs, so without a terminal that is honoured. In a terminal it is ignored: `npx --yes` only means
 * "do not ask before downloading". Without a terminal and without a yes, there is nobody to answer a prompt.
 */
export function decideYes(yes: boolean, stdinIsTTY: boolean | undefined, npmConfigYes: string | undefined): { yes: boolean; problem: string | null } {
  if (yes || stdinIsTTY) return { yes, problem: null }
  if (npmConfigYes === 'true') return { yes: true, problem: null }
  return {
    yes: false,
    problem:
      'Not running in a terminal, so create-nuxt-primevue cannot ask its questions. Pass --yes to accept the defaults for anything not given by a flag, for example: npm create nuxt-primevue@latest my-app -- --yes',
  }
}
