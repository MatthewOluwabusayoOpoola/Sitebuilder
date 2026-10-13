<script setup>
defineProps({ p: Object })
</script>
<template>
  <section class="sb-wrap sb-pad sb-narrow">
    <h2 v-if="p.heading" class="sb-h2 sb-mb">{{ p.heading }}</h2>
    <details v-for="(f, i) in p.items" :key="i" class="sb-faq">
      <summary>{{ f.q }}</summary>
      <p>{{ f.a }}</p>
    </details>
  </section>
</template>
