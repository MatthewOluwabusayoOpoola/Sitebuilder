<script setup>
import { computed } from 'vue'
const props = defineProps({ p: Object })
const paras = computed(() => String(props.p.body || '').split(/\n{2,}/).map((s) => s.trim()).filter(Boolean))
</script>
<template>
  <section class="sb-wrap sb-pad sb-narrow">
    <h2 v-if="p.heading" class="sb-h2 sb-mb">{{ p.heading }}</h2>
    <p v-for="(t, i) in paras" :key="i" class="sb-body">{{ t }}</p>
  </section>
</template>
