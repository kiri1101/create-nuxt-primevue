<script setup lang="ts">
import pkg from '~~/package.json'
import { themeInfo } from '~/theme'

const colorMode = useColorMode()
const isDark = computed(() => colorMode.value === 'dark')
function toggleMode() {
  colorMode.preference = isDark.value ? 'light' : 'dark'
}

const deps = pkg.dependencies as Record<string, string>
const hasFont = themeInfo.font.toLowerCase() !== 'none'
const name = 'my-app'
const code = 'font-mono text-[.84em] font-medium [overflow-wrap:anywhere]'
useHead({ title: name })
</script>

<template>
  <div class="mx-auto max-w-290 px-4 pt-4 pb-12 sm:px-8 sm:pt-5 sm:pb-14 lg:px-10 lg:pt-6 lg:pb-16 2xl:max-w-390 2xl:px-16 2xl:pt-8 2xl:pb-18">
    <header class="flex items-center justify-between gap-3 pb-4">
      <span class="font-bold">{{ name }}</span>
      <ClientOnly>
        <Button
          :label="isDark ? 'Light mode' : 'Dark mode'"
          severity="secondary"
          variant="outlined"
          class="min-h-11"
          :aria-pressed="isDark"
          @click="toggleMode"
        />
        <template #fallback>
          <Button label="Dark mode" severity="secondary" variant="outlined" class="min-h-11" />
        </template>
      </ClientOnly>
    </header>

    <div class="2xl:grid 2xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] 2xl:items-start 2xl:gap-22">
      <section class="py-8 pb-9 2xl:sticky 2xl:top-8 2xl:pt-12">
        <h1 class="m-0 text-[clamp(2.5rem,11vw,4.75rem)] leading-[1.02] font-extrabold tracking-[-.035em] text-primary sm:text-[clamp(2.5rem,8.4vw,4.75rem)] 2xl:text-[5.75rem]">
          Everything's wired up.
        </h1>
        <p class="mt-4.5 mb-0 max-w-[56ch] text-lg">
          Nuxt 4, PrimeVue {{ deps.primevue }} and Tailwind 4 are running together, and every Prime package is on a free MIT version.
        </p>
        <p class="mt-2.5 mb-0 max-w-[56ch] text-muted-color">
          This page is only a demo. Delete <code :class="code">app/pages/index.vue</code> to start clean.
        </p>
      </section>

      <main class="border-t-2 border-[var(--p-text-color)]">
        <DemoProofRow name="Theme" where="app/theme.ts" :index="1">
          <DemoProofTheme />
        </DemoProofRow>

        <DemoProofRow name="Components" where="app/assets/css/main.css" :index="2">
          <div class="flex flex-wrap items-center gap-2.5">
            <Button label="Save" class="min-h-11" />
            <Button label="Cancel" variant="outlined" class="min-h-11" />
            <Button label="Restyled with Tailwind" class="min-h-11 rounded-full border-transparent bg-primary/15 text-color dark:bg-primary/25" />
          </div>
          <p class="mt-2 mb-0 text-[.9375rem] text-muted-color">
            PrimeVue buttons, and one reshaped with plain Tailwind classes, no <code :class="code">!important</code>.
          </p>
        </DemoProofRow>

        <DemoProofRow name="Forms" where="app/pages/index.vue" :index="3">
          <InputText aria-label="Your name" placeholder="Your name" class="min-h-11 w-full max-w-70" />
        </DemoProofRow>

        <DemoProofRow name="Font" where="public/fonts/" :index="4">
          <div v-if="hasFont" class="text-[clamp(1.75rem,7vw,2.5rem)] leading-[1.1] font-bold tracking-[-.02em]">{{ themeInfo.font }}, Aa 0123</div>
          <p class="mt-2 mb-0 text-[.9375rem] text-muted-color">
            {{ hasFont ? 'Served from your own site, with no calls to Google.' : 'No custom font: the system font is used.' }}
          </p>
        </DemoProofRow>

        <DemoProofRow name="Animations" where="app/assets/css/main.css" :index="5">
          <DemoProofAnimations />
        </DemoProofRow>

        <DemoProofRow name="Icons" where="primeicons/primeicons.css" :index="6">
          <div class="flex flex-wrap gap-3.5 text-[1.625rem] text-primary" aria-hidden="true">
            <i class="pi pi-star" />
            <i class="pi pi-envelope" />
            <i class="pi pi-home" />
            <i class="pi pi-search" />
            <i class="pi pi-bars" />
          </div>
          <p class="mt-2 mb-0 text-[.9375rem] text-muted-color">PrimeIcons {{ deps.primeicons }}, the last MIT version.</p>
        </DemoProofRow>

        <DemoProofRow name="Licences" where="npm run check:licences" :index="7">
          <DemoProofLicences />
        </DemoProofRow>
      </main>
    </div>
  </div>
</template>
