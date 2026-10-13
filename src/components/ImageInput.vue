<script setup>
import { ref } from 'vue'
import { fileToDataUrl } from '../schema/util.js'
const props = defineProps({ modelValue: String, label: String })
const emit = defineEmits(['update:modelValue'])
const err = ref('')
async function onFile(e) {
  const f = e.target.files[0]
  if (!f) return
  err.value = ''
  if (!f.type.startsWith('image/')) { err.value = 'Please choose an image file.'; return }
  try { emit('update:modelValue', await fileToDataUrl(f)) } catch { err.value = 'Could not read that image.' }
  e.target.value = ''
}
const isData = (v) => v && v.startsWith('data:')
</script>

<template>
  <div class="imgin">
    <div class="imgin__row">
      <img v-if="modelValue" :src="modelValue" alt="" class="imgin__thumb" />
      <div v-else class="imgin__thumb imgin__thumb--empty">No image</div>
      <div class="imgin__ctl">
        <label class="btn btn--sm btn--ghost">Upload<input type="file" accept="image/*" hidden @change="onFile" /></label>
        <button v-if="modelValue" type="button" class="btn btn--sm btn--ghost" @click="emit('update:modelValue', '')">Remove</button>
      </div>
    </div>
    <input v-if="!isData(modelValue)" type="url" placeholder="…or paste an image address" :value="modelValue" :aria-label="(label || 'Image') + ' address'" @input="emit('update:modelValue', $event.target.value)" />
    <em v-if="err" class="err">{{ err }}</em>
  </div>
</template>
