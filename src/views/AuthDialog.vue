<script setup>
import { ref, computed } from 'vue'
import { login, signup, forgot } from '../store/account.js'

const props = defineProps({ start: { type: String, default: 'login' } })
const emit = defineEmits(['close', 'done'])
const mode = ref(props.start)
const email = ref('')
const password = ref('')
const busy = ref(false)
const error = ref('')
const info = ref('')

const title = computed(() => ({ login: 'Sign in', signup: 'Create your account', forgot: 'Reset your password' }[mode.value]))
async function submit() {
  error.value = ''; info.value = ''; busy.value = true
  try {
    if (mode.value === 'login') { await login(email.value, password.value); emit('done') }
    else if (mode.value === 'signup') { await signup(email.value, password.value); emit('done') }
    else { await forgot(email.value); info.value = 'If that email has an account, a reset link is on its way. It works for one hour.' }
  } catch (e) { error.value = e.message } finally { busy.value = false }
}
</script>

<template>
  <div class="modal" role="dialog" aria-modal="true" aria-labelledby="auth-title" @keydown.esc="emit('close')">
    <form class="modal__box modal__box--sm" @submit.prevent="submit">
      <h2 id="auth-title">{{ title }}</h2>
      <p v-if="mode === 'signup'" class="muted">Save your sites to your account, publish them online and receive contact-form messages.</p>
      <label class="field"><span>Email</span><input v-model="email" type="email" autocomplete="email" required autofocus /></label>
      <label v-if="mode !== 'forgot'" class="field"><span>Password</span>
        <input v-model="password" type="password" :autocomplete="mode === 'signup' ? 'new-password' : 'current-password'" :minlength="mode === 'signup' ? 10 : undefined" required />
        <small v-if="mode === 'signup'" class="muted">At least 10 characters. A few random words works well.</small>
      </label>
      <p v-if="error" class="notice notice--error" role="alert">{{ error }}</p>
      <p v-if="info" class="notice notice--ok" role="status">{{ info }}</p>
      <div class="row row--end">
        <button type="button" class="btn btn--ghost" @click="emit('close')">Cancel</button>
        <button class="btn" :disabled="busy">{{ busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : mode === 'signup' ? 'Create account' : 'Send reset link' }}</button>
      </div>
      <p class="muted small swap">
        <template v-if="mode === 'login'">New here? <a href="#" @click.prevent="mode = 'signup'">Create an account</a> · <a href="#" @click.prevent="mode = 'forgot'">Forgot password?</a></template>
        <template v-else>Have an account? <a href="#" @click.prevent="mode = 'login'">Sign in</a></template>
      </p>
    </form>
  </div>
</template>
