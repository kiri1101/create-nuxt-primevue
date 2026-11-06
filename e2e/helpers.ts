import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:net'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, inject } from 'vitest'

// Builds and installs run strictly one at a time and with a capped heap: the machine has little spare memory.
process.env.NODE_OPTIONS ??= '--max-old-space-size=2048'

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

export interface Result {
  code: number
  out: string
}

/**
 * Runs a command and captures stdout and stderr together. Every command in these tests is a fixed
 * string written here (paths are ours), so a shell, which Windows needs for npm.cmd, is safe.
 */
export function sh(command: string, cwd: string, env: Record<string, string> = {}): Promise<Result> {
  return new Promise((done) => {
    const child = spawn(command, { cwd, shell: true, env: { ...process.env, ...env } })
    let out = ''
    child.stdout?.on('data', (d) => (out += String(d)))
    child.stderr?.on('data', (d) => (out += String(d)))
    child.on('error', (e) => done({ code: 127, out: String(e) }))
    child.on('close', (code) => done({ code: code ?? 1, out }))
  })
}

/** Network installs are flaky on some machines, so a failing command is retried a few times. */
export async function shRetry(command: string, cwd: string, env: Record<string, string> = {}, tries = 3): Promise<Result> {
  let last: Result = { code: 1, out: '' }
  for (let i = 1; i <= tries; i++) {
    last = await sh(command, cwd, env)
    if (last.code === 0) return last
    console.warn(`[e2e] attempt ${i}/${tries} failed (exit ${last.code}): ${command}\n${last.out.slice(-600)}`)
  }
  return last
}

export function workRoot(): string {
  return inject('workRoot')
}

export function tarball(): string {
  return inject('tarball')
}

/** Builds the CLI and runs `npm pack`, returning the absolute path of the tarball. */
export async function packTarball(destination?: string): Promise<string> {
  const dest = destination ?? ROOT
  const build = await sh('npm run build', ROOT)
  if (build.code !== 0) throw new Error(`npm run build failed:\n${build.out}`)
  const pack = await sh(`npm pack --silent --pack-destination "${dest}"`, ROOT)
  if (pack.code !== 0) throw new Error(`npm pack failed:\n${pack.out}`)
  const name = pack.out.trim().split(/\r?\n/).pop() as string
  return join(dest, name)
}

/** Quotes a flag value such as `#112233`, which a shell would otherwise treat as a comment. */
export function quote(arg: string): string {
  return /^[A-Za-z0-9_.=:/-]+$/.test(arg) ? arg : `"${arg}"`
}

/** Runs the CLI from the packed tarball (not from the source tree), as a user would with npx. */
export async function generate(dir: string, name: string, flags: string[]): Promise<string> {
  mkdirSync(dir, { recursive: true })
  const project = join(dir, name)
  const command = `npx --yes --package "${tarball()}" create-nuxt-primevue ${name} ${flags.map(quote).join(' ')}`
  const res = await shRetry(command, dir, {}, 1)
  if (res.code !== 0) throw new Error(`create-nuxt-primevue failed (exit ${res.code}):\n${res.out}`)
  return project
}

/** Like `generate`, but retries a failed install a few times, from an empty folder each time. */
export async function generateWithRetry(dir: string, name: string, flags: string[], tries = 3): Promise<string> {
  let error: unknown
  for (let i = 1; i <= tries; i++) {
    try {
      return await generate(join(dir, `try${i}`), name, flags)
    } catch (e) {
      console.warn(`[e2e] generate attempt ${i}/${tries} failed for ${name}`)
      removeDir(join(dir, `try${i}`))
      error = e
    }
  }
  throw error
}

/** Deletes a generated project, node_modules included. Windows can hold files briefly, so it retries. */
export function removeDir(dir: string): void {
  rmSync(dir, { recursive: true, force: true, maxRetries: 8, retryDelay: 500 })
}

/**
 * The one project the main chain shares: generate, check, badge, guard, v5 install in place, doctor.
 * Created on first use, then reused by every later file, so only one project is on disk at a time.
 */
export async function mainProject(): Promise<string> {
  const dir = join(workRoot(), 'main')
  if (existsSync(join(dir, 'package.json'))) return dir
  const made = await generateWithRetry(join(workRoot(), 'gen-main'), 'main', ['--yes'])
  renameSync(made, dir)
  removeDir(join(workRoot(), 'gen-main'))
  return dir
}

/** Builds once: skipped when the server bundle is already there. */
export async function ensureBuilt(dir: string): Promise<void> {
  if (existsSync(join(dir, '.output', 'server', 'index.mjs'))) return
  const r = await sh('npm run build', dir)
  if (r.code !== 0) throw new Error(`npm run build failed in ${dir}:
${r.out.slice(-1500)}`)
}

/**
 * Turns the project into the one a user gets after upgrading to the commercial PrimeVue 5 line, in
 * place, and commits it. Marked on disk so a later file does not repeat it.
 */
export async function ensureV5(dir: string): Promise<void> {
  const marker = join(workRoot(), 'v5.done')
  if (existsSync(marker)) return
  const pins = 'primevue@5.0.4 @primevue/nuxt-module@5.0.4 @primeuix/themes@3.1.0 primeicons@8.0.2'
  const install = await shRetry(`npm install ${pins} --no-audit --no-fund`, dir)
  if (install.code !== 0) throw new Error(`installing the v5 packages failed:
${install.out.slice(-1500)}`)
  await sh('git add -A', dir)
  const commit = await sh('git -c user.name=e2e -c user.email=e2e@example.com commit -m "primevue 5"', dir)
  if (commit.code !== 0) throw new Error(`committing the v5 project failed:
${commit.out}`)
  rmSync(join(dir, '.output'), { recursive: true, force: true })
  writeFileSync(marker, 'ok')
}

/** Starts `.output/server/index.mjs` on a free port. */
export async function serve(dir: string): Promise<{ url: string; stop: () => Promise<void> }> {
  const port = await freePort()
  const child = spawn(process.execPath, [join('.output', 'server', 'index.mjs')], {
    cwd: dir,
    env: { ...process.env, PORT: String(port), NITRO_PORT: String(port), HOST: '127.0.0.1', NITRO_HOST: '127.0.0.1' },
    stdio: 'ignore',
  })
  let exited = false
  child.on('exit', () => (exited = true))
  const url = `http://127.0.0.1:${port}`
  const deadline = Date.now() + 60_000
  for (;;) {
    if (exited) throw new Error('the Nuxt server exited before it answered')
    try {
      if ((await fetch(url)).ok) break
    } catch {
      // not listening yet
    }
    if (Date.now() > deadline) {
      child.kill()
      throw new Error('the Nuxt server did not answer within 60 seconds')
    }
    await new Promise((r) => setTimeout(r, 300))
  }
  return {
    url,
    stop: () =>
      new Promise<void>((done) => {
        if (exited) return done()
        child.on('exit', () => done())
        child.kill()
      }),
  }
}

function freePort(): Promise<number> {
  return new Promise((done, fail) => {
    const s = createServer()
    s.on('error', fail)
    s.listen(0, '127.0.0.1', () => {
      const { port } = s.address() as { port: number }
      s.close(() => done(port))
    })
  })
}

/**
 * True when PrimeUI's licence badge shows. Two signals, either is enough:
 *  - the `[PrimeUI]` console message, and
 *  - the badge's host element, `div#p-license-host` (fixed, z-index 2147483647). The badge sits in a closed shadow root, so its
 *    contents cannot be read; the host element in the light DOM is what can be found.
 *
 * Finding the badge returns true at once. "No badge" only counts once the app is proven alive: the heading is
 * visible, the dark-mode button works (only after hydration), and no page or console errors were seen.
 * Otherwise this throws, so a page that failed to render can never pass as "no badge".
 */
export async function licenceBadgeShown(url: string): Promise<boolean> {
  const { chromium } = await import('playwright')
  const browser = await chromium.launch()
  try {
    const page = await browser.newPage()
    let consoleMessage = false
    const errors: string[] = []
    page.on('console', (m) => {
      const text = m.text()
      if (text.includes('[PrimeUI]')) consoleMessage = true
      else if (m.type() === 'error') errors.push(`console.error: ${text}`)
    })
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
    await page.goto(url, { waitUntil: 'networkidle' })
    // PrimeVue checks the licence when it starts on the client, right after hydration. Give it a few
    // seconds after the network goes quiet before saying "not shown".
    const host = await page
      .waitForSelector('#p-license-host', { state: 'attached', timeout: 6_000 })
      .then(() => true)
      .catch(() => false)
    if (host || consoleMessage) return true

    try {
      await page.getByRole('heading', { name: "Everything's wired up." }).waitFor({ state: 'visible', timeout: 5_000 })
      await page.getByRole('button', { name: 'Dark mode' }).click({ timeout: 5_000 })
      await page.waitForFunction(() => document.documentElement.classList.contains('dark'), undefined, { timeout: 5_000 })
    } catch (e) {
      throw new Error(`no licence badge, but the page is not proven alive (not rendered or not hydrated): ${String(e).slice(0, 600)} ${errors.join(' | ')}`)
    }
    if (errors.length) throw new Error(`no licence badge, but the page raised errors: ${errors.join(' | ')}`)
    return false
  } finally {
    await browser.close()
  }
}

/**
 * The proof page must read the installed packages: each of the four Prime packages shows its version and MIT,
 * and the sentence that depends on all four being MIT appears. A page that shows "not checked" is a failure.
 */
export async function expectProofPage(dir: string): Promise<void> {
  const deps = (JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')) as { dependencies: Record<string, string> }).dependencies
  const names = ['primevue', '@primevue/nuxt-module', '@primeuix/themes', 'primeicons']
  const server = await serve(dir)
  try {
    const { chromium } = await import('playwright')
    const browser = await chromium.launch()
    try {
      const page = await browser.newPage()
      await page.goto(server.url, { waitUntil: 'networkidle' })
      const rows = await page.locator('table tr').allInnerTexts()
      for (const name of names) {
        const row = rows.find((r) => r.startsWith(`${name} `))
        expect(row, `no row for ${name} in: ${JSON.stringify(rows)}`).toBeDefined()
        expect(row?.replace(/\s+/g, ' ')).toBe(`${name} ${deps[name]} MIT`)
      }
      await page.getByText('every Prime package is on a free MIT version').waitFor({ state: 'visible', timeout: 5_000 })
    } finally {
      await browser.close()
    }
  } finally {
    await server.stop()
  }
}

/** The default create case: .gitignore written, one commit, no node_modules in git, and a passing build. */
export async function checkDefaultCreate(): Promise<void> {
  const dir = await mainProject()
  expect(existsSync(join(dir, 'package.json'))).toBe(true)
  // npm drops .gitignore from published tarballs, so the CLI must write it itself.
  expect(existsSync(join(dir, '.gitignore'))).toBe(true)

  const tracked = await sh('git ls-files', dir)
  expect(tracked.code).toBe(0)
  expect(tracked.out).not.toContain('node_modules')
  expect(tracked.out).toContain('package.json')

  const log = await sh('git log --oneline', dir)
  // A repository with no commit also prints one line (the error), so the exit code is part of the check.
  expect(log.code, log.out).toBe(0)
  expect(log.out.trim().split(/\r?\n/)).toHaveLength(1)

  await ensureBuilt(dir)
  await expectProofPage(dir)
}

export function lockfileFor(dir: string): string[] {
  return readdirSync(dir).filter((f) => ['package-lock.json', 'pnpm-lock.yaml', 'yarn.lock', 'bun.lock', 'bun.lockb'].includes(f))
}

