<script setup>
defineProps({ p: Object })
</script>
<template>
  <section class="sb-wrap sb-pad">
    <h2 v-if="p.heading" class="sb-h2 sb-mb">{{ p.heading }}</h2>
    <p v-if="!p.images.length" class="sb-muted">Add images to this gallery in the editor.</p>
    <div class="sb-gallery">
      <figure v-for="(im, i) in p.images" :key="i"><img :src="im.src" :alt="im.alt || ''" loading="lazy" /></figure>
    </div>
  </section>
</template>
