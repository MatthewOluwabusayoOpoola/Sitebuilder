// Thin fetch wrapper for the Site Builder API. Cookies carry the session; the custom header is
// the CSRF guard the server requires on every state-changing call.
const BASE = import.meta.env.VITE_API_ORIGIN || ''

export class ApiError extends Error {
  constructor(status, message, details) { super(message); this.status = status; this.details = details }
}

export async function api(method, path, body, { headers = {} } = {}) {
  const init = { method, credentials: 'include', headers: { 'x-requested-with': 'sitebuilder', ...headers } }
  if (body instanceof Blob || body instanceof ArrayBuffer) init.body = body
  else if (body !== undefined) { init.headers['content-type'] = 'application/json'; init.body = JSON.stringify(body) }
  let res
  try { res = await fetch(BASE + '/api' + path, init) } catch { throw new ApiError(0, 'Cannot reach the server. Check your connection and try again.') }
  const text = await res.text()
  let json = null
  try { json = JSON.parse(text) } catch { /* not JSON */ }
  if (!res.ok) throw new ApiError(res.status, json?.error || res.statusText || 'Request failed', json?.details)
  return json
}
// Absolute address that published sites post their contact forms to.
// The server reports its public address (from /auth/me) so published pages post to it directly.
let serverOrigin = ''
export const setServerOrigin = (u) => { if (u) serverOrigin = u.replace(/\/+$/, '') }
export const formEndpointFor = (cloudId) => `${serverOrigin || BASE || location.origin}/api/public/forms/${cloudId}`
export const csvUrl = (cloudId) => `${BASE}/api/sites/${cloudId}/submissions.csv`
