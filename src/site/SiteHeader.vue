<script setup>
import { computed, ref } from 'vue'
import { useSiteCtx } from './context.js'
import { normPath } from '../schema/util.js'
const ctx = useSiteCtx()
const open = ref(false)
const navPages = computed(() => ctx.site.pages.filter((p) => p.nav))
const header = computed(() => ctx.site.header)
const active = (p) => normPath(p.path) === normPath(ctx.path)
</script>

<template>
  <header class="sb-header">
    <div class="sb-wrap sb-header__row">
      <a class="sb-logo" :href="ctx.link('/')" @click="ctx.go($event, '/')">
        <img v-if="header.logoImage" :src="header.logoImage" :alt="header.logoText || ctx.site.settings.name" />
        <span v-else>{{ header.logoText || ctx.site.settings.name }}</span>
      </a>
      <button class="sb-burger" type="button" :aria-expanded="open" aria-controls="sb-nav" @click="open = !open">
        <span class="sb-sr">Menu</span><span aria-hidden="true">☰</span>
      </button>
      <nav id="sb-nav" class="sb-nav" :class="{ 'sb-nav--open': open }" aria-label="Main">
        <a v-for="p in navPages" :key="p.id" :href="ctx.link(p.path)" :aria-current="active(p) ? 'page' : undefined" @click="ctx.go($event, p.path); open = false">{{ p.title }}</a>
        <a v-if="header.ctaLabel" class="sb-btn sb-btn--sm" :href="ctx.link(header.ctaLink)" @click="ctx.go($event, header.ctaLink)">{{ header.ctaLabel }}</a>
      </nav>
    </div>
  </header>
</template>
