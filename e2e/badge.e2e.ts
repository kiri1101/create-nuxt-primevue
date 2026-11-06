import { renameSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ensureBuilt, ensureV5, licenceBadgeShown, mainProject, serve, sh, shRetry } from './helpers.ts'

async function badgeOn(dir: string): Promise<boolean> {
  const server = await serve(dir)
  try {
    return await licenceBadgeShown(server.url)
  } finally {
    await server.stop()
  }
}

// One project is reused in order: badge false, guard cases, then primevue 5 in place, badge true.
describe('PrimeUI licence badge and the licence guard', () => {
  it('badge is not shown on the default project (free MIT versions)', async () => {
    const dir = await mainProject()
    await ensureBuilt(dir)
    expect(await badgeOn(dir)).toBe(false)
  })

  it('check:licences exits 1 when node_modules is gone, because nothing can be verified', async () => {
    const dir = await mainProject()
    const modules = join(dir, 'node_modules')
    renameSync(modules, `${modules}.off`)
    try {
      const res = await sh('npm run check:licences', dir)
      expect(res.code).toBe(1)
      expect(res.out).toContain('none are installed')
    } finally {
      renameSync(`${modules}.off`, modules)
    }
  })

  it('npm i primevue@latest makes npm run build fail with the guard message and the package name', async () => {
    const dir = await mainProject()
    const install = await shRetry('npm install primevue@latest --no-audit --no-fund', dir)
    expect(install.code, install.out.slice(-1500)).toBe(0)
    const build = await sh('npm run build', dir)
    expect(build.code).not.toBe(0)
    expect(build.out).toContain('Licence check FAILED')
    expect(build.out).toContain('primevue@')
  })

  // Positive control: the same helper must return true on a project that really shows the badge.
  // A check that can never return true would prove nothing about the false result above.
  it('POSITIVE CONTROL: badge is shown once primevue 5 is installed', async () => {
    const dir = await mainProject()
    await ensureV5(dir)
    // `npx nuxt build` skips the `prebuild` licence guard, which would stop this build.
    const built = await sh('npx nuxt build', dir)
    expect(built.code, built.out.slice(-1500)).toBe(0)
    expect(await badgeOn(dir)).toBe(true)
  })
})
