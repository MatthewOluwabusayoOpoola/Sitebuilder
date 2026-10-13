import { httpError } from '../app.js'
import { newId, normEmail, validEmail, oneLine } from '../security.js'
import { ownedSite } from '../helpers.js'

const cors = (reply) => {
  reply.header('Access-Control-Allow-Origin', '*')
  reply.header('Access-Control-Allow-Methods', 'POST, OPTIONS')
  reply.header('Access-Control-Allow-Headers', 'Content-Type, Accept')
  reply.header('Access-Control-Max-Age', '86400')
}
const csvCell = (v) => {
  let s = String(v ?? '')
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s // stop spreadsheet formula injection
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s
}

export default async function formRoutes(app) {
  const { config, db, mailer, limiter } = app.ctx
  const auth = { preHandler: app.requireUser }

  app.options('/public/forms/:siteId', async (req, reply) => { cors(reply); return reply.code(204).send() })

  // Called by the contact form on a published site (any origin). No cookies, no auth.
  app.post('/public/forms/:siteId', { bodyLimit: config.limits.maxSubmissionBytes }, async (req, reply) => {
    cors(reply)
    const siteId = req.params.siteId
    for (const [k, max, win] of [[`form-min:${siteId}:${req.ip}`, 5, 60_000], [`form-hr:${siteId}:${req.ip}`, 30, 3600_000]]) {
      const r = limiter.take(k, max, win)
      if (!r.ok) throw httpError(429, 'Too many messages. Please try again later.', { retryAfter: r.retryAfter })
    }
    const b = req.body && typeof req.body === 'object' ? req.body : null
    if (!b) throw httpError(400, 'Send the form as JSON.')
    const site = (await db.query('select s.id, s.name, s.owner_id, u.email as owner_email from sites s join users u on u.id = s.owner_id where s.id = $1 and s.published_version_id is not null', [siteId])).rows[0]
    if (!site) throw httpError(404, 'This form is not available.')
    if (b.company) return { ok: true } // honeypot: pretend success so bots learn nothing
    const name = String(b.name ?? '').trim(), email = normEmail(b.email), message = String(b.message ?? '').trim()
    if (!name || name.length > 200) throw httpError(400, 'Please enter your name.')
    if (!validEmail(email)) throw httpError(400, 'Please enter a valid email address.')
    if (!message || message.length > 5000) throw httpError(400, 'Please enter a message under 5000 characters.')
    const today = Number((await db.query("select count(*) as n from form_submissions where site_id = $1 and created_at > now() - interval '1 day'", [site.id])).rows[0].n)
    if (today >= config.limits.maxSubmissionsPerDay) throw httpError(429, 'This form is receiving too many messages right now.')
    await db.query('insert into form_submissions(id, site_id, payload) values ($1,$2,$3::jsonb)', [newId(), site.id, JSON.stringify({ name, email, message })])
    // Notify the owner; a mail failure must not lose the message (it is already stored).
    mailer.send({ to: site.owner_email, subject: `New message on ${site.name} from ${name}`, text: `${name} <${email}> wrote:\n\n${message}\n\nReply directly to ${email}, or read it in your inbox.` })
      .catch((e) => req.log.error({ err: e }, 'form notification failed'))
    reply.code(202)
    return { ok: true }
  })

  app.get('/sites/:id/submissions', auth, async (req) => {
    await ownedSite(db, req.user, req.params.id, 'id')
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50))
    const before = req.query.before && !Number.isNaN(Date.parse(req.query.before)) ? new Date(req.query.before).toISOString() : null
    const { rows } = await db.query(
      `select id, payload, read_at, created_at from form_submissions where site_id = $1 ${before ? 'and created_at < $3' : ''} order by created_at desc limit $2`,
      before ? [req.params.id, limit + 1, before] : [req.params.id, limit + 1])
    const more = rows.length > limit
    const items = rows.slice(0, limit).map((r) => ({ id: r.id, ...r.payload, read: !!r.read_at, createdAt: r.created_at }))
    return { items, next: more ? new Date(items.at(-1).createdAt).toISOString() : null }
  })

  app.get('/sites/:id/submissions.csv', auth, async (req, reply) => {
    const site = await ownedSite(db, req.user, req.params.id, 'id, slug')
    const { rows } = await db.query('select payload, created_at from form_submissions where site_id = $1 order by created_at desc limit 10000', [site.id])
    const lines = ['received,name,email,message', ...rows.map((r) => [new Date(r.created_at).toISOString(), r.payload.name, r.payload.email, r.payload.message].map(csvCell).join(','))]
    reply.header('Content-Type', 'text/csv; charset=utf-8')
    reply.header('Content-Disposition', `attachment; filename="${site.slug}-messages.csv"`)
    return lines.join('\r\n') + '\r\n'
  })

  app.patch('/submissions/:id', auth, async (req) => {
    const read = req.body?.read !== false
    const { rows } = await db.query(
      `update form_submissions f set read_at = ${read ? 'coalesce(f.read_at, now())' : 'null'} from sites s
        where f.id = $1 and f.site_id = s.id and s.owner_id = $2 returning f.id`, [req.params.id, req.user.id])
    if (!rows[0]) throw httpError(404, 'Message not found.')
    return { ok: true }
  })

  app.delete('/submissions/:id', auth, async (req) => {
    const { rows } = await db.query(
      'delete from form_submissions f using sites s where f.id = $1 and f.site_id = s.id and s.owner_id = $2 returning f.id', [req.params.id, req.user.id])
    if (!rows[0]) throw httpError(404, 'Message not found.')
    return { ok: true }
  })
}
