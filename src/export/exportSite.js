import JSZip from 'jszip'
import { createSSRApp, h } from 'vue'
import { renderToString } from 'vue/server-renderer'
import SiteRenderer from '../site/SiteRenderer.vue'
import { allRoutes, filePathFor, depthOf } from '../site/routes.js'
import { clone, slug } from '../schema/util.js'

const EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/svg+xml': 'svg', 'image/gif': 'gif', 'image/webp': 'webp' }

export function dataUrlToBytes(url) {
  const m = /^data:([^;,]+)((?:;[^,]*)?),(.*)$/s.exec(url)
  if (!m) return null
  const mime = m[1], isB64 = m[2].includes('base64'), payload = m[3]
  if (isB64) {
    const bin = atob(payload)
    const bytes = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
    return { mime, bytes }
  }
  return { mime, bytes: new TextEncoder().encode(decodeURIComponent(payload)) }
}

// Replace every embedded image (data URL) with a file under assets/.
export function extractAssets(site, remote = new Map()) {
  const out = clone(site)
  const files = []
  const seen = new Map()
  const walk = (v) => {
    if (Array.isArray(v)) return v.map(walk)
    if (v && typeof v === 'object') { for (const k of Object.keys(v)) v[k] = walk(v[k]); return v }
    if (typeof v === 'string' && (v.startsWith('data:image') || remote.has(v))) {
      if (seen.has(v)) return seen.get(v)
      const parsed = remote.get(v) || dataUrlToBytes(v)
      if (!parsed) return v
      const name = `assets/img-${files.length + 1}.${EXT[parsed.mime] || 'bin'}`
      files.push({ name, bytes: parsed.bytes })
      seen.set(v, name)
      return name
    }
    return v
  }
  walk(out)
  return { site: out, files }
}

const REMOTE_IMG = /^(?:https?:\/\/[^/]+)?\/api\/assets\/[\w-]{36}$/

// Images saved to the account live on the server; bundle them into the export so the site is self-contained.
async function fetchRemoteAssets(site) {
  const urls = new Set()
  const walk = (v) => {
    if (typeof v === 'string') { if (REMOTE_IMG.test(v)) urls.add(v) }
    else if (Array.isArray(v)) v.forEach(walk)
    else if (v && typeof v === 'object') Object.values(v).forEach(walk)
  }
  walk(site)
  const out = new Map()
  for (const u of urls) {
    const r = await fetch(u)
    if (!r.ok) throw new Error('Could not download one of your saved images. Check your connection and try again.')
    out.set(u, { mime: r.headers.get('content-type') || 'application/octet-stream', bytes: new Uint8Array(await r.arrayBuffer()) })
  }
  return out
}

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

async function renderPage(site, path) {
  const app = createSSRApp({ render: () => h(SiteRenderer, { site, path, mode: 'export' }) })
  return renderToString(app)
}

function htmlDoc({ site, route, body, depth, origin }) {
  const name = site.settings.name
  const title = route.path === '/' ? name : route.title.includes('|') ? route.title : `${route.title} | ${name}`
  const desc = route.description || ''
  const canonical = origin ? origin + (route.path === '/' ? '/' : route.path + '/') : ''
  const base = depth ? '../'.repeat(depth) : './'
  const fonts = site.theme.fontsHref
  const data = JSON.stringify(site).replace(/</g, '\\u003c')
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<base href="${base}">
<title>${esc(title)}</title>
${desc ? `<meta name="description" content="${esc(desc)}">\n` : ''}${canonical ? `<link rel="canonical" href="${esc(canonical)}">\n` : ''}<meta property="og:title" content="${esc(title)}">
${desc ? `<meta property="og:description" content="${esc(desc)}">\n` : ''}<meta property="og:type" content="website">
<meta name="theme-color" content="${esc(site.theme.accent)}">
${fonts ? `<link rel="preconnect" href="https://fonts.googleapis.com">\n<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n<link rel="stylesheet" href="${esc(fonts)}">\n` : ''}<link rel="stylesheet" href="site.css">
</head>
<body style="margin:0;background:${esc(site.theme.bg)}">
<a href="${route.path === '/' ? './' : route.path.slice(1) + '/'}#main" style="position:absolute;left:-9999px" onfocus="this.style.left='8px'" onblur="this.style.left='-9999px'">Skip to content</a>
<div id="app">${body}</div>
<script type="application/json" id="site-data">${data}</script>
<script>window.__SITE_PATH__=${JSON.stringify(route.path)}</script>
<script src="site.js" defer></script>
</body>
</html>
`
}

const README = (name) => `${name} - exported website
=====================================

This folder is a complete static website. Upload it as-is to any static host
(Netlify, Vercel, Cloudflare Pages, GitHub Pages, S3 + CDN, or your own server).

Preview locally:   npx serve .      (then open the address it prints)
Note: open it through a web server. Double-clicking index.html will not follow
folder links such as /about/ because browsers do not serve index.html from folders on file://.

Files
- index.html, <page>/index.html   Every page, already rendered for search engines
- site.js, site.css               Small runtime that makes menus, forms and buttons work
- assets/                         Your images
- site.json                       Your site in editable form. Import it back into the builder.
- sitemap.xml, robots.txt         Created when a domain is set in Site settings
- 404.html                        Shown by most hosts for missing pages

Contact form: set a form address in Site settings (any service that accepts a JSON POST),
otherwise the form opens the visitor's email app addressed to your contact email.
`

export async function exportSite(site, { onProgress, formEndpoint } = {}) {
  const { site: clean, files } = extractAssets(site, await fetchRemoteAssets(site))
  if (formEndpoint && !clean.settings.formEndpoint) clean.settings.formEndpoint = formEndpoint
  const zip = new JSZip()
  const base = import.meta.env.BASE_URL || '/'
  const [js, css] = await Promise.all(['site.js', 'site.css'].map(async (f) => {
    const r = await fetch(base + 'runtime/' + f)
    if (!r.ok) throw new Error('Runtime file missing. Run "npm run build:runtime" and reload.')
    return r.text()
  }))
  zip.file('site.js', js)
  zip.file('site.css', css)
  for (const f of files) zip.file(f.name, f.bytes)
  zip.file('site.json', JSON.stringify(clean, null, 2))
  zip.file('README.txt', README(site.settings.name))

  const origin = (site.settings.domain || '').trim().replace(/\/+$/, '')
  const routes = allRoutes(clean)
  let i = 0
  for (const r of routes) {
    const body = await renderPage(clean, r.path)
    zip.file(filePathFor(r.path), htmlDoc({ site: clean, route: r, body, depth: depthOf(r.path), origin }))
    onProgress?.(++i / routes.length)
  }
  const notFoundBody = await renderPage(clean, '/404-not-found')
  zip.file('404.html', htmlDoc({ site: clean, route: { path: '/404-not-found', title: 'Page not found', description: '' }, body: notFoundBody, depth: 0, origin: '' }))
  if (/^https?:\/\//.test(origin)) {
    const urls = routes.map((r) => `  <url><loc>${esc(origin + (r.path === '/' ? '/' : r.path + '/'))}</loc></url>`).join('\n')
    zip.file('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`)
    zip.file('robots.txt', `User-agent: *\nAllow: /\nSitemap: ${origin}/sitemap.xml\n`)
  } else zip.file('robots.txt', 'User-agent: *\nAllow: /\n')
  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' })
  return { blob, filename: slug(site.settings.name) + '-site.zip', pages: routes.length, images: files.length }
}

export function download(blob, filename) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(a.href), 2000)
}
