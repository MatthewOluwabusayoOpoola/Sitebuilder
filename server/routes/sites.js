import { httpError } from '../app.js'
import { newId } from '../security.js'
import { checkDraftShape, siteName, uniqueSlug, ownedSite, siteUrl, SLUG_RE, RESERVED_SLUGS } from '../helpers.js'

export default async function siteRoutes(app) {
  const { config, db, storage } = app.ctx
  const auth = { preHandler: app.requireUser }
  const present = (r) => ({
    id: r.id, name: r.name, slug: r.slug, revision: r.revision,
    updatedAt: r.updated_at, publishedAt: r.published_at,
    url: r.published_version_id ? siteUrl(config, r.slug) : null,
    unread: Number(r.unread || 0),
  })

  app.get('/sites', auth, async (req) => {
    const { rows } = await db.query(
      `select s.id, s.name, s.slug, s.revision, s.updated_at, s.published_at, s.published_version_id,
              (select count(*) from form_submissions f where f.site_id = s.id and f.read_at is null) as unread
         from sites s where s.owner_id = $1 order by s.updated_at desc`, [req.user.id])
    return { sites: rows.map(present) }
  })

  app.post('/sites', auth, async (req, reply) => {
    const count = Number((await db.query('select count(*) as n from sites where owner_id = $1', [req.user.id])).rows[0].n)
    if (count >= config.limits.maxSites) throw httpError(403, `You can have up to ${config.limits.maxSites} sites.`)
    const schema = req.body?.schema
    checkDraftShape(schema, config)
    const id = newId()
    const slug = await uniqueSlug(db, siteName(schema))
    const { rows } = await db.query(
      'insert into sites(id, owner_id, name, slug, draft) values ($1,$2,$3,$4,$5::jsonb) returning id, name, slug, revision, updated_at, published_at, published_version_id',
      [id, req.user.id, siteName(schema), slug, JSON.stringify(schema)])
    reply.code(201)
    return { site: present(rows[0]) }
  })

  app.get('/sites/:id', auth, async (req) => {
    const { rows } = await db.query('select id, name, slug, draft, revision, updated_at, published_at, published_version_id from sites where id = $1 and owner_id = $2', [req.params.id, req.user.id])
    if (!rows[0]) throw httpError(404, 'Site not found.')
    return { site: present(rows[0]), schema: rows[0].draft }
  })

  // Optimistic concurrency: the client sends the revision it last saw. If someone (another tab,
  // another device) saved in between, we answer 409 instead of silently overwriting their work.
  app.put('/sites/:id', auth, async (req) => {
    const { schema, revision } = req.body || {}
    checkDraftShape(schema, config)
    if (!Number.isInteger(revision)) throw httpError(400, 'Missing revision.')
    const { rows } = await db.query(
      `update sites set draft = $3::jsonb, name = $4, revision = revision + 1, updated_at = now()
        where id = $1 and owner_id = $2 and revision = $5 returning revision, updated_at`,
      [req.params.id, req.user.id, JSON.stringify(schema), siteName(schema), revision])
    if (!rows[0]) {
      const cur = await db.query('select revision from sites where id = $1 and owner_id = $2', [req.params.id, req.user.id])
      if (!cur.rows[0]) throw httpError(404, 'Site not found.')
      throw httpError(409, 'This site was changed somewhere else.', { details: { revision: cur.rows[0].revision } })
    }
    return { revision: rows[0].revision, updatedAt: rows[0].updated_at }
  })

  app.delete('/sites/:id', auth, async (req) => {
    await ownedSite(db, req.user, req.params.id)
    const assets = (await db.query('select id from assets where site_id = $1', [req.params.id])).rows
    await db.query('delete from sites where id = $1 and owner_id = $2', [req.params.id, req.user.id]) // cascades
    await storage.deleteSite(req.params.id)
    for (const a of assets) await storage.deleteAsset(a.id)
    return { ok: true }
  })

  app.patch('/sites/:id/slug', auth, async (req) => {
    const slug = String(req.body?.slug || '').toLowerCase().trim()
    if (!SLUG_RE.test(slug)) throw httpError(400, 'Use 3 to 40 lowercase letters, numbers or dashes.')
    if (RESERVED_SLUGS.has(slug)) throw httpError(400, 'That address is reserved.')
    await ownedSite(db, req.user, req.params.id)
    try {
      await db.query('update sites set slug = $1 where id = $2 and owner_id = $3', [slug, req.params.id, req.user.id])
    } catch (e) {
      if (/unique|duplicate/i.test(e.message)) throw httpError(409, 'That address is taken.')
      throw e
    }
    return { slug, url: siteUrl(config, slug) }
  })
}
