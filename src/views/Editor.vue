<script setup>
import { computed, onBeforeUnmount, onMounted, provide, ref, watch } from 'vue'
import { state } from '../store/sites.js'
import { createHistory } from '../store/history.js'
import { blockDefs } from '../schema/blocks.js'
import { resolveRoute } from '../site/routes.js'
import { normPath } from '../schema/util.js'
import { validateSite } from '../schema/validate.js'
import SiteRenderer from '../site/SiteRenderer.vue'
import FieldForm from '../components/FieldForm.vue'
import PagesPanel from '../panels/PagesPanel.vue'
import CollectionsPanel from '../panels/CollectionsPanel.vue'
import SitePanel from '../panels/SitePanel.vue'
import ExportDialog from './ExportDialog.vue'
import AuthDialog from './AuthDialog.vue'
import { account } from '../store/account.js'
import { syncState, scheduleSync, flushSync, linkSite, resolveConflict, markKnown } from '../store/sync.js'

const props = defineProps({ id: String })
const emit = defineEmits(['close', 'inbox'])

const rec = computed(() => state.sites[props.id])
const site = computed(() => rec.value.schema)
provide('editorSite', site)

const history = createHistory(() => rec.value.schema, (v) => { rec.value.schema = v; rec.value.updatedAt = Date.now() })

const path = ref('/')
const selectedId = ref('')
const tab = ref('pages')
const device = ref('desktop')
const showExport = ref(false)

const route = computed(() => resolveRoute(site.value, path.value))
const page = computed(() => (route.value.kind === 'page' ? route.value.page : null))
const selected = computed(() => page.value?.sections.find((s) => s.id === selectedId.value) || null)
const def = computed(() => (selected.value ? blockDefs[selected.value.type] : null))
const issues = computed(() => validateSite(site.value))

const ed = {
  page, selectedId,
  select: (id) => { selectedId.value = id; if (id) tab.value = 'pages' },
  setPath: (p) => { path.value = normPath(p); selectedId.value = '' },
}
provide('editor', ed)

function onPageField(e) {
  const old = page.value.path
  const next = normPath(e.target.value.toLowerCase().replace(/[^a-z0-9\-/]+/g, '-'))
  if (old === '/' || site.value.pages.some((p) => p !== page.value && normPath(p.path) === next)) { e.target.value = old; return }
  page.value.path = next
  path.value = next
}

const widths = { desktop: '100%', tablet: '780px', phone: '390px' }

function onKey(e) {
  const tag = (e.target.tagName || '').toLowerCase()
  if (['input', 'textarea', 'select'].includes(tag)) return
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? history.redo() : history.undo() }
  else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') { e.preventDefault(); history.redo() }
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))

const sync = computed(() => syncState[props.id] || {})
const showAuth = ref(false)
const cloudMsg = ref('')
markKnown(props.id)
watch(() => rec.value?.schema, () => scheduleSync(rec.value), { deep: true })
onBeforeUnmount(() => { if (rec.value?.cloud) flushSync(rec.value) })
async function saveToCloud() {
  cloudMsg.value = ''
  if (!account.user) { showAuth.value = true; return }
  try { await linkSite(rec.value) } catch (e) { cloudMsg.value = e.message }
}
const cloudLabel = computed(() => {
  if (!rec.value.cloud) return ''
  if (sync.value.conflict) return 'Conflict'
  if (sync.value.busy) return 'Syncing…'
  if (sync.value.error) return 'Sync failed'
  return 'In your account'
})
const savedLabel = computed(() => (state.saveError ? 'Not saved' : state.savedAt ? 'Saved' : ''))
</script>

<template>
  <div v-if="rec" class="ed">
    <header class="ed__top">
      <button class="btn btn--ghost btn--sm" @click="emit('close')">← Sites</button>
      <input v-model="site.settings.name" class="ed__name" type="text" aria-label="Site name" />
      <span class="grow"></span>
      <span class="muted small" :class="{ err: state.saveError }" role="status">{{ savedLabel }}</span>
      <span v-if="rec.cloud" class="pill" :class="sync.error || sync.conflict ? 'pill--warn' : 'pill--ok'" role="status">{{ cloudLabel }}</span>
      <button v-if="rec.cloud" class="btn btn--ghost btn--sm" @click="emit('inbox', rec.cloud.id)">Messages</button>
      <button v-else class="btn btn--ghost btn--sm" :disabled="sync.busy" @click="saveToCloud">{{ sync.busy ? 'Saving…' : 'Save to cloud' }}</button>
      <button class="btn btn--ghost btn--sm" :disabled="!history.canUndo.value" title="Undo (Ctrl+Z)" @click="history.undo()">↶ Undo</button>
      <button class="btn btn--ghost btn--sm" :disabled="!history.canRedo.value" title="Redo (Ctrl+Y)" @click="history.redo()">↷ Redo</button>
      <div class="seg" role="group" aria-label="Preview width">
        <button v-for="d in ['desktop', 'tablet', 'phone']" :key="d" :class="{ on: device === d }" :aria-pressed="device === d" @click="device = d">{{ d }}</button>
      </div>
      <button class="btn btn--sm" @click="showExport = true">Export<span v-if="issues.errors.length || issues.warnings.length" class="badge" :class="{ 'badge--err': issues.errors.length }">{{ issues.errors.length + issues.warnings.length }}</span></button>
    </header>

    <p v-if="state.saveError" class="notice notice--error ed__alert" role="alert">{{ state.saveError }}</p>
    <p v-if="cloudMsg || sync.error" class="notice notice--error ed__alert" role="alert">{{ cloudMsg || sync.error }}</p>
    <div v-if="sync.conflict" class="notice notice--warn ed__alert" role="alert">
      This site was changed somewhere else. Which version do you want to keep?
      <button class="btn btn--sm" @click="resolveConflict(rec, 'mine')">Keep my version</button>
      <button class="btn btn--sm btn--ghost" @click="resolveConflict(rec, 'theirs')">Use cloud version</button>
    </div>

    <div class="ed__body">
      <aside class="ed__left" aria-label="Editor panels">
        <div class="tabs" role="tablist">
          <button v-for="t in [['pages', 'Pages'], ['collections', 'Collections'], ['site', 'Site']]" :key="t[0]" role="tab" :aria-selected="tab === t[0]" :class="{ on: tab === t[0] }" @click="tab = t[0]">{{ t[1] }}</button>
        </div>
        <PagesPanel v-if="tab === 'pages'" />
        <CollectionsPanel v-else-if="tab === 'collections'" />
        <SitePanel v-else />
      </aside>

      <main class="ed__center">
        <div class="pathbar"><span class="muted small">Previewing</span> <code>{{ path }}</code>
          <button v-if="path !== '/'" class="btn btn--sm btn--ghost" @click="ed.setPath('/')">Home</button></div>
        <div class="ed__stage">
          <div class="frame" :style="{ width: widths[device] }">
            <SiteRenderer :site="site" :path="path" mode="edit" :selected-id="selectedId" @navigate="ed.setPath" @select="(id) => ed.select(id)" />
          </div>
        </div>
      </main>

      <aside class="ed__right" aria-label="Properties">
        <template v-if="selected">
          <h3 class="panel__h">{{ def.label }}</h3>
          <FieldForm :key="selected.id" :fields="def.fields" :model="selected.props" />
        </template>
        <template v-else-if="page">
          <h3 class="panel__h">Page settings</h3>
          <div class="ff">
            <div class="ff__field"><label class="ff__label" for="pg-title">Title</label><input id="pg-title" v-model="page.title" type="text" /></div>
            <div class="ff__field"><label class="ff__label" for="pg-path">Address</label><input id="pg-path" :value="page.path" :disabled="page.path === '/'" type="text" @change="onPageField" /></div>
            <div class="ff__field"><label class="ff__label" for="pg-desc">Search description <small :class="{ err: (page.description || '').length > 170 }">{{ (page.description || '').length }}/170</small></label><textarea id="pg-desc" v-model="page.description" rows="3"></textarea></div>
            <label class="check"><input v-model="page.nav" type="checkbox" /> Show in menu</label>
          </div>
          <p class="muted small">Select a section in the preview or the Pages tab to edit it.</p>
        </template>
        <template v-else-if="route.kind === 'detail'">
          <h3 class="panel__h">{{ route.item.title }}</h3>
          <p class="muted small">This page is generated from the “{{ route.collection.label }}” collection.</p>
          <button class="btn btn--sm" @click="tab = 'collections'">Edit in Collections</button>
        </template>
        <p v-else class="muted">That page does not exist.</p>
      </aside>
    </div>

    <ExportDialog v-if="showExport" :site="site" :rec="rec" @close="showExport = false" @inbox="(id) => { showExport = false; emit('inbox', id) }" />
    <AuthDialog v-if="showAuth" start="signup" @close="showAuth = false" @done="showAuth = false; saveToCloud()" />
  </div>
</template>
