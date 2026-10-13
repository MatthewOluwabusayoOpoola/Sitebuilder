import { reactive } from 'vue'
import { api } from '../api/client.js'
import { clone } from '../schema/util.js'
import { state, createSite } from './sites.js'

// Local-first sync. The browser copy is always editable; when a site is linked to the cloud we
// push changes after a short pause. `rec.cloud` ({ id, revision }) is persisted with the site;
// the transient status below is not.
export const syncState = reactive({}) // localId -> { busy, error, conflict, syncedAt }
const lastJson = new Map()            // localId -> JSON last accepted by the server
const timers = new Map()
const RASTER = /^data:image\/(png|jpeg|webp|gif);base64,/

const st = (id) => (syncState[id] ||= { busy: false, error: '', conflict: null, syncedAt: 0 })

// Walk every string in a schema; `fn(value)` may return a replacement (sync or async).
async function mapStrings(node, fn) {
  if (Array.isArray(node)) { for (let i = 0; i < node.length; i++) node[i] = await mapStr(node[i], fn) }
  else if (node && typeof node === 'object') { for (const k of Object.keys(node)) node[k] = await mapStr(node[k], fn) }
}
async function mapStr(v, fn) {
  if (typeof v === 'string') return fn(v)
  await mapStrings(v, fn)
  return v
}

// Photos are uploaded once and replaced by short addresses, so saved sites stay small.
// Small inline images (the SVG placeholders) stay inline.
async function uploadImages(schema, cloudId) {
  const cache = new Map()
  await mapStrings(schema, async (v) => {
    if (!RASTER.test(v)) return v
    if (cache.has(v)) return cache.get(v)
    const blob = await (await fetch(v)).blob()
    const r = await api('POST', `/sites/${cloudId}/assets`, blob, { headers: { 'content-type': blob.type } })
    cache.set(v, r.url)
    return r.url
  })
}

export async function pushDraft(rec) {
  const c = rec.cloud
  if (!c) return
  const s = st(rec.id)
  if (s.busy || s.conflict) return
  s.busy = true; s.error = ''
  try {
    await uploadImages(rec.schema, c.id)
    const json = JSON.stringify(rec.schema)
    if (json === lastJson.get(rec.id)) return
    const r = await api('PUT', `/sites/${c.id}`, { schema: rec.schema, revision: c.revision })
    c.revision = r.revision
    lastJson.set(rec.id, JSON.stringify(rec.schema))
    s.syncedAt = Date.now()
  } catch (e) {
    if (e.status === 409) s.conflict = { serverRevision: e.details?.revision }
    else if (e.status === 404) s.error = 'This site no longer exists in your account.'
    else s.error = e.message
  } finally { s.busy = false }
}

export function scheduleSync(rec, delay = 2500) {
  if (!rec?.cloud) return
  clearTimeout(timers.get(rec.id))
  timers.set(rec.id, setTimeout(() => pushDraft(rec), delay))
}
export async function flushSync(rec) {
  if (!rec?.cloud) return
  clearTimeout(timers.get(rec.id))
  await pushDraft(rec)
}

// Create the site in the account, then push (which uploads photos and saves the full draft).
export async function linkSite(rec) {
  const s = st(rec.id)
  s.busy = true; s.error = ''
  try {
    const stripped = clone(rec.schema)
    await mapStrings(stripped, (v) => (RASTER.test(v) ? '' : v))
    const { site } = await api('POST', '/sites', { schema: stripped })
    rec.cloud = { id: site.id, revision: site.revision }
  } catch (e) { s.error = e.message; throw e } finally { s.busy = false }
  await pushDraft(rec)
}

// Bring a cloud-only site (made on another device) into this browser.
export async function pullCloudSite(cloudId) {
  const { site, schema } = await api('GET', `/sites/${cloudId}`)
  const id = createSite(schema)
  state.sites[id].cloud = { id: site.id, revision: site.revision }
  lastJson.set(id, JSON.stringify(schema))
  return id
}

// Conflict resolution after a 409: keep this browser's version, or take the account's.
export async function resolveConflict(rec, keep) {
  const s = st(rec.id)
  const { site, schema } = await api('GET', `/sites/${rec.cloud.id}`)
  rec.cloud.revision = site.revision
  if (keep === 'theirs') { rec.schema = schema; lastJson.set(rec.id, JSON.stringify(schema)) }
  s.conflict = null
  if (keep === 'mine') await pushDraft(rec)
}

export async function removeCloud(cloudId) { await api('DELETE', `/sites/${cloudId}`) }
export const markKnown = (id) => { if (state.sites[id]) lastJson.set(id, JSON.stringify(state.sites[id].schema)) }
