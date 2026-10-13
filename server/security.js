import crypto from 'node:crypto'
import { promisify } from 'node:util'

const scrypt = promisify(crypto.scrypt)
const N = 16384, R = 8, P = 1, KEYLEN = 64

export const newId = () => crypto.randomUUID()
export const sha256 = (v) => crypto.createHash('sha256').update(v).digest('hex')
export const newToken = () => crypto.randomBytes(32).toString('base64url')

export async function hashPassword(pw) {
  const salt = crypto.randomBytes(16)
  const key = await scrypt(pw, salt, KEYLEN, { N, r: R, p: P })
  return `scrypt$${N}$${R}$${P}$${salt.toString('base64')}$${key.toString('base64')}`
}
export async function verifyPassword(pw, stored) {
  const [alg, n, r, p, salt, hash] = String(stored).split('$')
  if (alg !== 'scrypt') return false
  const key = await scrypt(pw, Buffer.from(salt, 'base64'), KEYLEN, { N: +n, r: +r, p: +p })
  const expected = Buffer.from(hash, 'base64')
  return key.length === expected.length && crypto.timingSafeEqual(key, expected)
}
// Used so login takes similar time whether or not the account exists.
export const DUMMY_HASH = 'scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA==$' + Buffer.alloc(64).toString('base64')

export const normEmail = (e) => String(e || '').trim().toLowerCase()
export const validEmail = (e) => e.length <= 254 && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)
// Header-injection guard for anything we place in an email header.
export const oneLine = (s) => String(s ?? '').replace(/[\r\n]+/g, ' ').slice(0, 200)
