import { httpError } from '../app.js'
import { newId, sha256 } from '../security.js'
import { ownedSite } from '../helpers.js'

// Identify the real file type from its first bytes; never trust the declared type alone.
export function sniffImage(buf) {
  if (buf.length < 12) return null
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'image/png'
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg'
  if (buf.toString('ascii', 0, 4) === 'GIF8') return 'image/gif'
  if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return 'image/webp'
  return null
}

export default async function assetRoutes(app) {
  const { config, db, storage } = app.ctx
  const auth = { preHandler: app.requireUser }

  app.post('/sites/:id/assets', { ...auth, bodyLimit: config.limits.maxAssetBytes }, async (req, reply) => {
    const site = await ownedSite(db, req.user, req.params.id, 'id')
    const buf = req.body
    if (!Buffer.isBuffer(buf) || !buf.length) throw httpError(415, 'Send the image as the request body (PNG, JPEG, WebP or GIF).')
    const mime = sniffImage(buf)
    if (!mime) throw httpError(415, 'That file is not a supported image.')
    if (req.headers['content-type']?.split(';')[0] !== mime) throw httpError(415, 'The file type does not match its contents.')
    const hash = sha256(buf)
    const dupe = await db.query('select id from assets where site_id = $1 and sha256 = $2', [site.id, hash])
    if (dupe.rows[0]) return { id: dupe.rows[0].id, url: `/api/assets/${dupe.rows[0].id}`, duplicate: true }
    const usage = (await db.query('select count(*) as n, coalesce(sum(bytes),0) as b from assets where owner_id = $1', [req.user.id])).rows[0]
    if (Number(usage.n) >= config.limits.maxAssetsPerUser) throw httpError(403, 'You have reached the image limit for your account.')
    if (Number(usage.b) + buf.length > config.limits.maxStoragePerUser) throw httpError(403, 'You have reached the storage limit for your account.')
    const id = newId()
    await storage.putAsset(id, buf)
    await db.query('insert into assets(id, owner_id, site_id, mime, bytes, sha256) values ($1,$2,$3,$4,$5,$6)', [id, req.user.id, site.id, mime, buf.length, hash])
    reply.code(201)
    return { id, url: `/api/assets/${id}` }
  })

  // Public and immutable: ids are random and a file never changes, so it can be cached forever.
  app.get('/assets/:id', async (req, reply) => {
    const { rows } = await db.query('select mime from assets where id = $1', [req.params.id])
    if (!rows[0]) throw httpError(404, 'Not found.')
    let data
    try { data = await storage.getAsset(req.params.id) } catch { throw httpError(404, 'Not found.') }
    reply.header('Content-Type', rows[0].mime)
    reply.header('Cache-Control', 'public, max-age=31536000, immutable')
    reply.header('Cross-Origin-Resource-Policy', 'cross-origin')
    reply.header('Content-Security-Policy', "default-src 'none'; sandbox")
    return reply.send(data)
  })

  app.delete('/assets/:id', auth, async (req) => {
    const { rows } = await db.query('delete from assets where id = $1 and owner_id = $2 returning id', [req.params.id, req.user.id])
    if (!rows[0]) throw httpError(404, 'Not found.')
    await storage.deleteAsset(req.params.id)
    return { ok: true }
  })
}
