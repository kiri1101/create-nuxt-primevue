import { definePreset, palette } from '@primeuix/themes'
import Aura from '@primeuix/themes/aura'

export const themeInfo = { preset: 'Aura', primary: 'emerald', font: 'Inter' }

const preset = definePreset(Aura, {
  semantic: {
    primary: palette('{emerald}'),
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
