import Fastify from 'fastify'
import cookie from '@fastify/cookie'
import { createLimiter } from './ratelimit.js'
import { sha256 } from './security.js'
import authRoutes from './routes/auth.js'
import siteRoutes from './routes/sites.js'
import assetRoutes from './routes/assets.js'
import formRoutes from './routes/forms.js'
import publishRoutes from './routes/publish.js'
import servingRoutes from './routes/serving.js'

export const httpError = (statusCode, message, extra = {}) => Object.assign(new Error(message), { statusCode, ...extra })

export async function buildApp({ config, db, mailer, storage, limiter = createLimiter() }) {
  const app = Fastify({
    logger: config.logLevel === 'silent' ? false : { level: config.logLevel },
    bodyLimit: config.limits.maxDraftBytes + 64 * 1024,
    trustProxy: config.trustProxy,
  })
  await app.register(cookie)
  app.decorate('ctx', { config, db, mailer, storage, limiter })
  app.decorateRequest('user', null)

  // Raw binary bodies for uploads and publishing.
  app.addContentTypeParser(['image/png', 'image/jpeg', 'image/webp', 'image/gif'], { parseAs: 'buffer', bodyLimit: config.limits.maxAssetBytes }, (_r, body, done) => done(null, body))
  app.addContentTypeParser('application/zip', { parseAs: 'buffer', bodyLimit: config.limits.maxZipBytes }, (_r, body, done) => done(null, body))

  app.addHook('onRequest', async (req, reply) => {
    reply.header('X-Content-Type-Options', 'nosniff')
    reply.header('Referrer-Policy', 'strict-origin-when-cross-origin')
    if (req.url.startsWith('/api/')) reply.header('Cache-Control', 'no-store')
    // CSRF: cookies are SameSite=Lax, and every state-changing API call must also carry a
    // custom header, which browsers will not let a foreign site attach without CORS approval.
    const unsafe = !['GET', 'HEAD', 'OPTIONS'].includes(req.method)
    if (unsafe && req.url.startsWith('/api/') && !req.url.startsWith('/api/public/') && req.headers['x-requested-with'] !== 'sitebuilder') {
      throw httpError(403, 'Missing request header.')
    }
  })

  app.decorate('requireUser', async (req) => {
    const token = req.cookies.sid
    if (!token) throw httpError(401, 'Please sign in.')
    const { rows } = await db.query(
      'select u.id, u.email, u.email_verified_at from sessions s join users u on u.id = s.user_id where s.id = $1 and s.expires_at > now()',
      [sha256(token)],
    )
    if (!rows[0]) throw httpError(401, 'Please sign in.')
    req.user = { id: rows[0].id, email: rows[0].email, verified: !!rows[0].email_verified_at }
  })

  app.setErrorHandler((err, req, reply) => {
    const status = err.statusCode && err.statusCode >= 400 && err.statusCode < 600 ? err.statusCode : 500
    if (status >= 500) req.log.error(err)
    if (err.retryAfter) reply.header('Retry-After', String(err.retryAfter))
    reply.code(status).send({ error: status >= 500 ? 'Something went wrong on our side.' : err.message, ...(err.details ? { details: err.details } : {}) })
  })
  app.setNotFoundHandler((req, reply) => reply.code(404).send({ error: 'Not found.' }))

  await servingRoutes(app)
  await app.register(authRoutes, { prefix: '/api/auth' })
  await app.register(siteRoutes, { prefix: '/api' })
  await app.register(assetRoutes, { prefix: '/api' })
  await app.register(formRoutes, { prefix: '/api' })
  await app.register(publishRoutes, { prefix: '/api' })
  app.get('/api/health', async () => ({ ok: true }))

  const sweeper = setInterval(() => limiter.sweep(), 60_000)
  sweeper.unref()
  app.addHook('onClose', async () => clearInterval(sweeper))
  return app
}
