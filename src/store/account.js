import { reactive } from 'vue'
import { api, setServerOrigin } from '../api/client.js'

export const account = reactive({ user: null, ready: false, offline: false })

export async function refreshAccount() {
  try { const r = await api('GET', '/auth/me'); account.user = r.user; setServerOrigin(r.publicUrl); account.offline = false }
  catch (e) { if (e.status === 0) account.offline = true }
  finally { account.ready = true }
}
export async function signup(email, password) { account.user = (await api('POST', '/auth/signup', { email, password })).user }
export async function login(email, password) { account.user = (await api('POST', '/auth/login', { email, password })).user }
export async function logout() { try { await api('POST', '/auth/logout') } finally { account.user = null } }
export const forgot = (email) => api('POST', '/auth/forgot', { email })
export const resetPassword = (token, password) => api('POST', '/auth/reset', { token, password })
export async function verifyEmail(token) { await api('POST', '/auth/verify', { token }); await refreshAccount() }
export const resendVerification = () => api('POST', '/auth/resend-verification')
export async function deleteAccount(password) { await api('DELETE', '/auth/account', { password }); account.user = null }
