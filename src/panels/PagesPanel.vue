<script setup>
import { computed, inject, ref } from 'vue'
import { blockDefs, blockTypes, newSection } from '../schema/blocks.js'
import { clone, slug, uid, normPath } from '../schema/util.js'

const ed = inject('editor')
const site = inject('editorSite')
const adding = ref('hero')
const newTitle = ref('')

const page = computed(() => ed.page.value)
const sections = computed(() => page.value?.sections || [])
const label = (s) => {
  const p = s.props
  const t = p.headline || p.heading || p.text || (p.items?.[0] && (p.items[0].title || p.items[0].q || p.items[0].label)) || ''
  return String(t).replace(/\s+/g, ' ').slice(0, 30)
}

function addSection() {
  const s = newSection(adding.value)
  if (s.type === 'collectionGrid') s.props.collection = Object.keys(site.value.collections)[0] || ''
  const i = sections.value.findIndex((x) => x.id === ed.selectedId.value)
  sections.value.splice(i >= 0 ? i + 1 : sections.value.length, 0, s)
  ed.select(s.id)
}
function move(i, d) {
  const a = sections.value, j = i + d
  if (j < 0 || j >= a.length) return
  ;[a[i], a[j]] = [a[j], a[i]]
}
function dup(i) { const c = clone(sections.value[i]); c.id = 's_' + uid(); sections.value.splice(i + 1, 0, c); ed.select(c.id) }
function remove(i) {
  if (sections.value[i].id === ed.selectedId.value) ed.select('')
  sections.value.splice(i, 1)
}

function addPage() {
  const title = newTitle.value.trim()
  if (!title) return
  let path = '/' + slug(title), n = 2
  while (site.value.pages.some((p) => normPath(p.path) === path)) path = '/' + slug(title) + '-' + n++
  const p = { id: 'p_' + uid(), title, path, nav: true, description: '', sections: [newSection('hero', { layout: 'compact', headline: title, subline: '', ctaLabel: '', ctaLink: '' })] }
  site.value.pages.push(p)
  newTitle.value = ''
  ed.setPath(path)
}
function removePage(p) {
  if (p.path === '/') return
  if (!confirm(`Delete the page "${p.title}"?`)) return
  const i = site.value.pages.indexOf(p)
  site.value.pages.splice(i, 1)
  ed.setPath('/')
}
function movePage(i, d) {
  const a = site.value.pages, j = i + d
  if (j < 1 || j >= a.length) return // Home stays first
  ;[a[i], a[j]] = [a[j], a[i]]
}
</script>

<template>
  <div class="panel">
    <h3 class="panel__h">Pages</h3>
    <ul class="plist">
      <li v-for="(p, i) in site.pages" :key="p.id" :class="{ on: page && page.id === p.id }">
        <button class="plist__main" @click="ed.setPath(p.path)">{{ p.title }} <code>{{ p.path }}</code></button>
        <span class="tools">
          <button class="ico" :disabled="i < 2" aria-label="Move page up" @click="movePage(i, -1)">↑</button>
          <button class="ico" :disabled="i === 0 || i === site.pages.length - 1" aria-label="Move page down" @click="movePage(i, 1)">↓</button>
          <button class="ico ico--danger" :disabled="p.path === '/'" aria-label="Delete page" @click="removePage(p)">✕</button>
        </span>
      </li>
    </ul>
    <form class="inline" @submit.prevent="addPage">
      <input v-model="newTitle" type="text" placeholder="New page title" aria-label="New page title" />
      <button class="btn btn--sm" :disabled="!newTitle.trim()">Add page</button>
    </form>

    <template v-if="page">
      <h3 class="panel__h">Sections on “{{ page.title }}”</h3>
      <ul class="slist">
        <li v-for="(s, i) in sections" :key="s.id" :class="{ on: ed.selectedId.value === s.id, off: s.hidden }">
          <button class="slist__main" @click="ed.select(s.id)">
            <strong>{{ blockDefs[s.type]?.label || s.type }}</strong><small>{{ label(s) }}</small>
          </button>
          <span class="tools">
            <button class="ico" :disabled="i === 0" aria-label="Move up" @click="move(i, -1)">↑</button>
            <button class="ico" :disabled="i === sections.length - 1" aria-label="Move down" @click="move(i, 1)">↓</button>
            <button class="ico" :aria-label="s.hidden ? 'Show section' : 'Hide section'" :aria-pressed="s.hidden" @click="s.hidden = !s.hidden">{{ s.hidden ? '◌' : '●' }}</button>
            <button class="ico" aria-label="Duplicate" @click="dup(i)">⧉</button>
            <button class="ico ico--danger" aria-label="Delete section" @click="remove(i)">✕</button>
          </span>
        </li>
      </ul>
      <div class="inline">
        <select v-model="adding" aria-label="Section type"><option v-for="t in blockTypes" :key="t" :value="t">{{ blockDefs[t].label }}</option></select>
        <button class="btn btn--sm" @click="addSection">+ Add section</button>
      </div>
    </template>
    <p v-else class="muted small">This is an item page generated from a collection. Edit it in the Collections tab.</p>
  </div>
</template>
