<script setup>
import { useSiteCtx } from '../site/context.js'
defineProps({ p: Object })
const ctx = useSiteCtx()
</script>
<template>
  <section class="sb-wrap sb-pad sb-center">
    <h2 class="sb-h2">{{ p.headline }}</h2>
    <p v-if="p.body" class="sb-lead">{{ p.body }}</p>
    <a v-if="p.ctaLabel" class="sb-btn" :href="ctx.link(p.ctaLink)" @click="ctx.go($event, p.ctaLink)">{{ p.ctaLabel }}</a>
  </section>
</template>
