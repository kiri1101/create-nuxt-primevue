import { definePreset, palette } from '@primeuix/themes'
import Aura from '@primeuix/themes/aura'

export const themeInfo = { preset: 'Aura', primary: 'emerald', font: 'Inter' }

const preset = definePreset(Aura, {
  semantic: { primary: palette('{emerald}') },
})

const options = {
  darkModeSelector: '.dark',
  cssLayer: {
    name: 'primevue',
    order: 'theme, base, primevue, components, utilities',
  },
}

export default { preset, options }
