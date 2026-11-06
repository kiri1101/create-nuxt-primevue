import { readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { PackageManager } from '../pm.ts'
import type { Answers } from './options.ts'
import { GITIGNORE, MINIMAL_PAGE, YARNRC, renderFontsCss, renderTheme } from './render.ts'

const FONT_FILES = {
  inter: ['inter-latin-wght-normal.woff2', 'OFL-Inter.txt'],
  geist: ['geist-latin-wght-normal.woff2', 'OFL-Geist.txt'],
}

/** Edits a template file as text. A pattern that no longer matches means the template drifted: fail loudly. */
function edit(file: string, pattern: RegExp, replacement: string): void {
  const text = readFileSync(file, 'utf8')
  if (!pattern.test(text)) throw new Error(`Template changed: ${pattern} no longer matches in ${file}`)
  writeFileSync(file, text.replace(pattern, () => replacement))
}

/** Turns the copied template into the project the user asked for. `dir` is the copy, never the template itself. */
export function applyAnswers(dir: string, a: Answers, pm: PackageManager): void {
  // Theme and fonts.
  writeFileSync(join(dir, 'app/theme.ts'), renderTheme(a))
  writeFileSync(join(dir, 'app/assets/css/fonts.css'), renderFontsCss(a.font))
  for (const font of ['inter', 'geist'] as const) {
    if (a.font === font) continue
    for (const file of FONT_FILES[font]) rmSync(join(dir, 'public/fonts', file), { force: true })
  }
  const config = join(dir, 'nuxt.config.ts')
  if (a.font === 'none') edit(config, /\r?\n[ \t]*link: \[[\s\S]*?\r?\n[ \t]*\],/, '')
  else if (a.font === 'geist') edit(config, /inter-latin-wght-normal\.woff2/, 'geist-latin-wght-normal.woff2')

  // Demo page.
  const page = join(dir, 'app/pages/index.vue')
  if (a.demo) {
    edit(page, /const name = 'my-app'/, `const name = '${a.projectName}'`)
  } else {
    rmSync(join(dir, 'app/components/demo'), { recursive: true, force: true })
    writeFileSync(page, MINIMAL_PAGE)
  }

  // Project identity.
  const pkgFile = join(dir, 'package.json')
  const pkg = JSON.parse(readFileSync(pkgFile, 'utf8')) as Record<string, unknown>
  pkg.name = a.projectName
  writeFileSync(pkgFile, `${JSON.stringify(pkg, null, 2)}\n`)
  edit(join(dir, 'README.md'), /^# my-app/, `# ${a.projectName}`)

  // npm leaves .gitignore out of published packages, so it is always written here, before any `git add`.
  writeFileSync(join(dir, '.gitignore'), GITIGNORE)
  // Stryker disable next-line ConditionalExpression: null >= 2 is false in JavaScript, so the null check is redundant for the result; it only documents the intent.
  if (pm.name === 'yarn' && pm.major !== null && pm.major >= 2) writeFileSync(join(dir, '.yarnrc.yml'), YARNRC)
}
