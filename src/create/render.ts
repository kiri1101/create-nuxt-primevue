import type { Answers } from './options.ts'

const PRESETS: Record<Answers['theme'], string> = { aura: 'Aura', lara: 'Lara', nora: 'Nora', material: 'Material' }
const FONT_NAMES: Record<Answers['font'], string> = { inter: 'Inter', geist: 'Geist', none: 'None' }

/** `primary` is already validated: a colour name or #rrggbb, so it is safe inside quotes. */
export function renderTheme(a: Pick<Answers, 'theme' | 'primary' | 'font'>): string {
  const preset = PRESETS[a.theme]
  const arg = a.primary.startsWith('#') ? a.primary : `{${a.primary}}`
  return `import { definePreset, palette } from '@primeuix/themes'
import ${preset} from '@primeuix/themes/${a.theme}'

export const themeInfo = { preset: '${preset}', primary: '${a.primary}', font: '${FONT_NAMES[a.font]}' }

const preset = definePreset(${preset}, {
  semantic: {
    primary: palette('${arg}'),
    // Aura's default light primary (shade 500) is too pale for white text.
    // Shade 700 keeps contrast above 4.5:1 for emerald, blue and violet.
    colorScheme: {
      light: {
        primary: {
          color: '{primary.700}',
          contrastColor: '#ffffff',
          hoverColor: '{primary.800}',
          activeColor: '{primary.900}',
        },
      },
    },
  },
})

const options = {
  darkModeSelector: '.dark',
  cssLayer: {
    name: 'primevue',
    order: 'theme, base, primevue, components, utilities',
  },
}

export default { preset, options }
`
}

export function renderFontsCss(font: Answers['font']): string {
  if (font === 'none') return '/* No custom font: the system font stack is used. */\n'
  const family = font === 'inter' ? 'Inter Variable' : 'Geist Variable'
  return `@font-face {
  font-family: "${family}";
  font-style: normal;
  font-display: swap;
  font-weight: 100 900;
  src: url("/fonts/${font}-latin-wght-normal.woff2") format("woff2-variations");
  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
}

@theme {
  --font-sans: "${family}", ui-sans-serif, system-ui, sans-serif;
}
`
}

export const GITIGNORE = `node_modules
.nuxt
.output
.data
.nitro
.cache
dist
logs
*.log
.DS_Store
.env
.env.*
!.env.example
`

export const MINIMAL_PAGE = `<template>
  <main class="p-6">
    <h1 class="text-2xl font-bold">Hello</h1>
    <p class="mt-2 text-muted-color">Edit app/pages/index.vue to get started.</p>
  </main>
</template>
`

export const YARNRC = `nodeLinker: node-modules
`
