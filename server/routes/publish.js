import path from 'node:path'
import JSZip from 'jszip'
import { httpError } from '../app.js'
import { newId } from '../security.js'
import { ownedSite, siteUrl } from '../helpers.js'
import { validateSite } from '../../src/schema/validate.js'

const ALLOWED_EXT = new Set(['.html', '.css', '.js', '.json', '.txt', '.xml', '.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.ico'])

// Unpacks an uploaded zip without trusting it: names, count, sizes and file types are all checked
// before anything touches the disk.
export async function readSiteZip(buf, limits) {
  let zip
  try { zip = await JSZip.loadAsync(buf) } catch { throw httpError(400, 'That file is not a valid zip.') }
  const entries = Object.values(zip.files).filter((f) => !f.dir)
  if (!entries.length) throw httpError(400, 'The zip is empty.')
  if (entries.length > limits.maxZipEntries) throw httpError(400, `The zip has too many files (limit ${limits.maxZipEntries}).`)
  let total = 0
  const files = new Map()
  for (const e of entries) {
    const name = e.name
    // JSZip rewrites hostile names (e.g. ../x) to safe ones; a rewritten name means the zip was crafted, so refuse it.
    if (e.unsafeOriginalName && e.unsafeOriginalName !== name) throw httpError(400, `Unsafe file name in zip: ${String(e.unsafeOriginalName).slice(0, 60)}`)
    if (name.length > 200 || /[\\\0:]/.test(name) || name.startsWith('/') || name.split('/').some((s) => s === '..' || s === '' || s === '.')) throw httpError(400, `Unsafe file name in zip: ${name.slice(0, 60)}`)
    if (name.startsWith('__MACOSX/') || name.endsWith('.DS_Store')) continue
    if (!ALLOWED_EXT.has(path.extname(name).toLowerCase())) throw httpError(400, `File type not allowed: ${name.slice(0, 60)}`)
    const declared = e._data?.uncompressedSize
    if (typeof declared === 'number') { total += declared; if (total > limits.maxUnzippedBytes) throw httpError(413, 'The unpacked site is too large.') }
    const data = await e.async('nodebuffer')
    if (typeof declared !== 'number') { total += data.length; if (total > limits.maxUnzippedBytes) throw httpError(413, 'The unpacked site is too large.') }
    files.set(name, data)
  }
  return { files, total }
}

export default async function publishRoutes(app) {
  const { config, db, storage, limiter } = app.ctx
  const auth = { preHandler: app.requireUser }

  app.post('/sites/:id/publish', { ...auth, bodyLimit: config.limits.maxZipBytes }, async (req, reply) => {
    const site = await ownedSite(db, req.user, req.params.id)
    if (config.requireVerifiedToPublish && !req.user.verified) throw httpError(403, 'Confirm your email address before publishing. Check your inbox for the link.')
    const rl = limiter.take('publish:' + req.user.id, 30, 3600_000)
    if (!rl.ok) throw httpError(429, 'You are publishing too often. Please wait a few minutes.', { retryAfter: rl.retryAfter })
    if (!Buffer.isBuffer(req.body)) throw httpError(415, 'Send the exported site as application/zip.')

    const { files, total } = await readSiteZip(req.body, config.limits)
    if (!files.has('index.html') || !files.has('site.json')) throw httpError(400, 'The zip must contain index.html and site.json (use the builder\'s export).')
    let schema
    try { schema = JSON.parse(files.get('site.json').toString('utf8')) } catch { throw httpError(400, 'site.json is not valid JSON.') }
    const { errors } = validateSite(schema)
    if (errors.length) throw httpError(400, 'The site has problems that must be fixed first.', { details: errors })

    const versionId = newId()
    await storage.putSiteFiles(site.id, versionId, files)
    await db.query('insert into site_versions(id, site_id, schema, pages, bytes) values ($1,$2,$3::jsonb,$4,$5)', [versionId, site.id, JSON.stringify(schema), schema.pages.length, total])
    // The single UPDATE below is the atomic switch: visitors see the old version until it commits.
    await db.query('update sites set published_version_id = $1, published_at = now() where id = $2', [versionId, site.id])

    // Keep recent versions for rollback; delete the rest (never the live one).
    const old = (await db.query('select id from site_versions where site_id = $1 and id <> $2 order by created_at desc offset $3', [site.id, versionId, config.limits.maxVersionsKept - 1])).rows
    for (const o of old) { await db.query('delete from site_versions where id = $1', [o.id]); await storage.deleteVersion(site.id, o.id) }

    reply.code(201)
    return { versionId, url: siteUrl(config, site.slug), pages: schema.pages.length, bytes: total }
  })

  app.post('/sites/:id/unpublish', auth, async (req) => {
    await ownedSite(db, req.user, req.params.id)
    await db.query('update sites set published_version_id = null, published_at = null where id = $1', [req.params.id])
    return { ok: true }
  })

  app.get('/sites/:id/versions', auth, async (req) => {
    const site = await ownedSite(db, req.user, req.params.id)
    const { rows } = await db.query('select id, pages, bytes, created_at from site_versions where site_id = $1 order by created_at desc', [site.id])
    return { versions: rows.map((v) => ({ id: v.id, pages: v.pages, bytes: v.bytes, createdAt: v.created_at, live: v.id === site.published_version_id })) }
  })

  app.post('/sites/:id/rollback', auth, async (req) => {
    const site = await ownedSite(db, req.user, req.params.id)
    const v = (await db.query('select id from site_versions where id = $1 and site_id = $2', [String(req.body?.versionId || ''), site.id])).rows[0]
    if (!v) throw httpError(404, 'Version not found.')
    await db.query('update sites set published_version_id = $1, published_at = now() where id = $2', [v.id, site.id])
    return { ok: true, url: siteUrl(config, site.slug) }
  })
}
