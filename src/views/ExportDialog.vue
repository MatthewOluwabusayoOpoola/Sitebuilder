<script setup>
import { computed, onMounted, ref } from 'vue'
import { validateSite } from '../schema/validate.js'
import { exportSite, download } from '../export/exportSite.js'
import { slug } from '../schema/util.js'
import { api, formEndpointFor } from '../api/client.js'
import { account, resendVerification } from '../store/account.js'
import { flushSync, syncState } from '../store/sync.js'

const props = defineProps({ site: Object, rec: Object })
const emit = defineEmits(['close', 'inbox'])
const result = computed(() => validateSite(props.site))
const busy = ref(false)
const progress = ref(0)
const done = ref(null)
const error = ref('')

async function run() {
  busy.value = true; error.value = ''; done.value = null; progress.value = 0
  try {
    const r = await exportSite(JSON.parse(JSON.stringify(props.site)), { onProgress: (p) => (progress.value = p) })
    download(r.blob, r.filename)
    done.value = r
  } catch (e) { error.value = e.message || 'Export failed.' }
  finally { busy.value = false }
}
function backup() {
  download(new Blob([JSON.stringify(props.site, null, 2)], { type: 'application/json' }), slug(props.site.settings.name) + '.site.json')
}

// ---- Publish online (needs an account and a cloud copy) ----
const cloudId = computed(() => props.rec?.cloud?.id)
const pub = ref({ slug: '', url: null, versions: [] })
const slugInput = ref('')
const pubBusy = ref(false)
const pubMsg = ref('')
const pubErr = ref('')
const needsVerify = ref(false)

async function loadPub() {
  if (!cloudId.value || !account.user) return
  try {
    const { site } = await api('GET', `/sites/${cloudId.value}`)
    const { versions } = await api('GET', `/sites/${cloudId.value}/versions`)
    pub.value = { slug: site.slug, url: site.url, versions }
    slugInput.value = site.slug
  } catch (e) { pubErr.value = e.message }
}
onMounted(loadPub)

async function guarded(fn, okMsg) {
  pubBusy.value = true; pubErr.value = ''; pubMsg.value = ''; needsVerify.value = false
  try { await fn(); pubMsg.value = okMsg; await loadPub() }
  catch (e) {
    pubErr.value = e.message
    if (e.status === 403 && /verif/i.test(e.message)) needsVerify.value = true
  } finally { pubBusy.value = false }
}
const publish = () => guarded(async () => {
  progress.value = 0
  await flushSync(props.rec)
  if (syncState[props.rec.id]?.conflict) throw new Error('Resolve the sync conflict first, then publish.')
  const r = await exportSite(JSON.parse(JSON.stringify(props.site)), { onProgress: (p) => (progress.value = p), formEndpoint: formEndpointFor(cloudId.value) })
  await api('POST', `/sites/${cloudId.value}/publish`, r.blob, { headers: { 'content-type': 'application/zip' } })
}, 'Your site is live.')
const saveSlug = () => guarded(() => api('PATCH', `/sites/${cloudId.value}/slug`, { slug: slugInput.value }), 'Address updated.')
const unpublish = () => guarded(() => api('POST', `/sites/${cloudId.value}/unpublish`), 'Site taken offline.')
const rollback = (id) => guarded(() => api('POST', `/sites/${cloudId.value}/rollback`, { versionId: id }), 'Rolled back.')
async function resend() {
  try { await resendVerification(); pubMsg.value = 'Verification email sent.'; pubErr.value = ''; needsVerify.value = false } catch (e) { pubErr.value = e.message }
}
const when = (t) => new Date(t).toLocaleString()
</script>

<template>
  <div class="modal" role="dialog" aria-modal="true" aria-labelledby="exp-title" @keydown.esc="emit('close')">
    <div class="modal__box">
      <h2 id="exp-title">Export website</h2>
      <p class="muted">You get a folder of plain HTML, CSS and images that works on any static host.</p>

      <div v-if="result.errors.length" class="notice notice--error">
        <strong>Fix these before exporting</strong>
        <ul><li v-for="e in result.errors" :key="e">{{ e }}</li></ul>
      </div>
      <div v-if="result.warnings.length" class="notice notice--warn">
        <strong>Worth a look ({{ result.warnings.length }})</strong>
        <ul><li v-for="w in result.warnings.slice(0, 8)" :key="w">{{ w }}</li></ul>
        <small v-if="result.warnings.length > 8">…and {{ result.warnings.length - 8 }} more.</small>
      </div>
      <p v-if="!result.errors.length && !result.warnings.length" class="notice notice--ok">All checks passed.</p>

      <p v-if="error" class="notice notice--error" role="alert">{{ error }}</p>
      <div v-if="busy" class="bar" role="progressbar" :aria-valuenow="Math.round(progress * 100)" aria-valuemin="0" aria-valuemax="100"><i :style="{ width: progress * 100 + '%' }"></i></div>
      <p v-if="done" class="notice notice--ok" role="status">Downloaded <strong>{{ done.filename }}</strong>: {{ done.pages }} pages, {{ done.images }} images. Unzip it and upload the folder to your host. See README.txt inside.</p>

      <section class="pubbox" aria-labelledby="pub-h">
        <h3 id="pub-h">Publish online</h3>
        <p v-if="!account.user" class="muted small">Sign in and use “Save to cloud” in the editor to publish with a link and a contact-form inbox.</p>
        <p v-else-if="!cloudId" class="muted small">Use “Save to cloud” in the editor first.</p>
        <template v-else>
          <p v-if="pub.url" class="notice notice--ok">Live at <a :href="pub.url" target="_blank" rel="noopener">{{ pub.url }}</a></p>
          <div class="ff__field"><label class="ff__label" for="pub-slug">Address</label>
            <div class="row"><input id="pub-slug" v-model="slugInput" type="text" /><button class="btn btn--ghost btn--sm" :disabled="pubBusy || slugInput === pub.slug" @click="saveSlug">Change</button></div></div>
          <p v-if="pubErr" class="notice notice--error" role="alert">{{ pubErr }}
            <button v-if="needsVerify" class="btn btn--sm" @click="resend">Resend verification email</button></p>
          <p v-if="pubMsg" class="notice notice--ok" role="status">{{ pubMsg }}</p>
          <div class="row">
            <button class="btn" :disabled="pubBusy || busy || result.errors.length" @click="publish">{{ pubBusy ? 'Publishing…' : pub.url ? 'Publish changes' : 'Publish' }}</button>
            <button v-if="pub.url" class="btn btn--ghost" :disabled="pubBusy" @click="unpublish">Take offline</button>
            <button class="btn btn--ghost" @click="emit('inbox', cloudId)">Form messages</button>
          </div>
          <details v-if="pub.versions.length"><summary class="small">Versions ({{ pub.versions.length }})</summary>
            <ul class="versions"><li v-for="v in pub.versions" :key="v.id">{{ when(v.createdAt) }} · {{ v.pages }} pages
              <strong v-if="v.live">live</strong><button v-else class="btn btn--sm btn--ghost" :disabled="pubBusy" @click="rollback(v.id)">Restore</button></li></ul>
          </details>
        </template>
      </section>

      <div class="row row--end">
        <button class="btn btn--ghost" @click="backup">Download backup (JSON)</button>
        <button class="btn btn--ghost" @click="emit('close')">Close</button>
        <button class="btn" :disabled="busy || result.errors.length" @click="run">{{ busy ? 'Building…' : 'Download website (.zip)' }}</button>
      </div>
    </div>
  </div>
</template>
