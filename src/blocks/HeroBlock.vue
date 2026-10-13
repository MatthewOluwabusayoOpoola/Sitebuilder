<script setup>
import { useSiteCtx } from '../site/context.js'
defineProps({ p: Object })
const ctx = useSiteCtx()
</script>
<template>
  <section class="sb-hero" :class="'sb-hero--' + (p.layout || 'center')">
    <div class="sb-wrap sb-hero__grid">
      <div class="sb-hero__text">
        <p v-if="p.eyebrow" class="sb-eyebrow">{{ p.eyebrow }}</p>
        <h1 class="sb-h1">{{ p.headline }}</h1>
        <p v-if="p.subline" class="sb-lead">{{ p.subline }}</p>
        <a v-if="p.ctaLabel" class="sb-btn" :href="ctx.link(p.ctaLink)" @click="ctx.go($event, p.ctaLink)">{{ p.ctaLabel }}</a>
      </div>
      <img v-if="p.image && p.layout !== 'compact'" class="sb-hero__img" :src="p.image" :alt="p.imageAlt || ''" />
    </div>
  </section>
</template>
