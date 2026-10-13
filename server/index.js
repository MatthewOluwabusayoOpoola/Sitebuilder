import { loadConfig } from './config.js'
import { createDb } from './db.js'
import { migrate } from './migrations.js'
import { createMailer } from './mailer.js'
import { createStorage } from './storage.js'
import { buildApp } from './app.js'

const config = loadConfig()
const db = await createDb(config)
await migrate(db)
const app = await buildApp({ config, db, mailer: await createMailer(config), storage: createStorage(config) })
await app.listen({ port: config.port, host: config.host })
console.log(`Site Builder API on ${config.publicUrl} (${db.kind})`)

const stop = async () => { await app.close(); await db.close(); process.exit(0) }
process.on('SIGINT', stop)
process.on('SIGTERM', stop)
