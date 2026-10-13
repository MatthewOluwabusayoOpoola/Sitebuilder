// Fixed-window limiter kept in memory. Fine for one instance; use Redis if you scale out.
export function createLimiter() {
  const hits = new Map()
  return {
    // Returns { ok, retryAfter } and counts this attempt.
    take(key, max, windowMs) {
      const now = Date.now()
      const h = hits.get(key)
      if (!h || h.reset <= now) { hits.set(key, { n: 1, reset: now + windowMs }); return { ok: true, retryAfter: 0 } }
      h.n++
      return h.n > max ? { ok: false, retryAfter: Math.ceil((h.reset - now) / 1000) } : { ok: true, retryAfter: 0 }
    },
    reset(key) { hits.delete(key) },
    sweep() { const now = Date.now(); for (const [k, v] of hits) if (v.reset <= now) hits.delete(k) },
    clear() { hits.clear() },
  }
}
