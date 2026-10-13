<script setup>
import { computed, inject, useId } from 'vue'
import ImageInput from './ImageInput.vue'
import { clone } from '../schema/util.js'

// Renders a form for any block (or collection item) from its field spec.
const props = defineProps({ fields: Array, model: Object })
const site = inject('editorSite')
const uid = useId()
const pageLinks = computed(() => (site.value?.pages || []).map((p) => ({ v: p.path, l: p.title })))
const collections = computed(() => Object.entries(site.value?.collections || {}).map(([k, c]) => [k, c.label]))

function blankFor(fields) {
  const o = {}
  for (const f of fields) o[f.key] = f.type === 'number' ? '' : ''
  return o
}
function addItem(f) { props.model[f.key].push(blankFor(f.itemFields)) }
function removeItem(f, i) { props.model[f.key].splice(i, 1) }
function dupItem(f, i) { props.model[f.key].splice(i + 1, 0, clone(props.model[f.key][i])) }
function moveItem(f, i, d) {
  const a = props.model[f.key], j = i + d
  if (j < 0 || j >= a.length) return
  ;[a[i], a[j]] = [a[j], a[i]]
}
const setNum = (f, v) => { props.model[f.key] = v === '' ? '' : Number(v) }
const itemTitle = (f, it, i) => (it[f.itemLabel] ? String(it[f.itemLabel]).slice(0, 36) : `${f.label.replace(/s$/, '')} ${i + 1}`)
</script>

<template>
  <div class="ff">
    <div v-for="f in fields" :key="f.key" class="ff__field">
      <label :for="uid + f.key" class="ff__label">{{ f.label }}</label>

      <input v-if="f.type === 'text'" :id="uid + f.key" type="text" :value="model[f.key]" @input="model[f.key] = $event.target.value" />
      <textarea v-else-if="f.type === 'textarea'" :id="uid + f.key" :rows="f.rows || 3" :value="model[f.key]" @input="model[f.key] = $event.target.value"></textarea>
      <input v-else-if="f.type === 'number'" :id="uid + f.key" type="number" min="0" :value="model[f.key]" @input="setNum(f, $event.target.value)" />
      <select v-else-if="f.type === 'select'" :id="uid + f.key" :value="model[f.key]" @change="model[f.key] = isNaN(Number($event.target.value)) ? $event.target.value : ($event.target.value === '' ? '' : Number($event.target.value))">
        <option v-for="o in f.options" :key="o[0]" :value="o[0]">{{ o[1] }}</option>
      </select>
      <select v-else-if="f.type === 'collection'" :id="uid + f.key" :value="model[f.key]" @change="model[f.key] = $event.target.value">
        <option value="" disabled>Choose…</option>
        <option v-for="c in collections" :key="c[0]" :value="c[0]">{{ c[1] }}</option>
      </select>
      <template v-else-if="f.type === 'link'">
        <input :id="uid + f.key" type="text" :list="uid + 'dl'" :value="model[f.key]" placeholder="/page or https://…" @input="model[f.key] = $event.target.value" />
        <datalist :id="uid + 'dl'"><option v-for="l in pageLinks" :key="l.v" :value="l.v">{{ l.l }}</option></datalist>
      </template>
      <ImageInput v-else-if="f.type === 'image'" :model-value="model[f.key]" :label="f.label" @update:model-value="model[f.key] = $event" />

      <div v-else-if="f.type === 'list'" class="ff__list">
        <details v-for="(it, i) in model[f.key]" :key="i" class="ff__item" :open="model[f.key].length <= 2">
          <summary>
            <span>{{ itemTitle(f, it, i) }}</span>
            <span class="ff__tools" @click.prevent>
              <button type="button" class="ico" :disabled="i === 0" :aria-label="'Move up'" @click="moveItem(f, i, -1)">↑</button>
              <button type="button" class="ico" :disabled="i === model[f.key].length - 1" aria-label="Move down" @click="moveItem(f, i, 1)">↓</button>
              <button type="button" class="ico" aria-label="Duplicate" @click="dupItem(f, i)">⧉</button>
              <button type="button" class="ico ico--danger" aria-label="Remove" @click="removeItem(f, i)">✕</button>
            </span>
          </summary>
          <FieldForm :fields="f.itemFields" :model="it" />
        </details>
        <button type="button" class="btn btn--sm btn--ghost" @click="addItem(f)">+ Add</button>
      </div>
    </div>
  </div>
</template>
