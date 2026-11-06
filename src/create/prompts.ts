import * as p from '@clack/prompts'
import { type Answers, COLOURS, DEFAULTS, validatePrimary, validateProjectName } from './options.ts'

/**
 * Asks only for what flags did not already give. Returns null if the user cancels,
 * which happens before anything is written.
 */
export async function askMissing(given: Partial<Answers>): Promise<Answers | null> {
  p.intro('create-nuxt-primevue')
  const cancelled = () => {
    p.cancel('Cancelled. Nothing was written.')
    return null
  }

  let projectName = given.projectName
  if (projectName === undefined) {
    const v = await p.text({
      message: 'Project name?',
      placeholder: 'my-app',
      defaultValue: 'my-app',
      validate: (value) => validateProjectName(value || 'my-app') ?? undefined,
    })
    if (p.isCancel(v)) return cancelled()
    projectName = v || 'my-app'
  }

  let theme = given.theme
  if (theme === undefined) {
    const v = await p.select({
      message: 'Theme?',
      initialValue: DEFAULTS.theme,
      options: [
        { value: 'aura' as const, label: 'Aura' },
        { value: 'lara' as const, label: 'Lara' },
        { value: 'nora' as const, label: 'Nora' },
        { value: 'material' as const, label: 'Material' },
      ],
    })
    if (p.isCancel(v)) return cancelled()
    theme = v
  }

  let primary = given.primary
  if (primary === undefined) {
    const v = await p.select({
      message: 'Primary colour?',
      initialValue: DEFAULTS.primary,
      options: [...COLOURS.map((c) => ({ value: c as string, label: c })), { value: 'custom', label: 'Your own hex colour' }],
    })
    if (p.isCancel(v)) return cancelled()
    if (v === 'custom') {
      const hex = await p.text({
        message: 'Hex colour (#rrggbb)?',
        placeholder: '#1a2b3c',
        validate: (value) => validatePrimary(value ?? '') ?? undefined,
      })
      if (p.isCancel(hex)) return cancelled()
      primary = hex
    } else primary = v
  }

  let font = given.font
  if (font === undefined) {
    const v = await p.select({
      message: 'Font?',
      initialValue: DEFAULTS.font,
      options: [
        { value: 'inter' as const, label: 'Inter' },
        { value: 'geist' as const, label: 'Geist' },
        { value: 'none' as const, label: 'None (system font)' },
      ],
    })
    if (p.isCancel(v)) return cancelled()
    font = v
  }

  let demo = given.demo
  if (demo === undefined) {
    const v = await p.confirm({ message: 'Add the demo page?', initialValue: DEFAULTS.demo })
    if (p.isCancel(v)) return cancelled()
    demo = v
  }

  return { projectName, theme, primary, font, demo, git: given.git ?? DEFAULTS.git }
}
