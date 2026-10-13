<script setup>
defineProps({ p: Object })
</script>
<template>
  <section class="sb-wrap sb-pad">
    <h2 v-if="p.heading" class="sb-h2 sb-mb">{{ p.heading }}</h2>
    <div class="sb-grid sb-grid--2">
      <figure v-for="(t, i) in p.items" :key="i" class="sb-quote">
        <blockquote>{{ t.quote }}</blockquote>
        <figcaption><strong>{{ t.name }}</strong><span v-if="t.role"> · {{ t.role }}</span></figcaption>
      </figure>
    </div>
  </section>
</template>
