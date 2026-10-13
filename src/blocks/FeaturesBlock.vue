<script setup>
defineProps({ p: Object })
</script>
<template>
  <section class="sb-wrap sb-pad">
    <h2 v-if="p.heading" class="sb-h2 sb-mb">{{ p.heading }}</h2>
    <div class="sb-grid sb-grid--3">
      <article v-for="(it, i) in p.items" :key="i" class="sb-feature">
        <img v-if="it.image" :src="it.image" :alt="it.imageAlt || ''" loading="lazy" />
        <h3 class="sb-h3">{{ it.title }}</h3>
        <p>{{ it.text }}</p>
      </article>
    </div>
  </section>
</template>
