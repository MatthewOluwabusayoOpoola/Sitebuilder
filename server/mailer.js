import { oneLine } from './security.js'

// Console transport in dev (emails are logged, never sent). SMTP when SMTP_URL is set.
export async function createMailer(config) {
  const outbox = []
  let transport = null
  if (config.smtpUrl) {
    const nodemailer = (await import('nodemailer')).default
    transport = nodemailer.createTransport(config.smtpUrl)
  }
  return {
    outbox, // tests and dev read recent messages from here
    async send({ to, subject, text }) {
      const msg = { from: config.mailFrom, to: oneLine(to), subject: oneLine(subject), text: String(text) }
      outbox.push(msg)
      if (outbox.length > 50) outbox.shift()
      if (transport) await transport.sendMail(msg)
      else if (!config.prod) console.log(`[mail] to=${msg.to} subject=${msg.subject}\n${msg.text}\n`)
    },
  }
}
