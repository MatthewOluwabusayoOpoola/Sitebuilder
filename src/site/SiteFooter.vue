<script setup>
import { computed } from 'vue'
import { useSiteCtx } from './context.js'
const ctx = useSiteCtx()
const footer = computed(() => ctx.site.footer || {})
const navPages = computed(() => ctx.site.pages.filter((p) => p.nav))
</script>

<template>
  <footer class="sb-footer">
    <div class="sb-wrap sb-footer__row">
      <p class="sb-footer__text">{{ footer.text }}</p>
      <nav aria-label="Footer" class="sb-footer__nav">
        <a v-for="p in navPages" :key="p.id" :href="ctx.link(p.path)" @click="ctx.go($event, p.path)">{{ p.title }}</a>
        <a v-for="(l, i) in footer.links || []" :key="i" :href="ctx.link(l.href)" @click="ctx.go($event, l.href)">{{ l.label }}</a>
      </nav>
    </div>
  </footer>
</template>
