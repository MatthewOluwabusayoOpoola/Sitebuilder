export const uid = () => Math.random().toString(36).slice(2, 8)
export const clone = (v) => JSON.parse(JSON.stringify(v))
export const slug = (s) =>
  String(s || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'item'

export function normPath(p) {
  let s = String(p || '/').split('#')[0].split('?')[0].trim()
  if (!s.startsWith('/')) s = '/' + s
  if (s.length > 1) s = s.replace(/\/+$/, '')
  return s || '/'
}
export const isExternal = (h) => /^(https?:|mailto:|tel:|#|data:)/i.test(h || '')

export function formatPrice(v, currency = '') {
  if (v === '' || v == null) return ''
  const n = Number(v)
  if (Number.isNaN(n)) return String(v)
  return currency + n.toLocaleString('en-US')
}

// ---- colour helpers (hex only) ----
export function hexToRgb(hex) {
  let h = String(hex || '').replace('#', '')
  if (h.length === 3) h = h.split('').map((c) => c + c).join('')
  const n = parseInt(h, 16)
  if (Number.isNaN(n) || h.length !== 6) return [0, 0, 0]
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
export const rgbToHex = (r, g, b) =>
  '#' + [r, g, b].map((x) => Math.round(x).toString(16).padStart(2, '0')).join('')
export function mix(a, b, t) {
  const A = hexToRgb(a), B = hexToRgb(b)
  return rgbToHex(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t)
}
export function luminance(hex) {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
export function contrast(a, b) {
  const la = luminance(a), lb = luminance(b)
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}
export const readableOn = (bg) => (contrast(bg, '#0D0C0C') >= contrast(bg, '#FFFFFF') ? '#0D0C0C' : '#FFFFFF')

// Plain-canvas palette suggestion from a logo or photo (no model involved).
export async function suggestPalette(dataUrl, count = 6) {
  const img = await new Promise((res, rej) => {
    const i = new Image()
    i.onload = () => res(i)
    i.onerror = rej
    i.src = dataUrl
  })
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const ctx = c.getContext('2d')
  ctx.drawImage(img, 0, 0, 64, 64)
  const { data } = ctx.getImageData(0, 0, 64, 64)
  const buckets = new Map()
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 200) continue
    const key = (data[i] >> 4) + ',' + (data[i + 1] >> 4) + ',' + (data[i + 2] >> 4)
    const b = buckets.get(key) || { n: 0, r: 0, g: 0, b: 0 }
    b.n++; b.r += data[i]; b.g += data[i + 1]; b.b += data[i + 2]
    buckets.set(key, b)
  }
  const cols = [...buckets.values()]
    .sort((a, b) => b.n - a.n)
    .map((b) => rgbToHex(b.r / b.n, b.g / b.n, b.b / b.n))
  const out = []
  for (const hex of cols) {
    if (out.every((o) => colorDistance(o, hex) > 60)) out.push(hex)
    if (out.length >= count) break
  }
  return out
}
function colorDistance(a, b) {
  const A = hexToRgb(a), B = hexToRgb(b)
  return Math.hypot(A[0] - B[0], A[1] - B[1], A[2] - B[2])
}

// Downscale an uploaded image in the browser and return a JPEG/PNG data URL.
export async function fileToDataUrl(file, max = 1600) {
  const raw = await new Promise((res, rej) => {
    const r = new FileReader()
    r.onload = () => res(r.result)
    r.onerror = rej
    r.readAsDataURL(file)
  })
  if (file.type === 'image/svg+xml' || file.type === 'image/gif') return raw
  const img = await new Promise((res, rej) => {
    const i = new Image()
    i.onload = () => res(i)
    i.onerror = rej
    i.src = raw
  })
  const scale = Math.min(1, max / Math.max(img.width, img.height))
  const c = document.createElement('canvas')
  c.width = Math.round(img.width * scale)
  c.height = Math.round(img.height * scale)
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height)
  const type = file.type === 'image/png' ? 'image/png' : 'image/jpeg'
  return c.toDataURL(type, 0.82)
}
