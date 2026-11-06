# my-app

Nuxt 4, PrimeVue 4 and Tailwind 4, on free MIT versions of every Prime package.

## Commands

- `npm run dev` starts the dev server.
- `npm run build` checks the Prime licences, then builds.
- `npm run check:licences` runs only the licence check.

## Where things are

- `app/theme.ts` holds the PrimeVue preset, the primary colour, the dark-mode selector and the CSS layer order.
- `app/assets/css/main.css` holds the Tailwind setup, the custom animations and the custom `surface-card` utility.
- `app/directives/` holds an example directive.
- `public/fonts/` holds the fonts, with their licence files. They are served from your own site.
- `app/pages/index.vue` is the demo page. Replace it with your own.

## Keep the Prime packages on MIT versions

`primevue`, `@primevue/nuxt-module`, `@primeuix/themes` and `primeicons` are pinned to exact versions on purpose. PrimeVue 5 and the newest versions of the other packages are under a commercial licence and show a red badge without a key. Before you upgrade any Prime package, check its `license` field. `npm run check:licences` fails the build if a non-MIT Prime package is installed.

Do not run `npm i primevue@latest` unless you mean to leave the MIT versions. If that happens by accident, `npx create-nuxt-primevue doctor` can move the pins back.

More on this, and on other problems in this stack, in the guide: https://github.com/kiri1101/create-nuxt-primevue/blob/main/docs/traps.md
