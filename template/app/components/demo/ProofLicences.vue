<script setup lang="ts">
const { rows } = useProofLicences()
</script>

<template>
  <div>
    <table class="w-full max-w-105 border-collapse text-[.9375rem]">
      <tbody>
        <tr v-for="r in rows" :key="r.name">
          <td class="py-0.5">{{ r.name }} {{ r.version }}</td>
          <td class="py-0.5 pl-3 text-right whitespace-nowrap text-muted-color">{{ r.licence ?? 'not checked' }}</td>
        </tr>
      </tbody>
    </table>
    <p class="mt-2 mb-0 text-[.9375rem] text-muted-color">Runs with every build, so an update can't bring in the red licence badge.</p>
  </div>
</template>
