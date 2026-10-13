<script setup>
import { onMounted, ref } from 'vue'
import { verifyEmail, resetPassword } from '../store/account.js'

// Landing page for the links in emails: #/verify/<token> and #/reset/<token>
const props = defineProps({ kind: String, token: String })
const emit = defineEmits(['done'])
const state = ref(props.kind === 'verify' ? 'working' : 'form')
const message = ref('')
const password = ref('')
const busy = ref(false)

onMounted(async () => {
  if (props.kind !== 'verify') return
  try { await verifyEmail(props.token); state.value = 'ok'; message.value = 'Your email is confirmed. You can publish sites now.' }
  catch (e) { state.value = 'error'; message.value = e.message }
})
async function submitReset() {
  busy.value = true; message.value = ''
  try { await resetPassword(props.token, password.value); state.value = 'ok'; message.value = 'Password changed. Sign in with your new password.' }
  catch (e) { message.value = e.message } finally { busy.value = false }
}
</script>

<template>
  <div class="dash dash--narrow">
    <h1>{{ kind === 'verify' ? 'Confirm your email' : 'Choose a new password' }}</h1>
    <p v-if="state === 'working'" class="muted">Checking your link…</p>
    <form v-else-if="state === 'form'" @submit.prevent="submitReset">
      <label class="field"><span>New password</span><input v-model="password" type="password" minlength="10" autocomplete="new-password" required /><small class="muted">At least 10 characters.</small></label>
      <p v-if="message" class="notice notice--error" role="alert">{{ message }}</p>
      <button class="btn" :disabled="busy">Change password</button>
    </form>
    <template v-else>
      <p class="notice" :class="state === 'ok' ? 'notice--ok' : 'notice--error'" role="status">{{ message }}</p>
      <button class="btn" @click="emit('done')">Go to my sites</button>
    </template>
  </div>
</template>
