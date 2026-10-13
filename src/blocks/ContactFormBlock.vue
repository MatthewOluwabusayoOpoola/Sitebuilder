<script setup>
import { reactive, useId } from 'vue'
import { useSiteCtx } from '../site/context.js'
defineProps({ p: Object })
const ctx = useSiteCtx()
const id = useId()
const st = reactive({ name: '', email: '', message: '', company: '', sent: false, busy: false, error: '' })

async function submit(e) {
  e.preventDefault()
  if (st.company) { st.sent = true; return } // honeypot: bots fill the hidden field
  if (!st.name.trim() || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(st.email) || !st.message.trim()) {
    st.error = 'Please enter your name, a valid email and a message.'
    return
  }
  st.error = ''
  if (ctx.mode === 'edit') { st.sent = true; return } // preview only: nothing is sent
  const s = ctx.site.settings
  if (s.formEndpoint) {
    st.busy = true
    try {
      const r = await fetch(s.formEndpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ name: st.name, email: st.email, message: st.message, site: s.name, submittedAt: new Date().toISOString() }) })
      if (!r.ok) throw new Error('bad status')
      st.sent = true
    } catch { st.error = 'Sorry, that did not send. Please email us directly.' }
    finally { st.busy = false }
  } else if (s.contactEmail) {
    window.location.href = 'mailto:' + s.contactEmail + '?subject=' + encodeURIComponent('Enquiry from ' + st.name) + '&body=' + encodeURIComponent(st.message + '\n\n' + st.name + ' <' + st.email + '>')
    st.sent = true
  } else st.error = 'This form is not connected yet.'
}
</script>
<template>
  <section class="sb-wrap sb-pad sb-narrow">
    <h2 v-if="p.heading" class="sb-h2">{{ p.heading }}</h2>
    <p v-if="p.intro" class="sb-lead">{{ p.intro }}</p>
    <p v-if="st.sent" class="sb-success" role="status">{{ p.successMessage }}</p>
    <form v-else class="sb-form" novalidate @submit="submit">
      <input v-model="st.company" class="sb-hp" type="text" tabindex="-1" autocomplete="off" aria-hidden="true" />
      <label :for="id + '-n'">Your name</label>
      <input :id="id + '-n'" v-model="st.name" type="text" autocomplete="name" required />
      <label :for="id + '-e'">Email</label>
      <input :id="id + '-e'" v-model="st.email" type="email" autocomplete="email" required />
      <label :for="id + '-m'">Message</label>
      <textarea :id="id + '-m'" v-model="st.message" rows="5" required></textarea>
      <p v-if="st.error" class="sb-error" role="alert">{{ st.error }}</p>
      <button class="sb-btn" type="submit" :disabled="st.busy">{{ st.busy ? 'Sending…' : p.buttonLabel }}</button>
    </form>
  </section>
</template>
