import crypto from 'node:crypto'
import { httpError } from './app.js'

export const RESERVED_SLUGS = new Set(['www', 'api', 'app', 'admin', 'mail', 'ftp', 'static', 'assets', 's', 'sites', 'blog', 'help', 'support', 'status', 'cdn'])
export const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{1,38})[a-z0-9]$/

export const slugify = (s) => String(s || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30)

export function siteUrl(config, slug) {
  if (config.sitesDomain) {
    const proto = config.publicUrl.startsWith('https') ? 'https' : 'http'
    return `${proto}://${slug}.${config.sitesDomain}/`
  }
  return `${config.publicUrl}/s/${slug}/`
}

// A draft may be unfinished, so we only enforce shape and size here; full checks run at publish.
export function checkDraftShape(schema, config) {
  if (!schema || typeof schema !== 'object' || Array.isArray(schema)) throw httpError(400, 'Site data is missing.')
  if (schema.schemaVersion !== 1) throw httpError(400, 'Unsupported site format.')
  if (!schema.theme || typeof schema.theme !== 'object' || !schema.settings || typeof schema.settings !== 'object') throw httpError(400, 'Site data is incomplete.')
  if (!Array.isArray(schema.pages) || schema.pages.length < 1 || schema.pages.length > 60) throw httpError(400, 'A site needs between 1 and 60 pages.')
  if (schema.collections && (typeof schema.collections !== 'object' || Array.isArray(schema.collections))) throw httpError(400, 'Site data is incomplete.')
  const size = Buffer.byteLength(JSON.stringify(schema))
  if (size > config.limits.maxDraftBytes) throw httpError(413, 'This site is too large to save. Upload images instead of embedding them.')
  return size
}

export const siteName = (schema) => String(schema.settings?.name || 'Untitled site').trim().slice(0, 100) || 'Untitled site'

export async function uniqueSlug(db, base) {
  let root = slugify(base)
  if (root.length < 3 || RESERVED_SLUGS.has(root)) root = 'site-' + root
  root = root.replace(/^-+|-+$/g, '').slice(0, 30)
  for (let i = 0; i < 6; i++) {
    const slug = i === 0 ? root : `${root}-${crypto.randomBytes(2).toString('hex')}`
    if (SLUG_RE.test(slug) && !RESERVED_SLUGS.has(slug) && !(await db.query('select 1 from sites where slug = $1', [slug])).rows[0]) return slug
  }
  return `site-${crypto.randomBytes(5).toString('hex')}`
}

// Loads a site only if the signed-in user owns it. Other users get the same 404 as a missing site.
export async function ownedSite(db, user, id, columns = 'id, owner_id, name, slug, revision, published_version_id, published_at') {
  const { rows } = await db.query(`select ${columns} from sites where id = $1 and owner_id = $2`, [id, user.id])
  if (!rows[0]) throw httpError(404, 'Site not found.')
  return rows[0]
}
