import { mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { freemem, tmpdir } from 'node:os'
import { join } from 'node:path'
import type { TestProject } from 'vitest/node'
import { packTarball } from './helpers.ts'

declare module 'vitest' {
  export interface ProvidedContext {
    workRoot: string
    tarball: string
  }
}

// One build and one `npm pack` for the whole run; every generated project lives under one temp folder.
export default async function setup(project: TestProject) {
  const GB = 1024 ** 3
  if (!process.env.CI && freemem() < 1.5 * GB) {
    throw new Error(`Only ${(freemem() / GB).toFixed(1)} GB of memory is free. These checks install and build real Nuxt projects; close some programs (a browser, for example) and run again.`)
  }
  // E2E_WORKDIR keeps the generated project between runs, to run the chain in stages. It is not deleted.
  const kept = process.env.E2E_WORKDIR
  if (kept) mkdirSync(kept, { recursive: true })
  const workRoot = kept ?? mkdtempSync(join(tmpdir(), 'cnp-e2e-'))
  project.provide('workRoot', workRoot)
  project.provide('tarball', await packTarball(workRoot))
  if (kept) return () => {}
  return () => rmSync(workRoot, { recursive: true, force: true, maxRetries: 5, retryDelay: 500 })
}
