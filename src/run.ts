import { spawn } from 'node:child_process'

export interface RunOptions {
  /** Discard the child's output (used for probes whose failure is expected). */
  quiet?: boolean
}

// Windows needs a shell to start npm.cmd, pnpm.cmd and friends. A shell string is only ever
// built from fixed arguments written in this package, and anything unexpected is refused.
const SAFE_ARG = /^[A-Za-z0-9_:.@/=-]+$/

function needsShell(cmd: string): boolean {
  return process.platform === 'win32' && cmd !== 'git' && cmd !== 'node'
}

function toSpawn(cmd: string, args: string[]): { file: string; args: string[]; shell: boolean } {
  if (!needsShell(cmd)) return { file: cmd, args, shell: false }
  for (const part of [cmd, ...args]) {
    if (!SAFE_ARG.test(part)) throw new Error(`Refusing to run an unsafe command part: ${JSON.stringify(part)}`)
  }
  return { file: [cmd, ...args].join(' '), args: [], shell: true }
}

/** Runs a command with inherited output. Resolves to its exit code (127 if it could not start). */
export function run(cmd: string, args: string[], cwd: string, options: RunOptions = {}): Promise<number> {
  return new Promise((resolve) => {
    const s = toSpawn(cmd, args)
    const child = spawn(s.file, s.args, { cwd, stdio: options.quiet ? 'ignore' : 'inherit', shell: s.shell })
    child.on('error', () => resolve(127))
    child.on('close', (code) => resolve(code ?? 1))
  })
}

/** Runs a command and returns its exit code and standard output. */
export function capture(cmd: string, args: string[], cwd: string): Promise<{ code: number; stdout: string }> {
  return new Promise((resolve) => {
    const s = toSpawn(cmd, args)
    const child = spawn(s.file, s.args, { cwd, stdio: ['ignore', 'pipe', 'ignore'], shell: s.shell })
    let stdout = ''
    child.stdout?.on('data', (chunk) => {
      stdout += String(chunk)
    })
    child.on('error', () => resolve({ code: 127, stdout: '' }))
    child.on('close', (code) => resolve({ code: code ?? 1, stdout }))
  })
}
