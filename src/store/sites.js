import { reactive, watch } from 'vue'
import { clone, uid } from '../schema/util.js'

const KEY = 'sitebuilder.v1'
function load() {
  try { return JSON.parse(localStorage.getItem(KEY)) || { sites: {} } } catch { return { sites: {} } }
}
export const state = reactive({ sites: load().sites || {}, saveError: '', savedAt: 0 })

let timer
function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify({ sites: state.sites }))
    state.saveError = ''
    state.savedAt = Date.now()
  } catch {
    state.saveError = 'Browser storage is full. Remove large images, or download a backup (JSON).'
  }
}
if (typeof window !== 'undefined') {
  watch(() => state.sites, () => { clearTimeout(timer); timer = setTimeout(persist, 300) }, { deep: true })
  window.addEventListener('beforeunload', persist)
}

export function createSite(schema) {
  const id = 's_' + uid()
  state.sites[id] = { id, schema, createdAt: Date.now(), updatedAt: Date.now() }
  persist()
  return id
}
export function deleteSite(id) { delete state.sites[id]; persist() }
export function duplicateSite(id) {
  const src = state.sites[id]
  const schema = clone(src.schema)
  schema.settings.name += ' (copy)'
  return createSite(schema)
}
export function importSite(json) {
  const schema = typeof json === 'string' ? JSON.parse(json) : json
  if (!schema || !Array.isArray(schema.pages) || !schema.theme || !schema.settings) throw new Error('This file is not a site backup.')
  return createSite(schema)
}
export const touch = (id) => { if (state.sites[id]) state.sites[id].updatedAt = Date.now() }
