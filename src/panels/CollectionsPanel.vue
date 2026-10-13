<script setup>
import { computed, inject, ref, watch } from 'vue'
import FieldForm from '../components/FieldForm.vue'
import { clone, slug, uid } from '../schema/util.js'

const site = inject('editorSite')
const ed = inject('editor')
const keys = computed(() => Object.keys(site.value.collections))
const key = ref(keys.value[0] || '')
watch(keys, (k) => { if (!k.includes(key.value)) key.value = k[0] || '' })
const col = computed(() => site.value.collections[key.value])

function addItem() {
  const it = { id: 'item-' + uid() }
  for (const f of col.value.fields) it[f.key] = ''
  it.title = 'New ' + col.value.itemLabel.toLowerCase()
  it.id = slug(it.title) + '-' + uid().slice(0, 3)
  col.value.items.push(it)
}
function dup(i) {
  const c = clone(col.value.items[i])
  c.title += ' (copy)'
  c.id = slug(c.title) + '-' + uid().slice(0, 3)
  col.value.items.splice(i + 1, 0, c)
}
function remove(i) { if (confirm(`Delete "${col.value.items[i].title}"? Its page will be removed.`)) col.value.items.splice(i, 1) }
function move(i, d) { const a = col.value.items, j = i + d; if (j < 0 || j >= a.length) return; [a[i], a[j]] = [a[j], a[i]] }
function preview(it) { if (col.value.detail.enabled) ed.setPath(`/${key.value}/${it.id}`) }
</script>

<template>
  <div class="panel">
    <h3 class="panel__h">Collections</h3>
    <p v-if="!keys.length" class="muted small">This site has no collections.</p>
    <template v-else>
      <select v-model="key" aria-label="Collection"><option v-for="k in keys" :key="k" :value="k">{{ site.collections[k].label }} ({{ site.collections[k].items.length }})</option></select>
      <details class="ff__item">
        <summary>Settings for {{ col.label }}</summary>
        <div class="ff">
          <label class="check"><input v-model="col.detail.enabled" type="checkbox" /> Each item has its own page</label>
          <label class="check"><input v-model="col.detail.showQuantity" type="checkbox" /> Show quantity selector</label>
          <div class="ff__field"><label class="ff__label">Button label</label><input v-model="col.detail.buttonLabel" type="text" /></div>
          <div class="ff__field"><label class="ff__label">Button link</label><input v-model="col.detail.buttonLink" type="text" placeholder="Empty: email an order to your contact address" /></div>
          <div class="ff__field"><label class="ff__label">Currency symbol</label><input v-model="col.currency" type="text" maxlength="3" /></div>
        </div>
      </details>
      <ul class="clist">
        <li v-for="(it, i) in col.items" :key="it.id">
          <details>
            <summary>
              <span>{{ it.title || 'Untitled' }}</span>
              <span class="tools" @click.prevent>
                <button v-if="col.detail.enabled" class="ico" aria-label="Show in preview" @click="preview(it)">👁</button>
                <button class="ico" :disabled="i === 0" aria-label="Move up" @click="move(i, -1)">↑</button>
                <button class="ico" :disabled="i === col.items.length - 1" aria-label="Move down" @click="move(i, 1)">↓</button>
                <button class="ico" aria-label="Duplicate" @click="dup(i)">⧉</button>
                <button class="ico ico--danger" aria-label="Delete" @click="remove(i)">✕</button>
              </span>
            </summary>
            <FieldForm :fields="col.fields" :model="it" />
          </details>
        </li>
      </ul>
      <button class="btn btn--sm" @click="addItem">+ Add {{ col.itemLabel.toLowerCase() }}</button>
    </template>
  </div>
</template>
