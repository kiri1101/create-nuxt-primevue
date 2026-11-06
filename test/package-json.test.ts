import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { parsePackageJson, readPackageJson } from '../src/package-json.ts'

const bom = String.fromCharCode(0xfeff)
let dir: string
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'pkgjson-'))
})
afterEach(() => rmSync(dir, { recursive: true, force: true }))

describe('parsePackageJson', () => {
  it('reads text with a leading byte order mark, which npm accepts', () => {
    expect(parsePackageJson(`${bom}{"name":"x"}`)).toEqual({ name: 'x' })
  })
  it('reads plain text', () => {
    expect(parsePackageJson('{"name":"x"}')).toEqual({ name: 'x' })
  })
  it('throws on text that is not JSON', () => {
    expect(() => parsePackageJson('{ nope')).toThrow()
  })
})

describe('readPackageJson', () => {
  it('returns the object, also with a byte order mark', () => {
    writeFileSync(join(dir, 'package.json'), `${bom}{"name":"x"}`)
    expect(readPackageJson(dir)).toEqual({ name: 'x' })
  })
  it('returns null when the file is missing, invalid, or not an object', () => {
    expect(readPackageJson(dir)).toBeNull()
    writeFileSync(join(dir, 'package.json'), '{ nope')
    expect(readPackageJson(dir)).toBeNull()
    writeFileSync(join(dir, 'package.json'), '[]')
    expect(readPackageJson(dir)).toBeNull()
    writeFileSync(join(dir, 'package.json'), 'null')
    expect(readPackageJson(dir)).toBeNull()
    writeFileSync(join(dir, 'package.json'), '5')
    expect(readPackageJson(dir)).toBeNull()
    writeFileSync(join(dir, 'package.json'), '"text"')
    expect(readPackageJson(dir)).toBeNull()
    mkdirSync(join(dir, 'sub'))
    expect(readPackageJson(join(dir, 'sub'))).toBeNull()
  })
})
