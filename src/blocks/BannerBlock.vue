<script setup>
import { useSiteCtx } from '../site/context.js'
defineProps({ p: Object })
const ctx = useSiteCtx()
</script>
<template>
  <section class="sb-wrap sb-pad-sm">
    <div class="sb-banner" :class="'sb-banner--' + (p.tone || 'accent')">
      <h2 class="sb-h2">{{ p.headline }}</h2>
      <div class="sb-banner__side">
        <p v-if="p.body">{{ p.body }}</p>
        <a v-if="p.ctaLabel" class="sb-btn sb-btn--ghost" :href="ctx.link(p.ctaLink)" @click="ctx.go($event, p.ctaLink)">{{ p.ctaLabel }}</a>
      </div>
    </div>
  </section>
</template>
