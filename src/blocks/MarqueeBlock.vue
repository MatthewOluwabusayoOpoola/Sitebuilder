<script setup>
defineProps({ p: Object })
</script>
<template>
  <div class="sb-marquee" :class="'sb-marquee--' + (p.tone || 'accent')">
    <div class="sb-marquee__track">
      <span>{{ p.text }}&nbsp;</span><span aria-hidden="true">{{ p.text }}&nbsp;</span><span aria-hidden="true">{{ p.text }}&nbsp;</span><span aria-hidden="true">{{ p.text }}&nbsp;</span>
    </div>
  </div>
</template>
