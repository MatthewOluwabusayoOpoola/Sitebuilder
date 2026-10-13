import { blockDefs } from './blocks.js'
import { normPath, contrast } from './util.js'

// Returns { errors, warnings }. Errors block export; warnings are advice.
export function validateSite(site) {
  const errors = [], warnings = []
  if (!site || typeof site !== 'object') return { errors: ['Site data is missing.'], warnings }
  if (!Array.isArray(site.pages) || !site.pages.length) return { errors: ['The site has no pages.'], warnings }
  const seen = new Set()
  for (const p of site.pages) {
    const path = normPath(p.path)
    if (seen.has(path)) errors.push(`Two pages use the address "${path}".`)
    seen.add(path)
    if (!/^\/[a-z0-9\-/]*$/.test(path)) errors.push(`Page "${p.title}" has an invalid address "${p.path}". Use lowercase letters, numbers and dashes.`)
    if (!p.description) warnings.push(`Page "${p.title}" has no description for search engines.`)
    else if (p.description.length > 170) warnings.push(`Page "${p.title}" description is longer than 170 characters.`)
    for (const s of p.sections || []) {
      const def = blockDefs[s.type]
      if (!def) { errors.push(`Page "${p.title}" has an unknown section type "${s.type}".`); continue }
      if (s.type === 'collectionGrid' && !site.collections?.[s.props.collection]) errors.push(`A collection grid on "${p.title}" points to a collection that does not exist.`)
      if (s.type === 'hero' && s.props.image && !s.props.imageAlt) warnings.push(`Hero image on "${p.title}" has no alt text.`)
      if (s.type === 'gallery') for (const im of s.props.images) if (im.src && !im.alt) warnings.push(`A gallery image on "${p.title}" has no alt text.`)
      if (s.type === 'contactForm' && !site.settings.formEndpoint && !site.settings.contactEmail) warnings.push(`The contact form on "${p.title}" has nowhere to send messages. Add an email or form address in Site settings.`)
    }
  }
  // Internal links must point at a page or a collection item page.
  const known = new Set(seen)
  for (const [key, col] of Object.entries(site.collections || {})) if (col.detail?.enabled) for (const it of col.items) known.add(`/${key}/${it.id}`)
  const checkLink = (href, where) => {
    if (!href || /^(https?:|mailto:|tel:|#|data:)/i.test(href)) return
    if (!known.has(normPath(href))) warnings.push(`A link on ${where} points to "${href}", which is not a page on this site.`)
  }
  checkLink(site.header?.ctaLink, 'the header')
  for (const p of site.pages) for (const s of p.sections || []) for (const k of ['ctaLink']) if (s.props?.[k]) checkLink(s.props[k], `"${p.title}"`)
  for (const col of Object.values(site.collections || {})) checkLink(col.detail?.buttonLink, `"${col.label}" item pages`)
  if (!seen.has('/')) errors.push('The site needs a Home page at "/".')
  for (const [key, col] of Object.entries(site.collections || {})) {
    if (!col.items.length) warnings.push(`Collection "${col.label}" is empty.`)
    for (const it of col.items) if (it.image && !it.imageAlt) { warnings.push(`Some items in "${col.label}" have images without alt text.`); break }
  }
  const t = site.theme
  if (contrast(t.ink, t.bg) < 4.5) warnings.push(`Text colour on the background has low contrast (${contrast(t.ink, t.bg).toFixed(1)}:1, aim for 4.5:1).`)
  return { errors, warnings }
}
