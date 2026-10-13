import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import JSZip from 'jszip'
import { loadConfig } from './config.js'
import { createDb } from './db.js'
import { migrate } from './migrations.js'
import { createMailer } from './mailer.js'
import { createStorage } from './storage.js'
import { buildApp } from './app.js'
import { buildSite } from '../src/schema/templates.js'

const PW = 'correct horse battery'
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==', 'base64')
const basics = { name: 'Acme Studio', email: 'owner@acme.test', phone: '', address: '' }
const schemaFor = (name = 'Acme Studio') => buildSite({ templateId: 'agency', pageIds: ['work'], basics: { ...basics, name } })

let ctx, sharedDb
async function setup(env = {}) {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-'))
  const config = loadConfig({ LOG_LEVEL: 'silent', DATA_DIR: dataDir, REQUIRE_VERIFIED: '1', ...env })
  const db = sharedDb // one in-memory Postgres for the whole file; tables are emptied between tests
  const mailer = await createMailer(config)
  const storage = createStorage(config)
  const app = await buildApp({ config, db, mailer, storage })
  return { app, db, mailer, storage, config, dataDir }
}

// A tiny browser: keeps cookies between calls and adds the CSRF header like the real client does.
function agent(app, { csrf = true } = {}) {
  let sid = ''
  const call = async (method, url, payload, opts = {}) => {
    const headers = { ...(csrf ? { 'x-requested-with': 'sitebuilder' } : {}), ...(sid ? { cookie: 'sid=' + sid } : {}), ...(opts.headers || {}) }
    const res = await app.inject({ method, url, headers, payload, ...(opts.raw ? {} : {}) })
    const c = res.cookies.find((x) => x.name === 'sid')
    if (c) sid = c.value || ''
    let json = null
    try { json = JSON.parse(res.body) } catch { /* not json */ }
    return { status: res.statusCode, json, res, body: res.body }
  }
  return { call, get sid() { return sid } }
}
async function signup(app, mailer, email = 'owner@acme.test', verify = false) {
  const a = agent(app)
  const r = await a.call('POST', '/api/auth/signup', { email, password: PW })
  expect(r.status).toBe(201)
  if (verify) {
    const msg = mailer.outbox.filter((m) => m.to === email && /Confirm/.test(m.subject)).at(-1)
    const token = /verify\/([\w-]+)/.exec(msg.text)[1]
    expect((await a.call('POST', '/api/auth/verify', { token })).status).toBe(200)
  }
  return a
}
// JSZip refuses to write a '../' name, so craft one: same-length name, then patch the raw bytes.
async function traversalZip(schema) {
  const zip = new JSZip()
  zip.file('index.html', 'x'); zip.file('site.json', JSON.stringify(schema)); zip.file('aa/x.html', 'evil')
  const buf = await zip.generateAsync({ type: 'nodebuffer' })
  let at = 0, n = 0
  while ((at = buf.indexOf('aa/x.html', at)) !== -1) { buf.write('../x.html', at); at += 9; n++ }
  expect(n).toBe(2) // local header + central directory
  return buf
}
async function makeZip(schema, extra = {}) {
  const zip = new JSZip()
  zip.file('index.html', '<!doctype html><title>Home</title><h1>HOME PAGE v' + (extra.v || 1) + '</h1>')
  zip.file('about/index.html', '<h1>ABOUT</h1>')
  zip.file('404.html', '<h1>NOT FOUND PAGE</h1>')
  zip.file('site.css', 'body{}'); zip.file('site.js', 'void 0')
  zip.file('site.json', JSON.stringify(schema))
  for (const [k, v] of Object.entries(extra.files || {})) zip.file(k, v)
  return zip.generateAsync({ type: 'nodebuffer' })
}
const publish = (a, id, buf) => a.call('POST', `/api/sites/${id}/publish`, buf, { headers: { 'content-type': 'application/zip' } })
const upload = (a, id, buf, type = 'image/png') => a.call('POST', `/api/sites/${id}/assets`, buf, { headers: { 'content-type': type } })
async function newSite(a, name) { const r = await a.call('POST', '/api/sites', { schema: schemaFor(name) }); expect(r.status).toBe(201); return r.json.site }

beforeAll(async () => { sharedDb = await createDb(loadConfig({}), { memory: true }); await migrate(sharedDb) })
afterAll(async () => { await sharedDb.close() })
beforeEach(async () => { ctx = await setup() })
afterEach(async () => {
  await ctx.app.close()
  await sharedDb.query('truncate users cascade')
  fs.rmSync(ctx.dataDir, { recursive: true, force: true })
})

describe('accounts', () => {
  it('signs up, reads the session, signs out', async () => {
    const a = await signup(ctx.app, ctx.mailer)
    expect((await a.call('GET', '/api/auth/me')).json.user.email).toBe('owner@acme.test')
    expect((await a.call('POST', '/api/auth/logout')).status).toBe(200)
    expect((await a.call('GET', '/api/auth/me')).json.user).toBeNull()
  })
  it('rejects weak passwords, bad emails and duplicates', async () => {
    const a = agent(ctx.app)
    expect((await a.call('POST', '/api/auth/signup', { email: 'x@y.co', password: 'short' })).status).toBe(400)
    expect((await a.call('POST', '/api/auth/signup', { email: 'nope', password: PW })).status).toBe(400)
    await signup(ctx.app, ctx.mailer, 'dup@acme.test')
    expect((await agent(ctx.app).call('POST', '/api/auth/signup', { email: 'DUP@acme.test', password: PW })).status).toBe(409)
  })
  it('stores a salted hash, never the password, and only a hash of the session token', async () => {
    const a = await signup(ctx.app, ctx.mailer)
    const u = (await ctx.db.query('select password_hash from users')).rows[0]
    expect(u.password_hash.startsWith('scrypt$')).toBe(true)
    expect(u.password_hash).not.toContain(PW)
    const s = (await ctx.db.query('select id from sessions')).rows[0]
    expect(s.id).not.toBe(a.sid)
  })
  it('gives the same error for a wrong password and an unknown email', async () => {
    await signup(ctx.app, ctx.mailer)
    const a = agent(ctx.app)
    const wrong = await a.call('POST', '/api/auth/login', { email: 'owner@acme.test', password: 'not the password' })
    const none = await a.call('POST', '/api/auth/login', { email: 'ghost@acme.test', password: 'not the password' })
    expect(wrong.status).toBe(401); expect(none.status).toBe(401)
    expect(wrong.json.error).toBe(none.json.error)
  })
  it('throttles repeated login attempts', async () => {
    await signup(ctx.app, ctx.mailer)
    const a = agent(ctx.app)
    let last
    for (let i = 0; i < 9; i++) last = await a.call('POST', '/api/auth/login', { email: 'owner@acme.test', password: 'wrong wrong wrong' })
    expect(last.status).toBe(429)
    expect(last.res.headers['retry-after']).toBeTruthy()
  })
  it('refuses state-changing calls without the CSRF header', async () => {
    const r = await agent(ctx.app, { csrf: false }).call('POST', '/api/auth/login', { email: 'a@b.co', password: PW })
    expect(r.status).toBe(403)
  })
  it('verifies email once and the link then stops working', async () => {
    const a = await signup(ctx.app, ctx.mailer, 'v@acme.test')
    const token = /verify\/([\w-]+)/.exec(ctx.mailer.outbox.at(-1).text)[1]
    expect((await a.call('POST', '/api/auth/verify', { token })).status).toBe(200)
    expect((await a.call('GET', '/api/auth/me')).json.user.verified).toBe(true)
    expect((await a.call('POST', '/api/auth/verify', { token })).status).toBe(400)
  })
  it('resets a password, signs out other sessions, and answers forgot the same for unknown emails', async () => {
    const a = await signup(ctx.app, ctx.mailer)
    const before = ctx.mailer.outbox.length
    expect((await agent(ctx.app).call('POST', '/api/auth/forgot', { email: 'ghost@acme.test' })).status).toBe(202)
    expect(ctx.mailer.outbox.length).toBe(before) // nothing sent, nothing revealed
    expect((await agent(ctx.app).call('POST', '/api/auth/forgot', { email: 'owner@acme.test' })).status).toBe(202)
    const token = /reset\/([\w-]+)/.exec(ctx.mailer.outbox.at(-1).text)[1]
    const b = agent(ctx.app)
    expect((await b.call('POST', '/api/auth/reset', { token, password: 'a brand new passphrase' })).status).toBe(200)
    expect((await a.call('GET', '/api/auth/me')).json.user).toBeNull()
    expect((await b.call('POST', '/api/auth/reset', { token, password: 'another passphrase here' })).status).toBe(400)
    expect((await agent(ctx.app).call('POST', '/api/auth/login', { email: 'owner@acme.test', password: PW })).status).toBe(401)
    expect((await agent(ctx.app).call('POST', '/api/auth/login', { email: 'owner@acme.test', password: 'a brand new passphrase' })).status).toBe(200)
  })
})

describe('sites and revisions', () => {
  it('creates, lists, loads, saves with revisions and deletes', async () => {
    const a = await signup(ctx.app, ctx.mailer)
    const site = await newSite(a, 'Acme Studio')
    expect(site.slug).toBe('acme-studio')
    expect((await a.call('GET', '/api/sites')).json.sites).toHaveLength(1)
    const got = (await a.call('GET', `/api/sites/${site.id}`)).json
    got.schema.settings.name = 'Renamed'
    const put = await a.call('PUT', `/api/sites/${site.id}`, { schema: got.schema, revision: got.site.revision })
    expect(put.json.revision).toBe(got.site.revision + 1)
    expect((await a.call('GET', '/api/sites')).json.sites[0].name).toBe('Renamed')
    expect((await a.call('DELETE', `/api/sites/${site.id}`)).status).toBe(200)
    expect((await a.call('GET', `/api/sites/${site.id}`)).status).toBe(404)
  })
  it('answers 409 instead of overwriting when the revision is stale', async () => {
    const a = await signup(ctx.app, ctx.mailer)
    const site = await newSite(a)
    const s = schemaFor()
    expect((await a.call('PUT', `/api/sites/${site.id}`, { schema: s, revision: 1 })).status).toBe(200)
    const stale = await a.call('PUT', `/api/sites/${site.id}`, { schema: s, revision: 1 })
    expect(stale.status).toBe(409)
    expect(stale.json.details.revision).toBe(2)
  })
  it('rejects malformed or oversized site data', async () => {
    const a = await signup(ctx.app, ctx.mailer)
    expect((await a.call('POST', '/api/sites', { schema: { hello: 1 } })).status).toBe(400)
    expect((await a.call('POST', '/api/sites', { schema: null })).status).toBe(400)
    const big = schemaFor(); big.settings.blob = 'x'.repeat(2.2 * 1024 * 1024)
    expect([400, 413]).toContain((await a.call('POST', '/api/sites', { schema: big })).status)
  })
  it('gives each site a unique, safe address and enforces the per-user limit', async () => {
    const a = await signup(ctx.app, ctx.mailer)
    const s1 = await newSite(a, 'Same Name'), s2 = await newSite(a, 'Same Name')
    expect(s1.slug).not.toBe(s2.slug)
    const reserved = await newSite(a, 'Admin')
    expect(reserved.slug).not.toBe('admin')
    expect((await a.call('PATCH', `/api/sites/${s1.id}/slug`, { slug: 'www' })).status).toBe(400)
    expect((await a.call('PATCH', `/api/sites/${s1.id}/slug`, { slug: 'Bad Slug!' })).status).toBe(400)
    expect((await a.call('PATCH', `/api/sites/${s1.id}/slug`, { slug: s2.slug })).status).toBe(409)
    expect((await a.call('PATCH', `/api/sites/${s1.id}/slug`, { slug: 'my-cafe' })).json.slug).toBe('my-cafe')
  })
  it('caps how many sites one account can create', async () => {
    await ctx.app.close()
    ctx = await setup({ MAX_SITES_PER_USER: '2' })
    const a = await signup(ctx.app, ctx.mailer)
    await newSite(a, 'One'); await newSite(a, 'Two')
    expect((await a.call('POST', '/api/sites', { schema: schemaFor('Three') })).status).toBe(403)
  })
})

describe('tenant isolation', () => {
  it('never lets one account see or change another account\'s data', async () => {
    const a = await signup(ctx.app, ctx.mailer, 'a@acme.test', true)
    const b = await signup(ctx.app, ctx.mailer, 'b@acme.test', true)
    const site = await newSite(a, 'Private Co')
    const zip = await makeZip(schemaFor('Private Co'))
    expect((await publish(a, site.id, zip)).status).toBe(201)
    const asset = (await upload(a, site.id, PNG)).json
    await agent(ctx.app).call('POST', `/api/public/forms/${site.id}`, { name: 'Visitor', email: 'v@x.co', message: 'hello' })
    const sub = (await a.call('GET', `/api/sites/${site.id}/submissions`)).json.items[0]

    expect((await b.call('GET', '/api/sites')).json.sites).toHaveLength(0)
    const attempts = [
      b.call('GET', `/api/sites/${site.id}`),
      b.call('PUT', `/api/sites/${site.id}`, { schema: schemaFor('Hijack'), revision: 1 }),
      b.call('DELETE', `/api/sites/${site.id}`),
      b.call('PATCH', `/api/sites/${site.id}/slug`, { slug: 'stolen-site' }),
      publish(b, site.id, zip),
      b.call('POST', `/api/sites/${site.id}/unpublish`),
      b.call('GET', `/api/sites/${site.id}/versions`),
      b.call('POST', `/api/sites/${site.id}/rollback`, { versionId: 'x' }),
      upload(b, site.id, PNG),
      b.call('GET', `/api/sites/${site.id}/submissions`),
      b.call('GET', `/api/sites/${site.id}/submissions.csv`),
      b.call('PATCH', `/api/submissions/${sub.id}`, { read: true }),
      b.call('DELETE', `/api/submissions/${sub.id}`),
      b.call('DELETE', `/api/assets/${asset.id}`),
    ]
    for (const r of await Promise.all(attempts)) expect(r.status).toBe(404)
    // ...and everything is still intact for the owner.
    expect((await a.call('GET', `/api/sites/${site.id}`)).json.schema.settings.name).toBe('Private Co')
    expect((await a.call('GET', `/api/sites/${site.id}/submissions`)).json.items).toHaveLength(1)
    expect((await agent(ctx.app).call('GET', `/api/assets/${asset.id}`)).status).toBe(200)
  })
  it('requires a session for every private endpoint', async () => {
    const anon = agent(ctx.app)
    for (const [m, u] of [['GET', '/api/sites'], ['POST', '/api/sites'], ['GET', '/api/sites/x'], ['POST', '/api/sites/x/publish'], ['GET', '/api/sites/x/submissions'], ['DELETE', '/api/assets/x']]) {
      expect((await anon.call(m, u, m === 'POST' ? {} : undefined)).status).toBe(401)
    }
  })
})

describe('image uploads', () => {
  it('stores a real image, dedupes it, and serves it publicly with safe headers', async () => {
    const a = await signup(ctx.app, ctx.mailer)
    const site = await newSite(a)
    const up = await upload(a, site.id, PNG)
    expect(up.status).toBe(201)
    const again = await upload(a, site.id, PNG)
    expect(again.json.id).toBe(up.json.id)
    const got = await agent(ctx.app).call('GET', up.json.url)
    expect(got.status).toBe(200)
    expect(got.res.headers['content-type']).toBe('image/png')
    expect(got.res.headers['x-content-type-options']).toBe('nosniff')
    expect(got.res.headers['content-security-policy']).toContain('sandbox')
  })
  it('refuses files that are not images, even if labelled as images', async () => {
    const a = await signup(ctx.app, ctx.mailer)
    const site = await newSite(a)
    const html = Buffer.from('<script>alert(1)</script> padding padding')
    expect((await upload(a, site.id, html, 'image/png')).status).toBe(415)
    expect((await upload(a, site.id, PNG, 'image/jpeg')).status).toBe(415) // declared type must match contents
    expect((await a.call('POST', `/api/sites/${site.id}/assets`, html, { headers: { 'content-type': 'text/html' } })).status).toBe(415)
  })
  it('enforces the per-account image count', async () => {
    await ctx.app.close()
    ctx = await setup({ MAX_ASSETS_PER_USER: '2' })
    const a = await signup(ctx.app, ctx.mailer)
    const site = await newSite(a)
    const mk = (n) => Buffer.concat([PNG, Buffer.from([n])]) // distinct bytes, still a PNG header
    expect((await upload(a, site.id, mk(1))).status).toBe(201)
    expect((await upload(a, site.id, mk(2))).status).toBe(201)
    expect((await upload(a, site.id, mk(3))).status).toBe(403)
  })
})

describe('publishing', () => {
  it('requires a verified email', async () => {
    const a = await signup(ctx.app, ctx.mailer, 'u@acme.test', false)
    const site = await newSite(a)
    const r = await publish(a, site.id, await makeZip(schemaFor()))
    expect(r.status).toBe(403)
    expect(r.json.error).toMatch(/Confirm your email/)
  })
  it('publishes a zip and serves it with a sandbox policy', async () => {
    const a = await signup(ctx.app, ctx.mailer, 'u@acme.test', true)
    const site = await newSite(a, 'Acme Studio')
    const r = await publish(a, site.id, await makeZip(schemaFor()))
    expect(r.status).toBe(201)
    expect(r.json.url).toContain('/s/acme-studio/')
    const home = await agent(ctx.app).call('GET', '/s/acme-studio/')
    expect(home.status).toBe(200)
    expect(home.body).toContain('HOME PAGE v1')
    expect(home.res.headers['content-security-policy']).toContain('sandbox')
    expect(home.res.headers['cache-control']).toBe('no-cache')
    expect((await agent(ctx.app).call('GET', '/s/acme-studio/about/')).body).toContain('ABOUT')
    const redirect = await agent(ctx.app).call('GET', '/s/acme-studio/about')
    expect(redirect.status).toBe(301); expect(redirect.res.headers.location).toBe('/s/acme-studio/about/')
    const missing = await agent(ctx.app).call('GET', '/s/acme-studio/nope/')
    expect(missing.status).toBe(404); expect(missing.body).toContain('NOT FOUND PAGE')
    expect((await agent(ctx.app).call('GET', '/s/acme-studio/site.css')).res.headers['content-type']).toContain('text/css')
    expect((await a.call('GET', '/api/sites')).json.sites[0].url).toContain('/s/acme-studio/')
  })
  it('cannot be tricked into serving files outside the site folder', async () => {
    const a = await signup(ctx.app, ctx.mailer, 'u@acme.test', true)
    const site = await newSite(a, 'Acme Studio')
    await publish(a, site.id, await makeZip(schemaFor()))
    for (const p of ['/s/acme-studio/..%2f..%2f..%2fpackage.json', '/s/acme-studio/%2e%2e/%2e%2e/etc/passwd', '/s/acme-studio/..%5c..%5cx', '/s/acme-studio/%00']) {
      const r = await agent(ctx.app).call('GET', p)
      expect([400, 404]).toContain(r.status)
      expect(r.body).not.toContain('"name"')
      expect(r.body).not.toContain('root:')
    }
  })
  it('rejects hostile or invalid zips before writing anything', async () => {
    const a = await signup(ctx.app, ctx.mailer, 'u@acme.test', true)
    const site = await newSite(a)
    const s = schemaFor()
    const bad = [
      ['path traversal', await traversalZip(s)],
      ['server script', await makeZip(s, { files: { 'shell.php': '<?php ?>' } })],
    ]
    for (const [label, zip] of bad) { const r = await publish(a, site.id, zip); expect([400], label).toContain(r.status) }
    expect((await publish(a, site.id, Buffer.from('not a zip at all'))).status).toBe(400)
    const noJson = new JSZip(); noJson.file('index.html', 'x')
    expect((await publish(a, site.id, await noJson.generateAsync({ type: 'nodebuffer' }))).status).toBe(400)
    const dupPaths = schemaFor(); dupPaths.pages.push({ ...dupPaths.pages[0], id: 'dup' })
    const r = await publish(a, site.id, await makeZip(dupPaths))
    expect(r.status).toBe(400); expect(r.json.details.join(' ')).toMatch(/Two pages/)
    expect(fs.existsSync(path.join(ctx.dataDir, 'storage', 'sites', site.id))).toBe(false)
    expect((await agent(ctx.app).call('GET', '/s/acme-studio/')).status).toBe(404)
  })
  it('rejects a zip that unpacks to far more than its size (zip bomb)', async () => {
    await ctx.app.close()
    ctx = await setup()
    ctx.config.limits.maxUnzippedBytes = 50_000
    const a = await signup(ctx.app, ctx.mailer, 'u@acme.test', true)
    const site = await newSite(a)
    const zip = new JSZip(); zip.file('index.html', 'a'.repeat(200_000)); zip.file('site.json', JSON.stringify(schemaFor()))
    const buf = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })
    expect(buf.length).toBeLessThan(5000)
    expect((await publish(a, site.id, buf)).status).toBe(413)
  })
  it('keeps old versions, rolls back, and unpublishes', async () => {
    const a = await signup(ctx.app, ctx.mailer, 'u@acme.test', true)
    const site = await newSite(a, 'Acme Studio')
    await publish(a, site.id, await makeZip(schemaFor(), { v: 1 }))
    await publish(a, site.id, await makeZip(schemaFor(), { v: 2 }))
    expect((await agent(ctx.app).call('GET', '/s/acme-studio/')).body).toContain('v2')
    const versions = (await a.call('GET', `/api/sites/${site.id}/versions`)).json.versions
    expect(versions).toHaveLength(2)
    expect(versions[0].live).toBe(true)
    expect((await a.call('POST', `/api/sites/${site.id}/rollback`, { versionId: versions[1].id })).status).toBe(200)
    expect((await agent(ctx.app).call('GET', '/s/acme-studio/')).body).toContain('v1')
    expect((await a.call('POST', `/api/sites/${site.id}/unpublish`)).status).toBe(200)
    expect((await agent(ctx.app).call('GET', '/s/acme-studio/')).status).toBe(404)
  })
  it('serves from a subdomain when SITES_DOMAIN is configured', async () => {
    await ctx.app.close()
    ctx = await setup({ SITES_DOMAIN: 'sites.test' })
    const a = await signup(ctx.app, ctx.mailer, 'u@acme.test', true)
    const site = await newSite(a, 'Acme Studio')
    const r = await publish(a, site.id, await makeZip(schemaFor()))
    expect(r.json.url).toBe('http://acme-studio.sites.test/')
    const res = await agent(ctx.app).call('GET', '/', undefined, { headers: { host: 'acme-studio.sites.test' } })
    expect(res.status).toBe(200); expect(res.body).toContain('HOME PAGE')
    expect((await agent(ctx.app).call('GET', '/', undefined, { headers: { host: 'nobody.sites.test' } })).status).toBe(404)
    expect((await agent(ctx.app).call('POST', '/', {}, { headers: { host: 'acme-studio.sites.test' } })).status).toBe(405)
  })
})

describe('contact form inbox', () => {
  async function published() {
    const a = await signup(ctx.app, ctx.mailer, 'owner@acme.test', true)
    const site = await newSite(a, 'Acme Studio')
    await publish(a, site.id, await makeZip(schemaFor()))
    return { a, site }
  }
  const post = (siteId, body, headers = {}) => agent(ctx.app, { csrf: false }).call('POST', `/api/public/forms/${siteId}`, body, { headers })

  it('only accepts messages for published sites', async () => {
    const a = await signup(ctx.app, ctx.mailer, 'owner@acme.test', true)
    const site = await newSite(a)
    expect((await post(site.id, { name: 'V', email: 'v@x.co', message: 'hi' })).status).toBe(404)
    expect((await post('00000000-0000-0000-0000-000000000000', { name: 'V', email: 'v@x.co', message: 'hi' })).status).toBe(404)
  })
  it('stores a message, emails the owner, allows cross-origin posts, and shows it in the inbox', async () => {
    const { a, site } = await published()
    const r = await post(site.id, { name: 'Sam', email: 'Sam@Test.dev', message: 'Table for four?' }, { origin: 'https://cafe.example' })
    expect(r.status).toBe(202)
    expect(r.res.headers['access-control-allow-origin']).toBe('*')
    const pre = await agent(ctx.app).call('OPTIONS', `/api/public/forms/${site.id}`)
    expect(pre.status).toBe(204); expect(pre.res.headers['access-control-allow-headers']).toMatch(/Content-Type/)
    const mail = ctx.mailer.outbox.at(-1)
    expect(mail.to).toBe('owner@acme.test'); expect(mail.text).toContain('Table for four?')
    expect((await a.call('GET', '/api/sites')).json.sites[0].unread).toBe(1)
    const inbox = (await a.call('GET', `/api/sites/${site.id}/submissions`)).json
    expect(inbox.items[0]).toMatchObject({ name: 'Sam', email: 'sam@test.dev', message: 'Table for four?', read: false })
    expect((await a.call('PATCH', `/api/submissions/${inbox.items[0].id}`, { read: true })).status).toBe(200)
    expect((await a.call('GET', '/api/sites')).json.sites[0].unread).toBe(0)
    expect((await a.call('DELETE', `/api/submissions/${inbox.items[0].id}`)).status).toBe(200)
    expect((await a.call('GET', `/api/sites/${site.id}/submissions`)).json.items).toHaveLength(0)
  })
  it('validates input and silently drops bot (honeypot) posts', async () => {
    const { a, site } = await published()
    expect((await post(site.id, { name: '', email: 'v@x.co', message: 'hi' })).status).toBe(400)
    expect((await post(site.id, { name: 'V', email: 'not-an-email', message: 'hi' })).status).toBe(400)
    expect((await post(site.id, { name: 'V', email: 'v@x.co', message: 'x'.repeat(5001) })).status).toBe(400)
    const bot = await post(site.id, { name: 'Bot', email: 'b@x.co', message: 'buy now', company: 'Spam Inc' })
    expect(bot.status).toBe(200)
    expect((await a.call('GET', `/api/sites/${site.id}/submissions`)).json.items).toHaveLength(0)
    const huge = await post(site.id, { name: 'V', email: 'v@x.co', message: 'x'.repeat(20_000) })
    expect(huge.status).toBe(413)
  })
  it('rate limits a single visitor', async () => {
    const { site } = await published()
    const codes = []
    for (let i = 0; i < 7; i++) codes.push((await post(site.id, { name: 'V', email: 'v@x.co', message: 'm' + i })).status)
    expect(codes.slice(0, 5).every((c) => c === 202)).toBe(true)
    expect(codes[6]).toBe(429)
  })
  it('exports CSV and neutralises spreadsheet formulas', async () => {
    const { a, site } = await published()
    await post(site.id, { name: '=HYPERLINK("http://evil")', email: 'v@x.co', message: '+cmd|calc' })
    const csv = await a.call('GET', `/api/sites/${site.id}/submissions.csv`)
    expect(csv.res.headers['content-type']).toContain('text/csv')
    expect(csv.body).toContain(`"'=HYPERLINK`)
    expect(csv.body).toContain("'+cmd|calc")
  })
  it('does not lose the message if the notification email fails', async () => {
    const { a, site } = await published()
    ctx.mailer.send = async () => { throw new Error('smtp down') }
    expect((await post(site.id, { name: 'V', email: 'v@x.co', message: 'still saved' })).status).toBe(202)
    expect((await a.call('GET', `/api/sites/${site.id}/submissions`)).json.items[0].message).toBe('still saved')
  })
})

describe('account deletion', () => {
  it('erases the account, its sites, files and sessions', async () => {
    const a = await signup(ctx.app, ctx.mailer, 'gone@acme.test', true)
    const site = await newSite(a, 'Gone Co')
    await publish(a, site.id, await makeZip(schemaFor('Gone Co')))
    const asset = (await upload(a, site.id, PNG)).json
    expect((await a.call('DELETE', '/api/auth/account', { password: 'wrong password!!' })).status).toBe(403)
    expect((await a.call('DELETE', '/api/auth/account', { password: PW })).status).toBe(200)
    expect((await ctx.db.query('select count(*) as n from users')).rows[0].n).toBe(0)
    for (const t of ['sites', 'site_versions', 'assets', 'sessions']) expect(Number((await ctx.db.query(`select count(*) as n from ${t}`)).rows[0].n)).toBe(0)
    expect(fs.existsSync(path.join(ctx.dataDir, 'storage', 'sites', site.id))).toBe(false)
    expect((await agent(ctx.app).call('GET', asset.url)).status).toBe(404)
    expect((await agent(ctx.app).call('GET', '/s/gone-co/')).status).toBe(404)
  })
})
