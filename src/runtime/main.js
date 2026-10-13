// Loaded by exported pages: hydrates the prerendered HTML so menus, forms and buttons work.
import { createSSRApp, h } from 'vue'
import SiteRenderer from '../site/SiteRenderer.vue'

const site = JSON.parse(document.getElementById('site-data').textContent)
const path = window.__SITE_PATH__ || '/'
createSSRApp({ render: () => h(SiteRenderer, { site, path, mode: 'export' }) }).mount('#app')
