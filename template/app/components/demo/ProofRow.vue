<script setup lang="ts">
defineProps<{ name: string; where: string; index: number }>()
</script>

<template>
  <section
    class="grid grid-cols-1 gap-2.5 border-b border-surface py-5 sm:grid-cols-[200px_minmax(0,1fr)] sm:grid-rows-[auto_1fr] sm:gap-x-7 sm:gap-y-1.5 lg:grid-cols-[170px_minmax(0,1fr)_230px] lg:items-start proof:grid-cols-[220px_minmax(0,1fr)]"
  >
    <h2 class="m-0 flex items-center gap-2.5 text-base font-semibold sm:col-start-1 sm:row-start-1">
      <span class="proof-tick grid size-5 flex-none place-items-center rounded-full bg-primary text-primary-contrast" :style="{ '--i': index }">
        <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2.2" class="size-3" aria-hidden="true"><path d="M2 6.5 5 9.5 10 3" /></svg>
      </span>
      {{ name }}
    </h2>
    <p class="m-0 text-sm text-muted-color sm:col-start-1 sm:row-start-2 lg:col-start-3 lg:row-start-1 lg:text-right proof:col-start-1 proof:row-start-2 proof:text-left">
      <code class="font-mono text-[.84em] font-medium [overflow-wrap:anywhere]">{{ where }}</code>
    </p>
    <div class="min-w-0 sm:col-start-2 sm:row-span-2 sm:row-start-1 lg:row-span-1 proof:row-span-2">
      <slot />
    </div>
  </section>
</template>

<style scoped>
.proof-tick {
  animation: proof-lit 0.3s both;
  animation-delay: calc(var(--i) * 90ms);
}
@keyframes proof-lit {
  from { opacity: 0; transform: scale(0.5); }
}
@media (prefers-reduced-motion: reduce) {
  .proof-tick { animation: none; }
}
</style>
