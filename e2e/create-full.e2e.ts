import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { expectProofPage, generateWithRetry, licenceBadgeShown, lockfileFor, quote, removeDir, serve, sh, shRetry, tarball, workRoot } from './helpers.ts'

// The option variants and package-manager runs are heavy, so they run only with E2E_FULL=1 (CI sets it).
const FULL = process.env.E2E_FULL === '1'

describe.skipIf(!FULL)('every option value builds once', () => {
  it('frees the main project first, so only one project is on disk at a time', () => {
    removeDir(join(workRoot(), 'main'))
    expect(existsSync(join(workRoot(), 'main'))).toBe(false)
  })

  const variants: [string, string[]][] = [
    ['lara-geist', ['--theme', 'lara', '--primary', '#112233', '--font', 'geist', '--yes']],
    ['nora-nodemo', ['--theme', 'nora', '--primary', 'blue', '--font', 'none', '--no-demo', '--yes']],
    ['material-violet', ['--theme', 'material', '--primary', 'violet', '--yes']],
  ]
  for (const [key, flags] of variants) {
    it(`builds with ${flags.filter((f) => f !== '--yes').map(quote).join(' ')}`, async () => {
      const dir = await generateWithRetry(join(workRoot(), `gen-${key}`), key, flags)
      try {
        const res = await sh('npm run build', dir)
        expect(res.code, res.out.slice(-1500)).toBe(0)
      } finally {
        removeDir(join(workRoot(), `gen-${key}`))
      }
    })
  }
})

// Spec 6.1: the detected package manager must do the install. A manager that is not installed is skipped on a
// developer machine, but where CI and E2E_FULL are both set a missing manager is a failure: a skipped case would
// leave acceptance 1 unproven behind a green job.
const MUST_RUN = FULL && Boolean(process.env.CI)
const MANAGERS = ['pnpm', 'yarn', 'bun'] as const
const versions = new Map<string, string | null>()
for (const pm of MANAGERS) {
  const res = await sh(`${pm} --version`, process.cwd())
  versions.set(pm, res.code === 0 ? (res.out.trim().split(/\r?\n/).pop() ?? null) : null)
}

/**
 * Runs the packed CLI through the manager's own runner (`pnpm dlx`, `yarn dlx`, `bunx`). If the runner
 * cannot take a local tarball, falls back to extracting it and running dist/cli.js with the user agent
 * of that manager, so the manager under test is still the one detected and used for the install.
 */
async function generateWith(pm: (typeof MANAGERS)[number], version: string, base: string, name: string): Promise<{ dir: string; via: string }> {
  // Yarn Berry refuses to create a lockfile when CI is set. A real project commits yarn.lock in its first commit; this is a test setting only.
  const env: Record<string, string> =
    pm === 'yarn' ? { YARN_ENABLE_IMMUTABLE_INSTALLS: 'false' } : {}
  mkdirSync(base, { recursive: true })
  const tgz = tarball()
  const runner: Record<string, string> = {
    pnpm: `pnpm dlx "${tgz}" ${name} --yes`,
    yarn: `yarn dlx -p "${tgz}" create-nuxt-primevue ${name} --yes`,
    bun: `bunx --package "${tgz}" create-nuxt-primevue ${name} --yes --pm bun`,
  }
  const direct = await sh(runner[pm] as string, base, env)
  if (direct.code === 0 && existsSync(join(base, name, 'package.json'))) return { dir: join(base, name), via: `${pm} dlx` }

  const extracted = join(base, 'extracted')
  mkdirSync(extracted, { recursive: true })
  expect((await sh(`tar -xzf "${tgz}" -C "${extracted}"`, base)).code).toBe(0)
  expect((await shRetry('npm install --omit=dev --no-audit --no-fund', join(extracted, 'package'))).code).toBe(0)
  const agent = `${pm}/${version} npm/? node/${process.version} ${process.platform} x64`
  const made = await sh(`node "${join(extracted, 'package', 'dist', 'cli.js')}" ${name} --yes`, base, { ...env, npm_config_user_agent: agent })
  expect(made.code, made.out.slice(-1500)).toBe(0)
  return { dir: join(base, name), via: 'extracted tarball with the manager as user agent' }
}

describe.skipIf(!FULL)('create, one run per package manager', () => {
  for (const pm of MANAGERS) {
    const version = versions.get(pm)
    it(`${pm}: the ${pm} install runs, the guard runs inside build, and the built site works`, async (ctx) => {
      if (!version) {
        if (MUST_RUN) throw new Error(`${pm} is not installed, but this run must prove it (E2E_FULL and CI are set)`)
        return ctx.skip()
      }
      let result: { dir: string; via: string } | undefined
      for (let i = 1; i <= 3 && !result; i++) {
        try {
          result = await generateWith(pm, version as string, join(workRoot(), `pm-${pm}-${i}`), `app-${pm}`)
        } catch (e) {
          console.warn(`[e2e] ${pm} attempt ${i}/3 failed: ${String(e).slice(0, 400)}`)
          removeDir(join(workRoot(), `pm-${pm}-${i}`))
          if (i === 3) throw e
        }
      }
      const { dir, via } = result as { dir: string; via: string }
      console.log(`[e2e] ${pm} generated via ${via}`)
      const locks = lockfileFor(dir)
      expect(locks).toHaveLength(1)
      expect(locks[0]).toMatch(pm === 'pnpm' ? /^pnpm-lock\.yaml$/ : pm === 'yarn' ? /^yarn\.lock$/ : /^bun\.lockb?$/)
      if (pm === 'yarn' && Number.parseInt(version as string, 10) >= 2) expect(existsSync(join(dir, '.yarnrc.yml'))).toBe(true)
      expect(readFileSync(join(dir, '.gitignore'), 'utf8')).toContain('node_modules')
      const built = await sh(`${pm} run build`, dir)
      expect(built.code, built.out.slice(-1500)).toBe(0)
      // The guard is the first step of the build script, so this proves it ran under this manager (Yarn 2+ skips pre hooks).
      expect(built.out).toContain('Licence check passed: ')
      expect(built.out).toContain('all MIT.')
      // The pnpm and Yarn layouts differ from npm's, so the built server must really answer and render.
      const server = await serve(dir)
      try {
        expect(await licenceBadgeShown(server.url)).toBe(false)
      } finally {
        await server.stop()
      }
      // Under pnpm the top-level entries are symlinks; the page must still read them.
      await expectProofPage(dir)
      for (const i of [1, 2, 3]) removeDir(join(workRoot(), `pm-${pm}-${i}`))
    })
  }
})
