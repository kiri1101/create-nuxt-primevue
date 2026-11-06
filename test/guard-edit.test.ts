import { describe, expect, it } from 'vitest'
import { addGuard, guardProblem, guardUndo } from '../src/doctor/guard.ts'

const CMD = 'node scripts/check-licences.mjs'
const pkg = (scripts: string, eol = '\n') =>
  ['{', '  "name": "x",', '  "description": "caf\u00e9",', `  "scripts": {${scripts}  },`, '  "files": ["dist", "src"]', '}', ''].join(eol)

describe('addGuard: puts the guard in front of the existing build script and changes nothing else', () => {
  // Worked by hand: only the build value changes, and one new member follows it with the same indentation.
  it('edits the build value and adds check:licences after it, keeping every other byte', () => {
    const before = pkg('\n    "dev": "nuxt dev",\n    "build": "nuxt build",\n    "test": "vitest"\n')
    const expected = pkg(
      `\n    "dev": "nuxt dev",\n    "build": "${CMD} && nuxt build",\n    "check:licences": "${CMD}",\n    "test": "vitest"\n`,
    )
    const r = addGuard(before)
    expect(r.text).toBe(expected)
    expect(r.before).toBe('nuxt build')
    expect(r.after).toBe(`${CMD} && nuxt build`)
  })

  it('works when build is the last script, with CRLF line endings', () => {
    const before = pkg('\r\n    "build": "nuxt build"\r\n', '\r\n')
    const expected = pkg(`\r\n    "build": "${CMD} && nuxt build",\r\n    "check:licences": "${CMD}"\r\n`, '\r\n')
    expect(addGuard(before).text).toBe(expected)
  })

  it('keeps tab indentation', () => {
    const before = '{\n\t"scripts": {\n\t\t"build": "nuxt build"\n\t}\n}\n'
    const expected = `{\n\t"scripts": {\n\t\t"build": "${CMD} && nuxt build",\n\t\t"check:licences": "${CMD}"\n\t}\n}\n`
    expect(addGuard(before).text).toBe(expected)
  })

  it('handles a scripts object written on one line, and a file with no final newline', () => {
    const before = '{ "scripts": { "build": "nuxt build", "dev": "nuxt dev" } }'
    const expected = `{ "scripts": { "build": "${CMD} && nuxt build", "check:licences": "${CMD}", "dev": "nuxt dev" } }`
    expect(addGuard(before).text).toBe(expected)
  })

  it('keeps escapes inside the existing build script', () => {
    const before = '{\n  "scripts": {\n    "build": "echo \\"hi\\" && nuxt build"\n  }\n}\n'
    const r = addGuard(before)
    expect(r.text).toContain(`"build": "${CMD} && echo \\"hi\\" && nuxt build"`)
    expect(r.before).toBe('echo "hi" && nuxt build')
  })

  it('edits only the top-level scripts, not a "build" key elsewhere', () => {
    const before = '{\n  "config": { "build": "decoy" },\n  "scripts": {\n    "build": "nuxt build"\n  }\n}\n'
    const r = addGuard(before)
    expect(r.text).toContain('"config": { "build": "decoy" }')
    expect(r.text).toContain(`"build": "${CMD} && nuxt build"`)
  })

  it('keeps a byte order mark at the start', () => {
    const before = '\uFEFF{\n  "scripts": {\n    "build": "nuxt build"\n  }\n}\n'
    expect(addGuard(before).text.startsWith('\uFEFF{')).toBe(true)
  })

  it('throws when there is no build script to edit', () => {
    expect(() => addGuard('{\n  "scripts": { "dev": "x" }\n}\n')).toThrow(/no "build" script/)
    expect(() => addGuard('{\n  "name": "x"\n}\n')).toThrow(/no "build" script/)
  })
})

describe('guardProblem: when the guard must not be added', () => {
  const ok = pkg('\n    "build": "nuxt build"\n')
  it('accepts a project with a build script and none of the guard files', () => {
    expect(guardProblem(ok, false)).toBeNull()
  })
  it('refuses when scripts/check-licences.mjs already exists', () => {
    expect(guardProblem(ok, true)).toContain('scripts/check-licences.mjs already exists')
  })
  it('refuses when there is no build script, or no scripts at all', () => {
    expect(guardProblem(pkg('\n    "dev": "x"\n'), false)).toContain('no "build" script')
    expect(guardProblem('{ "name": "x" }', false)).toContain('no "build" script')
  })
  it('treats scripts that is not an object as no build script', () => {
    expect(guardProblem('{ "scripts": "x" }', false)).toContain('no "build" script')
  })
  it('refuses when build is not a string', () => {
    expect(guardProblem('{ "scripts": { "build": 5 } }', false)).toContain('not a string')
  })
  it('refuses, and says so, when check:licences already exists', () => {
    const text = pkg('\n    "build": "nuxt build",\n    "check:licences": "echo mine"\n')
    expect(guardProblem(text, false)).toContain('"check:licences" script')
  })
  it('refuses when build already calls a check-licences script', () => {
    const text = pkg('\n    "build": "node tools/check-licences.mjs && nuxt build"\n')
    expect(guardProblem(text, false)).toContain('already calls')
  })
  it('does not mistake a "check:licences" key outside scripts for a clash', () => {
    const text = '{ "x": { "check:licences": 1 }, "scripts": { "build": "nuxt build" } }'
    expect(guardProblem(text, false)).toBeNull()
  })
})

describe('guardUndo', () => {
  it('on a project that was not just fixed, a package.json checkout is enough', () => {
    expect(guardUndo(null)).toBe('To remove the guard again, run "git checkout package.json" and delete scripts/check-licences.mjs.')
  })
  it('after a fix, a package.json checkout would also revert the pins, so it is not suggested', () => {
    const text = guardUndo({ name: 'pnpm', major: 9 })
    expect(text).not.toContain('git checkout package.json')
    expect(text).toBe(
      'To remove the guard again, delete scripts/check-licences.mjs, take "node scripts/check-licences.mjs && " out of the "build" script and delete the "check:licences" script in package.json. Or undo everything: run "git checkout ." and then "pnpm install".',
    )
  })
})

describe('addGuard: keeps the bytes of the existing build value', () => {
  it('does not re-encode an escape sequence in it', () => {
    const text = '{\n  "scripts": {\n    "build": "nuxt build \\u0026\\u0026 echo done"\n  }\n}\n'
    expect(addGuard(text).text).toBe(
      '{\n  "scripts": {\n    "build": "node scripts/check-licences.mjs && nuxt build \\u0026\\u0026 echo done",\n    "check:licences": "node scripts/check-licences.mjs"\n  }\n}\n',
    )
  })
})
