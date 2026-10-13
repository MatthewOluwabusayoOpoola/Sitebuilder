import fs from 'node:fs/promises'
import path from 'node:path'

// Local-disk storage behind a small interface so S3 can replace it later.
export function createStorage(config) {
  const root = path.join(config.dataDir, 'storage')
  const safe = (...parts) => {
    const p = path.resolve(root, ...parts)
    if (p !== root && !p.startsWith(root + path.sep)) throw new Error('Unsafe storage path')
    return p
  }
  return {
    root,
    async putAsset(id, buf) { const f = safe('assets', id); await fs.mkdir(path.dirname(f), { recursive: true }); await fs.writeFile(f, buf) },
    async getAsset(id) { return fs.readFile(safe('assets', id)) },
    async deleteAsset(id) { await fs.rm(safe('assets', id), { force: true }) },
    // Published sites live in one folder per version; the DB pointer decides which is live.
    async putSiteFiles(siteId, versionId, files) {
      const dir = safe('sites', siteId, versionId)
      for (const [name, data] of files) {
        const f = path.resolve(dir, name)
        if (!f.startsWith(dir + path.sep)) throw new Error('Unsafe file path')
        await fs.mkdir(path.dirname(f), { recursive: true })
        await fs.writeFile(f, data)
      }
    },
    async readSiteFile(siteId, versionId, rel) {
      const dir = safe('sites', siteId, versionId)
      const f = path.resolve(dir, rel)
      if (!f.startsWith(dir + path.sep)) return null
      try { const st = await fs.stat(f); return st.isFile() ? { data: await fs.readFile(f), size: st.size } : null } catch { return null }
    },
    async deleteVersion(siteId, versionId) { await fs.rm(safe('sites', siteId, versionId), { recursive: true, force: true }) },
    async deleteSite(siteId) { await fs.rm(safe('sites', siteId), { recursive: true, force: true }) },
  }
}
