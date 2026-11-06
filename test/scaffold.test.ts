import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { copyTemplate } from '../src/create/scaffold.ts'

let root: string
let from: string
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'scaffold-'))
  from = join(root, 'source')
  mkdirSync(join(from, 'app'), { recursive: true })
  writeFileSync(join(from, 'package.json'), '{}')
  writeFileSync(join(from, 'app', 'a.vue'), 'a')
})
afterEach(() => rmSync(root, { recursive: true, force: true }))

describe('copyTemplate', () => {
  it('copies files and folders into a target whose parent folders do not exist yet', () => {
    const to = join(root, 'deep', 'er', 'target')
    copyTemplate(from, to)
    expect(readFileSync(join(to, 'app', 'a.vue'), 'utf8')).toBe('a')
    expect(existsSync(join(to, 'package.json'))).toBe(true)
  })

  // Build output, installed packages and the template lockfile are never part of a new project.
  it.each(['node_modules', '.nuxt', '.output'])('leaves out a %s folder', (name) => {
    mkdirSync(join(from, name))
    writeFileSync(join(from, name, 'x.txt'), 'x')
    const to = join(root, 'target')
    copyTemplate(from, to)
    expect(existsSync(join(to, name))).toBe(false)
    expect(existsSync(join(to, 'app'))).toBe(true)
  })

  it('leaves out the top-level package-lock.json but keeps one in a sub-folder', () => {
    writeFileSync(join(from, 'package-lock.json'), '{}')
    writeFileSync(join(from, 'app', 'package-lock.json'), '{}')
    const to = join(root, 'target')
    copyTemplate(from, to)
    expect(existsSync(join(to, 'package-lock.json'))).toBe(false)
    expect(existsSync(join(to, 'app', 'package-lock.json'))).toBe(true)
  })
})
