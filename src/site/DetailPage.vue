<script setup>
import { computed, ref } from 'vue'
import { useSiteCtx } from './context.js'
import { formatPrice } from '../schema/util.js'
import CollectionGridBlock from '../blocks/CollectionGridBlock.vue'

const props = defineProps({ route: { type: Object, required: true } })
const ctx = useSiteCtx()
const qty = ref(1)
const col = computed(() => props.route.collection)
const item = computed(() => props.route.item)
const d = computed(() => col.value.display || {})
const price = computed(() => (d.value.price ? formatPrice(item.value[d.value.price], col.value.currency) : ''))
const specs = computed(() => (d.value.badges || []).filter((b) => item.value[b.key] !== '' && item.value[b.key] != null).map((b) => item.value[b.key] + (b.suffix || '')))
const backPath = computed(() => '/' + props.route.key)
const hasBack = computed(() => ctx.site.pages.some((p) => p.path === backPath.value))
const action = computed(() => {
  const det = col.value.detail
  const s = ctx.site.settings
  if (det.buttonLink) return { href: det.buttonLink }
  if (s.contactEmail) {
    const subj = det.showQuantity ? `Order: ${qty.value} x ${item.value.title}` : `Enquiry: ${item.value.title}`
    return { href: `mailto:${s.contactEmail}?subject=${encodeURIComponent(subj)}` }
  }
  return { href: '/contact' }
})
const more = computed(() => ({ heading: 'More ' + col.value.label.toLowerCase(), collection: props.route.key, limit: 4, columns: 2, style: 'plain', exclude: item.value.id }))
</script>

<template>
  <section class="sb-wrap sb-pad sb-detail">
    <a v-if="hasBack" class="sb-back" :href="ctx.link(backPath)" @click="ctx.go($event, backPath)">← Back to {{ col.label }}</a>
    <div class="sb-detail__grid">
      <img v-if="item.image" class="sb-detail__img" :src="item.image" :alt="item.imageAlt || item.title" />
      <div class="sb-detail__info">
        <p v-if="d.subtitle && item[d.subtitle]" class="sb-eyebrow">{{ item[d.subtitle] }}</p>
        <h1 class="sb-h1 sb-h1--md">{{ item.title }}</h1>
        <p v-if="price" class="sb-price">{{ price }}</p>
        <ul v-if="specs.length" class="sb-badges"><li v-for="s in specs" :key="s">{{ s }}</li></ul>
        <p v-if="item.description" class="sb-body">{{ item.description }}</p>
        <div v-if="col.detail.showQuantity" class="sb-qty" role="group" aria-label="Quantity">
          <button type="button" aria-label="Decrease quantity" @click="qty = Math.max(1, qty - 1)">−</button>
          <output aria-live="polite">{{ qty }}</output>
          <button type="button" aria-label="Increase quantity" @click="qty = Math.min(99, qty + 1)">+</button>
        </div>
        <a class="sb-btn" :href="ctx.link(action.href)" @click="ctx.go($event, action.href)">{{ col.detail.buttonLabel || 'Enquire' }}</a>
      </div>
    </div>
  </section>
  <CollectionGridBlock :p="more" />
</template>
