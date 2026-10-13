<script setup>
defineProps({ p: Object })
</script>
<template>
  <section class="sb-wrap sb-pad-sm">
    <dl class="sb-stats">
      <div v-for="(s, i) in p.items" :key="i"><dt>{{ s.label }}</dt><dd>{{ s.value }}</dd></div>
    </dl>
  </section>
</template>
