<script setup>
import { computed } from 'vue'
import { useSiteCtx } from '../site/context.js'
import { formatPrice } from '../schema/util.js'
const props = defineProps({ p: Object })
const ctx = useSiteCtx()
const col = computed(() => ctx.site.collections?.[props.p.collection])
const items = computed(() => (col.value ? col.value.items.filter((i) => i.id !== props.p.exclude).slice(0, Number(props.p.limit) || 6) : []))
const d = computed(() => col.value?.display || {})
const href = (it) => `/${props.p.collection}/${it.id}`
const badges = (it) => (d.value.badges || []).filter((b) => it[b.key] !== '' && it[b.key] != null).map((b) => it[b.key] + (b.suffix || ''))
const price = (it) => (d.value.price ? formatPrice(it[d.value.price], col.value.currency) : '')
</script>
<template>
  <section v-if="col" class="sb-wrap sb-pad">
    <h2 v-if="p.heading" class="sb-h2 sb-mb">{{ p.heading }}</h2>
    <p v-if="!items.length" class="sb-muted">Nothing here yet. Add items in the Collections tab.</p>
    <div class="sb-grid" :class="'sb-grid--' + (p.columns || 3)">
      <component :is="col.detail?.enabled ? 'a' : 'div'" v-for="it in items" :key="it.id" class="sb-card" :class="'sb-card--' + (p.style || 'plain')"
        :href="col.detail?.enabled ? ctx.link(href(it)) : undefined" @click="col.detail?.enabled && ctx.go($event, href(it))">
        <div class="sb-card__media">
          <img v-if="it.image" :src="it.image" :alt="it.imageAlt || it.title" loading="lazy" />
          <span v-if="d.tag && it[d.tag]" class="sb-tag">{{ it[d.tag] }}</span>
        </div>
        <div class="sb-card__body">
          <h3 class="sb-h3">{{ it.title }}</h3>
          <p v-if="d.subtitle && it[d.subtitle]" class="sb-muted">{{ it[d.subtitle] }}</p>
          <p v-if="price(it)" class="sb-price sb-price--sm">{{ price(it) }}</p>
          <ul v-if="badges(it).length" class="sb-badges"><li v-for="b in badges(it)" :key="b">{{ b }}</li></ul>
          <span v-if="p.style === 'overlay' && col.detail?.enabled" class="sb-card__more">View details</span>
        </div>
      </component>
    </div>
  </section>
</template>
