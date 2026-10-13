import { normPath } from '../schema/util.js'

// Resolve a URL path to a page, a collection detail page, or "not found".
export function resolveRoute(site, rawPath) {
  const path = normPath(rawPath)
  const page = site.pages.find((p) => normPath(p.path) === path)
  if (page) return { kind: 'page', page, path }
  const parts = path.split('/').filter(Boolean)
  if (parts.length === 2) {
    const col = site.collections?.[parts[0]]
    const item = col?.detail?.enabled && col.items.find((i) => i.id === parts[1])
    if (item) return { kind: 'detail', key: parts[0], collection: col, item, path }
  }
  return { kind: 'notfound', path }
}

// Every URL the exported site will contain.
export function allRoutes(site) {
  const out = site.pages.map((p) => ({ path: normPath(p.path), title: p.title, description: p.description || '' }))
  for (const [key, col] of Object.entries(site.collections || {})) {
    if (!col.detail?.enabled) continue
    for (const item of col.items) {
      out.push({ path: `/${key}/${item.id}`, title: `${item.title} | ${site.settings.name}`, description: item.description || '', image: item.image })
    }
  }
  return out
}

export const filePathFor = (path) => (normPath(path) === '/' ? 'index.html' : normPath(path).slice(1) + '/index.html')
export const depthOf = (path) => (normPath(path) === '/' ? 0 : normPath(path).split('/').filter(Boolean).length)
