<script setup>
import { onMounted, ref } from 'vue'
import { api, csvUrl } from '../api/client.js'

const props = defineProps({ cloudId: String })
const emit = defineEmits(['back'])
const items = ref([])
const next = ref(null)
const loading = ref(true)
const error = ref('')
const siteName = ref('')

async function load(before) {
  loading.value = true; error.value = ''
  try {
    const q = before ? `?before=${encodeURIComponent(before)}` : ''
    const r = await api('GET', `/sites/${props.cloudId}/submissions${q}`)
    items.value = before ? items.value.concat(r.items) : r.items
    next.value = r.next
  } catch (e) { error.value = e.status === 401 ? 'Please sign in to see your messages.' : e.message } finally { loading.value = false }
}
onMounted(async () => {
  try { siteName.value = (await api('GET', `/sites/${props.cloudId}`)).site.name } catch { /* shown by load() */ }
  load()
})
async function toggle(m) {
  const read = !m.read
  try { await api('PATCH', `/submissions/${m.id}`, { read }); m.read = read } catch (e) { error.value = e.message }
}
async function remove(m) {
  if (!confirm(`Delete the message from ${m.name}?`)) return
  try { await api('DELETE', `/submissions/${m.id}`); items.value = items.value.filter((x) => x.id !== m.id) } catch (e) { error.value = e.message }
}
const when = (t) => new Date(t).toLocaleString()
</script>

<template>
  <div class="dash">
    <header class="dash__head">
      <div>
        <button class="btn btn--ghost btn--sm" @click="emit('back')">← Back</button>
        <h1>Messages<span v-if="siteName"> · {{ siteName }}</span></h1>
        <p class="muted">Sent through the contact form on your published site.</p>
      </div>
      <a class="btn btn--ghost" :href="csvUrl(cloudId)" download>Download CSV</a>
    </header>
    <p v-if="error" class="notice notice--error" role="alert">{{ error }}</p>
    <p v-if="!loading && !items.length && !error" class="empty">No messages yet. They appear here as soon as someone uses your contact form.</p>
    <ul class="inbox">
      <li v-for="m in items" :key="m.id" :class="{ unread: !m.read }">
        <div class="inbox__head">
          <strong>{{ m.name }}</strong> <a :href="'mailto:' + m.email">{{ m.email }}</a>
          <span class="muted small grow">{{ when(m.createdAt) }}</span>
          <button class="btn btn--sm btn--ghost" @click="toggle(m)">{{ m.read ? 'Mark unread' : 'Mark read' }}</button>
          <button class="btn btn--sm btn--danger" @click="remove(m)">Delete</button>
        </div>
        <p class="inbox__body">{{ m.message }}</p>
      </li>
    </ul>
    <button v-if="next" class="btn btn--ghost" :disabled="loading" @click="load(next)">Load older messages</button>
  </div>
</template>
