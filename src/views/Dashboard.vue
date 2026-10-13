<script setup>
import { computed, ref, watch, onMounted } from 'vue'
import { state, deleteSite, duplicateSite, importSite } from '../store/sites.js'
import { getTemplate } from '../schema/templates.js'
import { download } from '../export/exportSite.js'
import { slug } from '../schema/util.js'
import { account } from '../store/account.js'
import { api } from '../api/client.js'
import { pullCloudSite, removeCloud } from '../store/sync.js'
import AccountBar from './AccountBar.vue'

const emit = defineEmits(['new', 'open'])
const sites = computed(() => Object.values(state.sites).sort((a, b) => b.updatedAt - a.updatedAt))
const msg = ref('')

// Sites in the signed-in account: used for badges, unread counts, and sites made on another device.
const cloud = ref([])
async function loadCloud() {
  if (!account.user) { cloud.value = []; return }
  try { cloud.value = (await api('GET', '/sites')).sites } catch (e) { if (e.status !== 0) msg.value = e.message }
}
onMounted(loadCloud)
watch(() => account.user?.id, loadCloud)
const cloudById = computed(() => Object.fromEntries(cloud.value.map((c) => [c.id, c])))
const linkedIds = computed(() => new Set(sites.value.filter((s) => s.cloud).map((s) => s.cloud.id)))
const elsewhere = computed(() => cloud.value.filter((c) => !linkedIds.value.has(c.id)))
async function openRemote(c) { try { emit('open', await pullCloudSite(c.id)) } catch (e) { msg.value = e.message } }
async function deleteRemote(c) {
  if (!confirm(`Permanently delete "${c.name}" from your account, including the published site and its messages?`)) return
  try { await removeCloud(c.id); await loadCloud() } catch (e) { msg.value = e.message }
}

async function remove(s) {
  if (!confirm(`Delete "${s.schema.settings.name}" from this browser? This cannot be undone. Download a backup first if unsure.`)) return
  if (s.cloud && account.user && confirm('This site is also saved in your account. Delete it there too, including the published site and its messages?\n\nOK = delete from account as well\nCancel = keep the cloud copy')) {
    try { await removeCloud(s.cloud.id) } catch (e) { msg.value = e.message; return }
  }
  deleteSite(s.id)
  loadCloud()
}
function backup(s) {
  download(new Blob([JSON.stringify(s.schema, null, 2)], { type: 'application/json' }), slug(s.schema.settings.name) + '.site.json')
}
async function onImport(e) {
  const f = e.target.files[0]
  if (!f) return
  try { emit('open', importSite(await f.text())) } catch (err) { msg.value = err.message || 'Could not read that file.' }
  e.target.value = ''
}
const when = (t) => new Date(t).toLocaleString()
</script>

<template>
  <div class="dash">
    <header class="dash__head">
      <div>
        <h1>Site Builder</h1>
        <p class="muted">Build a multi-page website from a template. No account, no AI, everything stays in your browser until you export.</p>
      </div>
      <div class="row">
        <AccountBar @changed="loadCloud" />
        <label class="btn btn--ghost">Import backup<input type="file" accept=".json,application/json" hidden @change="onImport" /></label>
        <button class="btn" @click="emit('new')">+ New site</button>
      </div>
    </header>
    <p v-if="msg" class="notice notice--error" role="alert">{{ msg }}</p>
    <p v-if="state.saveError" class="notice notice--error" role="alert">{{ state.saveError }}</p>

    <section v-if="!sites.length" class="empty">
      <h2>Create your first website</h2>
      <p>Pick an industry, choose your pages and look, then edit everything in the live editor.</p>
      <button class="btn" @click="emit('new')">Start the wizard</button>
    </section>

    <section v-else class="cards">
      <article v-for="s in sites" :key="s.id" class="card">
        <div class="card__swatch" :style="{ background: s.schema.theme.bg, color: s.schema.theme.ink, borderColor: s.schema.theme.accent }">
          <strong>{{ s.schema.settings.name }}</strong>
          <span :style="{ background: s.schema.theme.accent }" class="dot"></span>
        </div>
        <div class="card__body">
          <h3>{{ s.schema.settings.name }}</h3>
          <p class="muted">{{ getTemplate(s.schema.settings.template)?.label || 'Custom' }} · {{ s.schema.pages.length }} pages</p>
          <p v-if="s.cloud" class="small">
            <span class="pill pill--ok">In your account</span>
            <a v-if="cloudById[s.cloud.id]?.url" :href="cloudById[s.cloud.id].url" target="_blank" rel="noopener" class="pill pill--live">Live ↗</a>
            <a v-if="cloudById[s.cloud.id]?.unread" :href="'#/inbox/' + s.cloud.id" class="pill pill--warn">{{ cloudById[s.cloud.id].unread }} new message{{ cloudById[s.cloud.id].unread === 1 ? '' : 's' }}</a>
          </p>
          <p class="muted small">Edited {{ when(s.updatedAt) }}</p>
          <div class="row">
            <button class="btn btn--sm" @click="emit('open', s.id)">Open</button>
            <button class="btn btn--sm btn--ghost" @click="emit('open', duplicateSite(s.id))">Duplicate</button>
            <button class="btn btn--sm btn--ghost" @click="backup(s)">Backup</button>
            <button class="btn btn--sm btn--danger" @click="remove(s)">Delete</button>
          </div>
        </div>
      </article>
    </section>

    <section v-if="elsewhere.length" class="elsewhere">
      <h2>Also in your account</h2>
      <p class="muted">Saved from another browser or device. Open one here to keep editing.</p>
      <article v-for="c in elsewhere" :key="c.id" class="rowcard">
        <div><strong>{{ c.name }}</strong>
          <span v-if="c.url" class="pill pill--live"><a :href="c.url" target="_blank" rel="noopener">Live ↗</a></span>
          <a v-if="c.unread" :href="'#/inbox/' + c.id" class="pill pill--warn">{{ c.unread }} new</a></div>
        <div class="row"><button class="btn btn--sm" @click="openRemote(c)">Open here</button><button class="btn btn--sm btn--danger" @click="deleteRemote(c)">Delete</button></div>
      </article>
    </section>
  </div>
</template>
