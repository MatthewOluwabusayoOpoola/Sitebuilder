import { httpError } from '../app.js'
import { newId, newToken, sha256, hashPassword, verifyPassword, DUMMY_HASH, normEmail, validEmail } from '../security.js'

export default async function authRoutes(app) {
  const { config, db, mailer, limiter, storage } = app.ctx
  const ip = (req) => req.ip

  function limit(key, max, windowMs, message = 'Too many attempts. Please wait and try again.') {
    const r = limiter.take(key, max, windowMs)
    if (!r.ok) throw httpError(429, message, { retryAfter: r.retryAfter })
  }

  async function startSession(reply, userId) {
    const token = newToken()
    const expires = new Date(Date.now() + config.limits.sessionDays * 86400_000)
    await db.query('insert into sessions(id, user_id, expires_at) values ($1,$2,$3)', [sha256(token), userId, expires.toISOString()])
    reply.setCookie('sid', token, { httpOnly: true, sameSite: 'lax', secure: config.cookieSecure, path: '/', expires })
  }

  async function issueToken(userId, kind, ttlMs) {
    const token = newToken()
    await db.query('delete from auth_tokens where user_id = $1 and kind = $2', [userId, kind]) // one live token per kind
    await db.query('insert into auth_tokens(id, user_id, kind, expires_at) values ($1,$2,$3,$4)', [sha256(token), userId, kind, new Date(Date.now() + ttlMs).toISOString()])
    return token
  }
  async function consumeToken(token, kind) {
    const { rows } = await db.query(
      'update auth_tokens set used_at = now() where id = $1 and kind = $2 and used_at is null and expires_at > now() returning user_id',
      [sha256(String(token || '')), kind],
    )
    return rows[0]?.user_id || null
  }
  async function sendVerification(user) {
    const token = await issueToken(user.id, 'verify', 3 * 86400_000)
    await mailer.send({ to: user.email, subject: 'Confirm your email', text: `Welcome! Confirm your email address to publish sites:\n\n${config.appUrl}/#/verify/${token}\n\nIf you did not sign up, ignore this message.` })
  }
  const publicUser = (u) => ({ id: u.id, email: u.email, verified: !!(u.verified ?? u.email_verified_at) })
  const pwCheck = (pw) => {
    if (typeof pw !== 'string' || pw.length < 10) throw httpError(400, 'Use a password of at least 10 characters.')
    if (pw.length > 200) throw httpError(400, 'That password is too long.')
  }

  app.post('/signup', async (req, reply) => {
    limit('signup:' + ip(req), 10, 3600_000)
    const email = normEmail(req.body?.email)
    if (!validEmail(email)) throw httpError(400, 'Enter a valid email address.')
    pwCheck(req.body?.password)
    const exists = await db.query('select 1 from users where email = $1', [email])
    if (exists.rows[0]) throw httpError(409, 'An account with that email already exists. Try signing in.')
    const user = { id: newId(), email }
    await db.query('insert into users(id, email, password_hash) values ($1,$2,$3)', [user.id, email, await hashPassword(req.body.password)])
    await sendVerification(user)
    await startSession(reply, user.id)
    reply.code(201)
    return { user: publicUser({ ...user, verified: false }) }
  })

  app.post('/login', async (req, reply) => {
    const email = normEmail(req.body?.email)
    limit('login-ip:' + ip(req), 40, 15 * 60_000)
    limit('login-email:' + email, 8, 15 * 60_000)
    const { rows } = await db.query('select id, email, password_hash, email_verified_at from users where email = $1', [email])
    const user = rows[0]
    const ok = await verifyPassword(String(req.body?.password ?? ''), user ? user.password_hash : DUMMY_HASH)
    if (!user || !ok) throw httpError(401, 'Email or password is incorrect.')
    limiter.reset('login-email:' + email)
    await startSession(reply, user.id)
    return { user: publicUser(user) }
  })

  app.post('/logout', async (req, reply) => {
    if (req.cookies.sid) await db.query('delete from sessions where id = $1', [sha256(req.cookies.sid)])
    reply.clearCookie('sid', { path: '/' })
    return { ok: true }
  })

  app.get('/me', async (req) => {
    try { await app.requireUser(req) } catch { return { user: null, publicUrl: config.publicUrl } }
    return { user: publicUser(req.user), publicUrl: config.publicUrl }
  })

  app.post('/verify', async (req) => {
    const userId = await consumeToken(req.body?.token, 'verify')
    if (!userId) throw httpError(400, 'That link has expired or was already used.')
    await db.query('update users set email_verified_at = coalesce(email_verified_at, now()) where id = $1', [userId])
    return { ok: true }
  })

  app.post('/resend-verification', { preHandler: app.requireUser }, async (req) => {
    if (req.user.verified) return { ok: true }
    limit('resend:' + req.user.id, 3, 3600_000)
    await sendVerification(req.user)
    return { ok: true }
  })

  // Always answers the same way so the form cannot be used to discover which emails have accounts.
  app.post('/forgot', async (req, reply) => {
    limit('forgot-ip:' + ip(req), 10, 3600_000)
    const email = normEmail(req.body?.email)
    if (validEmail(email)) {
      limit('forgot-email:' + email, 3, 3600_000)
      const { rows } = await db.query('select id, email from users where email = $1', [email])
      if (rows[0]) {
        const token = await issueToken(rows[0].id, 'reset', 3600_000)
        await mailer.send({ to: rows[0].email, subject: 'Reset your password', text: `Use this link within one hour to choose a new password:\n\n${config.appUrl}/#/reset/${token}\n\nIf you did not ask for this, ignore this message.` })
      }
    }
    reply.code(202)
    return { ok: true }
  })

  app.post('/reset', async (req) => {
    limit('reset-ip:' + ip(req), 20, 3600_000)
    pwCheck(req.body?.password)
    const userId = await consumeToken(req.body?.token, 'reset')
    if (!userId) throw httpError(400, 'That link has expired or was already used.')
    await db.query('update users set password_hash = $2 where id = $1', [userId, await hashPassword(req.body.password)])
    await db.query('delete from sessions where user_id = $1', [userId]) // sign out everywhere
    return { ok: true }
  })

  // GDPR-style erasure: removes the account, its sites, submissions and every stored file.
  app.delete('/account', { preHandler: app.requireUser }, async (req, reply) => {
    limit('delete-account:' + req.user.id, 5, 3600_000)
    const { rows } = await db.query('select password_hash from users where id = $1', [req.user.id])
    if (!(await verifyPassword(String(req.body?.password ?? ''), rows[0].password_hash))) throw httpError(403, 'Password is incorrect.')
    const sites = (await db.query('select id from sites where owner_id = $1', [req.user.id])).rows
    const assets = (await db.query('select id from assets where owner_id = $1', [req.user.id])).rows
    await db.query('delete from users where id = $1', [req.user.id]) // cascades to every table
    for (const s of sites) await storage.deleteSite(s.id)
    for (const a of assets) await storage.deleteAsset(a.id)
    reply.clearCookie('sid', { path: '/' })
    return { ok: true }
  })
}
