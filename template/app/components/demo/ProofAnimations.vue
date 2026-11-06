<script setup lang="ts">
const running = ref(false)
let timer: ReturnType<typeof setTimeout> | undefined

// Restart: switch the classes off, let the DOM update, then switch them on again.
async function play() {
  clearTimeout(timer)
  running.value = false
  await nextTick()
  running.value = true
  timer = setTimeout(() => (running.value = false), 2400)
}
onBeforeUnmount(() => clearTimeout(timer))
</script>

<template>
  <div>
    <div class="mb-2.5 grid max-w-95 grid-cols-3 gap-2">
      <div class="h-8.5 rounded-md bg-primary" :class="running && 'animate-fade-up'" />
      <div
        class="h-8.5 rounded-md bg-primary/15 bg-[length:300%_100%]"
        :class="running && 'animate-shimmer bg-[linear-gradient(100deg,transparent_30%,var(--p-primary-color)_50%,transparent_70%)]'"
      />
      <div class="h-8.5 rounded-md bg-primary/15" :class="running && 'animate-pulse-soft'" />
    </div>
    <Button label="Play animations" severity="secondary" variant="outlined" class="min-h-11" @click="play" />
    <p class="mt-2 mb-0 text-[.9375rem] text-muted-color">
      <code class="font-mono text-[.84em] font-medium">animate-fade-up</code>,
      <code class="font-mono text-[.84em] font-medium">animate-shimmer</code> and
      <code class="font-mono text-[.84em] font-medium">animate-pulse-soft</code>.
    </p>
  </div>
</template>
