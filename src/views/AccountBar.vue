<script setup>
import { ref } from 'vue'
import { account, logout, resendVerification, deleteAccount } from '../store/account.js'
import AuthDialog from './AuthDialog.vue'

const emit = defineEmits(['changed'])
const showAuth = ref(false)
const msg = ref('')
const delOpen = ref(false)
const delPw = ref('')
const delErr = ref('')

async function resend() { msg.value = ''; try { await resendVerification(); msg.value = 'Confirmation email sent. Check your inbox.' } catch (e) { msg.value = e.message } }
async function out() { await logout(); emit('changed') }
async function erase() {
  delErr.value = ''
  try { await deleteAccount(delPw.value); delOpen.value = false; emit('changed') } catch (e) { delErr.value = e.message }
}
</script>

<template>
  <div class="acct">
    <template v-if="account.user">
      <span class="acct__mail" :title="account.user.email">{{ account.user.email }}</span>
      <span v-if="account.user.verified" class="pill pill--ok">Verified</span>
      <button v-else class="btn btn--sm btn--ghost" @click="resend">Confirm email</button>
      <button class="btn btn--sm btn--ghost" @click="out">Sign out</button>
      <button class="btn btn--sm btn--danger" @click="delOpen = true">Delete account</button>
    </template>
    <button v-else class="btn btn--ghost" @click="showAuth = true">Sign in to sync and publish</button>
    <p v-if="msg" class="small muted acct__msg" role="status">{{ msg }}</p>
    <AuthDialog v-if="showAuth" @close="showAuth = false" @done="showAuth = false; emit('changed')" />

    <div v-if="delOpen" class="modal" role="dialog" aria-modal="true" aria-labelledby="del-title">
      <form class="modal__box modal__box--sm" @submit.prevent="erase">
        <h2 id="del-title">Delete your account?</h2>
        <p>This permanently deletes your account, every site saved to it, published sites, images and messages. Sites stored only in this browser are kept.</p>
        <label class="field"><span>Confirm with your password</span><input v-model="delPw" type="password" autocomplete="current-password" required /></label>
        <p v-if="delErr" class="notice notice--error" role="alert">{{ delErr }}</p>
        <div class="row row--end"><button type="button" class="btn btn--ghost" @click="delOpen = false">Cancel</button><button class="btn btn--danger">Delete everything</button></div>
      </form>
    </div>
  </div>
</template>
