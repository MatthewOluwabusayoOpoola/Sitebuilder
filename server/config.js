import path from 'node:path'

// All settings come from environment variables so nothing secret lives in the repo.
export function loadConfig(env = process.env) {
  const prod = env.NODE_ENV === 'production'
  return {
    prod,
    port: Number(env.PORT || 8787),
    host: env.HOST || '0.0.0.0',
    databaseUrl: env.DATABASE_URL || '',            // empty = embedded dev database in ./data/pg
    dataDir: path.resolve(env.DATA_DIR || './data'),
    // Where the builder UI is served from (used in email links). Dev: the Vite port.
    appUrl: (env.APP_URL || 'http://localhost:5173').replace(/\/+$/, ''),
    // Public URL of this API (used to build hosted-site and form addresses).
    publicUrl: (env.PUBLIC_URL || `http://localhost:${env.PORT || 8787}`).replace(/\/+$/, ''),
    // If set (e.g. "sites.example.com"), published sites are served at <slug>.sites.example.com.
    sitesDomain: (env.SITES_DOMAIN || '').toLowerCase(),
    cookieSecure: env.COOKIE_SECURE ? env.COOKIE_SECURE === '1' : prod,
    trustProxy: env.TRUST_PROXY === '1',
    requireVerifiedToPublish: env.REQUIRE_VERIFIED ? env.REQUIRE_VERIFIED === '1' : prod,
    smtpUrl: env.SMTP_URL || '',
    mailFrom: env.MAIL_FROM || 'Site Builder <no-reply@localhost>',
    logLevel: env.LOG_LEVEL || (prod ? 'info' : 'warn'),
    limits: {
      sessionDays: 30,
      maxSites: Number(env.MAX_SITES_PER_USER || 20),
      maxAssetBytes: 6 * 1024 * 1024,
      maxAssetsPerUser: Number(env.MAX_ASSETS_PER_USER || 500),
      maxStoragePerUser: Number(env.MAX_STORAGE_PER_USER || 250 * 1024 * 1024),
      maxDraftBytes: 2 * 1024 * 1024,
      maxZipBytes: 25 * 1024 * 1024,
      maxUnzippedBytes: 80 * 1024 * 1024,
      maxZipEntries: 2000,
      maxSubmissionBytes: 10 * 1024,
      maxSubmissionsPerDay: Number(env.MAX_SUBMISSIONS_PER_DAY || 300),
      maxVersionsKept: 10,
    },
  }
}
