<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { state } from './store/sites.js'
import { refreshAccount } from './store/account.js'
import Dashboard from './views/Dashboard.vue'
import Wizard from './views/Wizard.vue'
import Editor from './views/Editor.vue'
import Inbox from './views/Inbox.vue'
import AuthLink from './views/AuthLink.vue'

// Tiny hash router: #/ (sites), #/new (wizard), #/edit/<id> (editor)
const view = ref({ name: 'dashboard' })
function read() {
  const h = location.hash.replace(/^#/, '')
  const m = /^\/edit\/(.+)$/.exec(h)
  if (m && state.sites[m[1]]) view.value = { name: 'editor', id: m[1] }
  else if (h === '/new') view.value = { name: 'wizard' }
  else if (/^\/inbox\/[\w-]+$/.test(h)) view.value = { name: 'inbox', cloudId: h.split('/')[2] }
  else if (/^\/(verify|reset)\/[\w-]+$/.test(h)) view.value = { name: 'authlink', kind: h.split('/')[1], token: h.split('/')[2] }
  else view.value = { name: 'dashboard' }
}
const go = (h) => { location.hash = h }
onMounted(() => { refreshAccount(); read(); window.addEventListener('hashchange', read) })
onBeforeUnmount(() => window.removeEventListener('hashchange', read))
</script>

<template>
  <Dashboard v-if="view.name === 'dashboard'" @new="go('/new')" @open="(id) => go('/edit/' + id)" />
  <Wizard v-else-if="view.name === 'wizard'" @cancel="go('/')" @created="(id) => go('/edit/' + id)" />
  <Inbox v-else-if="view.name === 'inbox'" :cloud-id="view.cloudId" @back="go('/')" />
  <AuthLink v-else-if="view.name === 'authlink'" :kind="view.kind" :token="view.token" @done="go('/')" />
  <Editor v-else :key="view.id" :id="view.id" @close="go('/')" @inbox="(cid) => go('/inbox/' + cid)" />
</template>
