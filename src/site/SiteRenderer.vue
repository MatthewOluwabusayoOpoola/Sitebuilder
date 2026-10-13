<script setup>
import { computed } from 'vue'
import { resolveRoute } from './routes.js'
import { themeStyle } from './theme.js'
import { provideSite } from './context.js'
import { blockComponents } from '../blocks/index.js'
import { normPath, isExternal } from '../schema/util.js'
import SiteHeader from './SiteHeader.vue'
import SiteFooter from './SiteFooter.vue'
import DetailPage from './DetailPage.vue'
import './site.css'

const props = defineProps({
  site: { type: Object, required: true },
  path: { type: String, default: '/' },
  mode: { type: String, default: 'export' }, // 'edit' (builder preview) or 'export'
  selectedId: { type: String, default: '' },
})
const emit = defineEmits(['navigate', 'select'])

const route = computed(() => resolveRoute(props.site, props.path))
const style = computed(() => themeStyle(props.site.theme))

// Internal links become hash links in the builder and relative URLs in exported files
// (every exported page sets <base href> back to the site root).
function pageUrl() {
  const p = normPath(props.path)
  return p === '/' ? './' : p.slice(1) + '/'
}
function link(href) {
  if (!href || /^\s*(javascript|vbscript|data):/i.test(href)) return '#'
  // With <base href> a bare "#anchor" would point at the site root, so anchor to this page.
  if (href.startsWith('#') && props.mode !== 'edit') return pageUrl() + href
  if (isExternal(href)) return href
  const p = normPath(href)
  if (props.mode === 'edit') return '#' + p
  return p === '/' ? './' : p.slice(1) + '/'
}
function go(e, href) {
  if (props.mode !== 'edit') return
  e.preventDefault()
  if (href && !isExternal(href)) emit('navigate', normPath(href))
}
provideSite({
  get site() { return props.site },
  get mode() { return props.mode },
  get path() { return props.path },
  link, go,
})

function onSecClick(s) {
  if (props.mode === 'edit') emit('select', s.id)
}
</script>

<template>
  <div class="site" :class="{ 'site--edit': mode === 'edit' }" :style="style">
    <SiteHeader />
    <main id="main">
      <template v-if="route.kind === 'page'">
        <template v-for="s in route.page.sections" :key="s.id">
          <div
            v-if="!s.hidden || mode === 'edit'"
            :class="mode === 'edit' ? ['sec', { 'sec--hidden': s.hidden, 'sec--selected': selectedId === s.id }] : undefined"
            :data-section="mode === 'edit' ? s.id : undefined"
            @click.capture="onSecClick(s)"
          >
            <component :is="blockComponents[s.type]" :p="s.props" />
          </div>
        </template>
      </template>
      <DetailPage v-else-if="route.kind === 'detail'" :route="route" />
      <section v-else class="sb-wrap sb-pad sb-center">
        <h1 class="sb-h1">Page not found</h1>
        <p class="sb-lead">That page does not exist.</p>
        <a class="sb-btn" :href="link('/')" @click="go($event, '/')">Back to home</a>
      </section>
    </main>
    <SiteFooter />
  </div>
</template>
