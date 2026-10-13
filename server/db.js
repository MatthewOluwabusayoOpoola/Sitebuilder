import fs from 'node:fs'
import path from 'node:path'

// One tiny interface over two engines:
//   production  -> node-postgres Pool (DATABASE_URL)
//   dev / tests -> PGlite (real Postgres compiled to WASM, in-memory or on disk)
// Both take `query(sql, params)` with $1 style parameters and return { rows, rowCount }.
export async function createDb(config, { memory = false } = {}) {
  if (config.databaseUrl) {
    const { default: pg } = await import('pg')
    const pool = new pg.Pool({ connectionString: config.databaseUrl, max: 10 })
    return {
      kind: 'pg',
      async query(sql, params = []) { const r = await pool.query(sql, params); return { rows: r.rows, rowCount: r.rowCount } },
      async tx(fn) {
        const c = await pool.connect()
        try {
          await c.query('BEGIN')
          const out = await fn({ query: async (s, p = []) => { const r = await c.query(s, p); return { rows: r.rows, rowCount: r.rowCount } } })
          await c.query('COMMIT')
          return out
        } catch (e) { await c.query('ROLLBACK'); throw e } finally { c.release() }
      },
      close: () => pool.end(),
    }
  }
  const { PGlite } = await import('@electric-sql/pglite')
  let db
  if (memory) db = new PGlite()
  else {
    const dir = path.join(config.dataDir, 'pg')
    fs.mkdirSync(dir, { recursive: true })
    db = new PGlite(dir)
  }
  await db.waitReady
  const wrap = (d) => ({
    query: async (sql, params = []) => { const r = await d.query(sql, params); return { rows: r.rows, rowCount: r.affectedRows ?? r.rows.length } },
  })
  return {
    kind: 'pglite',
    ...wrap(db),
    tx: (fn) => db.transaction((t) => fn(wrap(t))),
    close: () => db.close(),
  }
}
