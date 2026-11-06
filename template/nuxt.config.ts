import tailwindcss from '@tailwindcss/vite'

export default defineNuxtConfig({
  compatibilityDate: '2026-11-01',
  modules: ['@primevue/nuxt-module', '@nuxtjs/color-mode'],

  // The theme (preset, dark selector, CSS layer order) lives in app/theme.ts.
  primevue: {
    importTheme: { from: '~/theme.ts' },
  },

  colorMode: { classSuffix: '', preference: 'system' },

  // Both are needed: the Vite plugin compiles Tailwind, the css array loads the sheet.
  css: ['primeicons/primeicons.css', '~/assets/css/main.css'],
  vite: { plugins: [tailwindcss()] },

  app: {
    head: {
      htmlAttrs: { lang: 'en' },
      link: [
        { rel: 'preload', as: 'font', type: 'font/woff2', href: '/fonts/inter-latin-wght-normal.woff2', crossorigin: 'anonymous' },
      ],
    },
  },
})
