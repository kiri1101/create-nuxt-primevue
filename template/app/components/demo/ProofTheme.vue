<script setup lang="ts">
import { palette, updatePrimaryPalette } from '@primeuix/themes'
import { themeInfo } from '~/theme'

const isHex = /^#[0-9a-f]{3,8}$/i.test(themeInfo.primary)
const swatches = [
  { id: 'emerald', label: 'Emerald', dot: '#10b981' },
  { id: 'blue', label: 'Blue', dot: '#3b82f6' },
  { id: 'violet', label: 'Violet', dot: '#8b5cf6' },
  ...(isHex ? [{ id: themeInfo.primary, label: 'Your colour', dot: themeInfo.primary }] : []),
]
const active = ref(themeInfo.primary)

// Not saved: a reload goes back to the colour in app/theme.ts.
function choose(id: string) {
  active.value = id
  updatePrimaryPalette(palette(id.startsWith('#') ? id : `{${id}}`))
}
</script>

<template>
  <div>
    <div class="flex flex-wrap gap-2" role="group" aria-label="Primary colour">
      <button
        v-for="s in swatches"
        :key="s.id"
        type="button"
        class="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-surface bg-transparent py-2 pr-3 pl-2.5 text-color"
        :class="active === s.id && 'shadow-[inset_0_0_0_1px_var(--p-text-color)] border-[var(--p-text-color)]'"
        :aria-pressed="active === s.id"
        @click="choose(s.id)"
      >
        <i class="size-4 rounded-full" :style="{ background: s.dot }" />
        {{ s.label }}
      </button>
    </div>
    <p class="mt-2 mb-0 text-[.9375rem] text-muted-color">{{ themeInfo.preset }} preset. Switch the colour and the whole page follows.</p>
  </div>
</template>
