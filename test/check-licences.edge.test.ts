import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { checkProject } from '../template/scripts/check-licences.mjs'

const SOURCE = fileURLToPath(new URL('../template/scripts/check-licences.mjs', import.meta.url))
const GUIDE = 'https://github.com/kiri1101/create-nuxt-primevue/blob/main/docs/traps.md#the-licence-change'

let root: string
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'licences-edge-'))
  mkdirSync(join(root, 'scripts'))
  copyFileSync(SOURCE, join(root, 'scripts', 'check-licences.mjs'))
})
afterEach(() => rmSync(root, { recursive: true, force: true }))

function json(dir: string, data: unknown) {
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'package.json'), JSON.stringify(data))
}
const declare = (deps: Record<string, string>) => json(root, { name: 'app', dependencies: deps })
const install = (name: string, license: unknown, version?: string) => {
  const data: Record<string, unknown> = { name }
  if (version !== undefined) data.version = version
  if (license !== undefined) data.license = license
  json(join(root, 'node_modules', name), data)
}
// The guard's script part is run in this process, not in a child: the file is imported from the temporary
// project with the script path set as argv[1], and process.exit and the console are replaced. Running it
// here also lets mutation testing see which tests reach this code.
let imports = 0
async function runGuard(argv1: string | null = join(root, 'scripts', 'check-licences.mjs')) {
  const out: string[] = []
  const err: string[] = []
  const codes: unknown[] = []
  const saved = { argv: process.argv, exit: process.exit, log: console.log, error: console.error }
  process.argv = [process.argv[0] as string, ...(argv1 === null ? [] : [argv1])]
  process.exit = ((code?: number) => void codes.push(code)) as never
  console.log = (...a: unknown[]) => void out.push(a.join(' '))
  console.error = (...a: unknown[]) => void err.push(a.join(' '))
  try {
    await import(`${pathToFileURL(join(root, 'scripts', 'check-licences.mjs')).href}?run=${imports++}`)
  } finally {
    Object.assign(process, { argv: saved.argv, exit: saved.exit })
    console.log = saved.log
    console.error = saved.error
  }
  return { codes, out: out.join('\n'), err: err.join('\n') }
}

describe('the guard run as a script: exit codes and messages', () => {
  it('passes with exit 0 and counts the packages', async () => {
    declare({ primevue: '4.5.5', primeicons: '7.0.0' })
    install('primevue', 'MIT', '4.5.5')
    install('primeicons', 'MIT', '7.0.0')
    const r = await runGuard()
    expect(r.codes).toStrictEqual([0])
    expect(r.out).toBe('Licence check passed: 2 Prime package(s), all MIT.')
    expect(r.err).toBe('')
  })

  it('says there is nothing to check, with exit 0, when no Prime package is declared or installed', async () => {
    declare({ vue: '3.5.0' })
    const r = await runGuard()
    expect(r.codes).toStrictEqual([0])
    expect(r.out).toBe('Licence check: no Prime packages declared or installed.')
    expect(r.err).toBe('')
  })

  it('fails closed with exit 1 and the guide link when Prime packages are declared but none installed', async () => {
    declare({ primevue: '4.5.5' })
    const r = await runGuard()
    expect(r.codes).toStrictEqual([1])
    expect(r.out).toBe('')
    expect(r.err).toContain('Prime packages are declared but none are installed, so nothing could be verified.')
    expect(r.err).toContain('Run your package manager install, then try again.')
    expect(r.err).toContain(`Guide: ${GUIDE}`)
  })

  it('fails with exit 1, naming each offender, its version and licence, and the guide link', async () => {
    declare({ primevue: '5.0.4', primeicons: '7.0.0' })
    install('primevue', 'SEE LICENSE IN LICENSE.md', '5.0.4')
    install('primeicons', undefined, '7.0.0')
    const r = await runGuard()
    expect(r.codes).toStrictEqual([1])
    expect(r.err).toContain('these Prime packages are not on the MIT licence:')
    expect(r.err).toContain('primevue@5.0.4  licence: "SEE LICENSE IN LICENSE.md"')
    expect(r.err).toContain('primeicons@7.0.0  licence: (none declared)')
    expect(r.err).toContain(`How to go back to free versions: ${GUIDE}`)
  })
})

describe('the guard is silent when it is only imported', () => {
  // Nothing is installed, so running the guard would call exit(1).
  it('does not run when there is no script path (node -e)', async () => {
    declare({ primevue: '4.5.5' })
    const r = await runGuard(null)
    expect(r.codes).toStrictEqual([])
    expect(r.out + r.err).toBe('')
  })

  it('does not run when a different script started the process', async () => {
    declare({ primevue: '4.5.5' })
    const r = await runGuard(join(root, 'wrapper.mjs'))
    expect(r.codes).toStrictEqual([])
    expect(r.out + r.err).toBe('')
  })
})

describe('when real paths cannot be resolved', () => {
  // The guard compares real paths so a symlink or junction still starts it. If resolving fails, it falls
  // back to comparing the plain paths: the right script still runs, and any other script still does not.
  beforeEach(() => {
    vi.doMock('node:fs', async (original) => ({
      ...(await original<typeof import('node:fs')>()),
      realpathSync: () => {
        throw new Error('cannot resolve')
      },
    }))
  })
  afterEach(() => {
    vi.doUnmock('node:fs')
  })

  it('still runs when started as the script itself', async () => {
    declare({ primevue: '4.5.5' })
    expect((await runGuard()).codes).toStrictEqual([1])
  })
  it('still does not run when a different script started the process', async () => {
    declare({ primevue: '4.5.5' })
    expect((await runGuard(join(root, 'wrapper.mjs'))).codes).toStrictEqual([])
  })
})

describe('checkProject: what counts as an installed package', () => {
  it('ignores .bin and .cache folders and sub-folders of a package that are not node_modules entries', () => {
    declare({ primevue: '4.5.5' })
    install('primevue', 'MIT', '4.5.5')
    // None of these is an installed package, so none may be reported.
    json(join(root, 'node_modules/.cache/x/node_modules/primevue'), { name: 'primevue', version: '5.0.4', license: 'Commercial' })
    json(join(root, 'node_modules/.bin/y/node_modules/primeicons'), { name: 'primeicons', version: '8.0.2', license: 'Commercial' })
    json(join(root, 'node_modules/some-lib/examples'), { name: 'primevue', version: '5.0.4', license: 'Commercial' })
    const r = checkProject(root)
    expect(r.status).toBe('ok')
    expect(r.installed).toHaveLength(1)
  })

  it('skips a package.json whose name is not a string', () => {
    declare({ primevue: '4.5.5' })
    install('primevue', 'MIT', '4.5.5')
    json(join(root, 'node_modules/weird'), { name: 5 })
    expect(checkProject(root).status).toBe('ok')
  })

  it('records an empty version when the package.json has none', () => {
    declare({ primevue: '4.5.5' })
    install('primevue', 'Commercial')
    expect(checkProject(root).offenders[0]?.version).toBe('')
  })
})
