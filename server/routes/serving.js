import path from 'node:path'

const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml; charset=utf-8',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.gif': 'image/gif', '.webp': 'image/webp',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
}

// Serves published sites either from "<slug>.<SITES_DOMAIN>" or, for local use, from "/s/<slug>/".
// Registered on the root instance (not as an encapsulated plugin) so its hook sees every request.
export default async function servingRoutes(app) {
  const { config, db, storage } = app.ctx

  async function serve(req, reply, slug, rawPath, prefix) {
    const site = (await db.query('select id, published_version_id from sites where slug = $1', [slug])).rows[0]
    if (!site || !site.published_version_id) return reply.code(404).type('text/plain').send('Site not found.')
    let p
    try { p = decodeURIComponent(rawPath.split('?')[0]) } catch { return reply.code(400).type('text/plain').send('Bad request.') }
    if (p.includes('\0') || p.includes('\\') || p.split('/').some((s) => s === '..')) return reply.code(400).type('text/plain').send('Bad request.')
    p = p.replace(/^\/+/, '')
    const rel = p === '' || p.endsWith('/') ? p + 'index.html' : p
    let file = await storage.readSiteFile(site.id, site.published_version_id, rel)
    let name = rel
    if (!file && p && !p.endsWith('/') && !path.extname(p)) {
      // "/about" -> "/about/" so the page's relative links resolve correctly.
      if (await storage.readSiteFile(site.id, site.published_version_id, p + '/index.html')) {
        const qs = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : ''
        return reply.redirect(`${prefix}${p}/${qs}`, 301)
      }
    }
    let status = 200
    if (!file) { file = await storage.readSiteFile(site.id, site.published_version_id, '404.html'); name = '404.html'; status = 404 }
    if (!file) return reply.code(404).type('text/plain').send('Not found.')
    const ext = path.extname(name).toLowerCase()
    reply.code(status)
    reply.header('Content-Type', MIME[ext] || 'application/octet-stream')
    reply.header('X-Content-Type-Options', 'nosniff')
    reply.header('Cache-Control', ext === '.html' ? 'no-cache' : 'public, max-age=300')
    // Published pages run user-supplied content. The sandbox gives them an opaque origin, so even
    // when served from this host they cannot read cookies or call the account API as the visitor.
    reply.header('Content-Security-Policy', 'sandbox allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-modals')
    return reply.send(req.method === 'HEAD' ? '' : file.data)
  }

  if (config.sitesDomain) {
    const suffix = '.' + config.sitesDomain
    app.addHook('onRequest', async (req, reply) => {
      const host = String(req.headers.host || '').split(':')[0].toLowerCase()
      if (!host.endsWith(suffix)) return
      const slug = host.slice(0, -suffix.length)
      if (!slug || slug.includes('.')) return reply.code(404).type('text/plain').send('Site not found.')
      if (req.method !== 'GET' && req.method !== 'HEAD') return reply.code(405).send('Method not allowed.')
      return serve(req, reply, slug, req.url, '/')
    })
  }

  const pathMode = async (req, reply) => {
    const { slug } = req.params
    const rest = req.params['*'] ?? ''
    return serve(req, reply, slug, '/' + rest, `/s/${slug}/`)
  }
  app.get('/s/:slug', async (req, reply) => reply.redirect(`/s/${req.params.slug}/`, 301))
  app.get('/s/:slug/', pathMode)
  app.get('/s/:slug/*', pathMode)
}
