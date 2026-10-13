<script setup>
import { computed, inject, ref } from 'vue'
import ImageInput from '../components/ImageInput.vue'
import { colorPresets, fontPairs, radii } from '../schema/themes.js'
import { contrast, suggestPalette, fileToDataUrl } from '../schema/util.js'

const site = inject('editorSite')
const t = computed(() => site.value.theme)
const ratio = computed(() => contrast(t.value.ink, t.value.bg))
const accentRatio = computed(() => contrast(t.value.accent, t.value.bg))
const palette = ref([])
const picked = ref('')

function applyPreset(c) { Object.assign(t.value, { bg: c.bg, surface: c.surface, ink: c.ink, accent: c.accent, colorPreset: c.id }) }
function applyFont(id) {
  const f = fontPairs.find((x) => x.id === id)
  Object.assign(t.value, { displayFont: f.display, bodyFont: f.body, fontsHref: f.href, fontPreset: f.id })
}
async function fromImage(e) {
  const f = e.target.files[0]
  if (!f) return
  try { palette.value = await suggestPalette(await fileToDataUrl(f, 400)) } catch { palette.value = [] }
  e.target.value = ''
}
const use = (key) => { if (picked.value) t.value[key] = picked.value }
const footerLinks = computed(() => site.value.footer.links || (site.value.footer.links = []))
</script>

<template>
  <div class="panel">
    <h3 class="panel__h">Business</h3>
    <div class="ff">
      <div class="ff__field"><label class="ff__label" for="sp-name">Name</label><input id="sp-name" v-model="site.settings.name" type="text" /></div>
      <div class="ff__field"><label class="ff__label" for="sp-email">Contact email</label><input id="sp-email" v-model="site.settings.contactEmail" type="email" /></div>
      <div class="ff__field"><label class="ff__label" for="sp-phone">Phone</label><input id="sp-phone" v-model="site.settings.phone" type="tel" /></div>
      <div class="ff__field"><label class="ff__label" for="sp-addr">Address</label><input id="sp-addr" v-model="site.settings.address" type="text" /></div>
    </div>

    <h3 class="panel__h">Publishing</h3>
    <div class="ff">
      <div class="ff__field"><label class="ff__label" for="sp-domain">Website address</label><input id="sp-domain" v-model="site.settings.domain" type="url" placeholder="https://www.example.com" /><small class="muted">Used for canonical links and the sitemap.</small></div>
      <div class="ff__field"><label class="ff__label" for="sp-form">Form address (optional)</label><input id="sp-form" v-model="site.settings.formEndpoint" type="url" placeholder="https://… accepts a JSON POST" /><small class="muted">Leave empty to open the visitor's email app, addressed to your contact email.</small></div>
    </div>

    <h3 class="panel__h">Header and footer</h3>
    <div class="ff">
      <div class="ff__field"><label class="ff__label" for="sp-logo">Logo text</label><input id="sp-logo" v-model="site.header.logoText" type="text" /></div>
      <div class="ff__field"><span class="ff__label">Logo image</span><ImageInput :model-value="site.header.logoImage || ''" label="Logo" @update:model-value="site.header.logoImage = $event" /></div>
      <div class="ff__field"><label class="ff__label" for="sp-cta">Header button label</label><input id="sp-cta" v-model="site.header.ctaLabel" type="text" /></div>
      <div class="ff__field"><label class="ff__label" for="sp-ctal">Header button link</label><input id="sp-ctal" v-model="site.header.ctaLink" type="text" /></div>
      <div class="ff__field"><label class="ff__label" for="sp-foot">Footer text</label><input id="sp-foot" v-model="site.footer.text" type="text" /></div>
      <div class="ff__field">
        <span class="ff__label">Extra footer links</span>
        <div v-for="(l, i) in footerLinks" :key="i" class="inline">
          <input v-model="l.label" type="text" placeholder="Label" aria-label="Link label" /><input v-model="l.href" type="text" placeholder="https://…" aria-label="Link address" />
          <button class="ico ico--danger" aria-label="Remove link" @click="footerLinks.splice(i, 1)">✕</button>
        </div>
        <button class="btn btn--sm btn--ghost" @click="footerLinks.push({ label: '', href: '' })">+ Add link</button>
      </div>
    </div>

    <h3 class="panel__h">Look</h3>
    <div class="swatches swatches--sm">
      <button v-for="c in colorPresets" :key="c.id" class="swatch" :class="{ on: t.colorPreset === c.id && t.accent === c.accent }" :title="c.label" @click="applyPreset(c)">
        <span class="swatch__chip" :style="{ background: c.bg, borderColor: c.ink }"><i :style="{ background: c.accent }"></i><i :style="{ background: c.ink }"></i></span>
      </button>
    </div>
    <div class="colors">
      <label>Background <input v-model="t.bg" type="color" /></label>
      <label>Cards <input v-model="t.surface" type="color" /></label>
      <label>Text <input v-model="t.ink" type="color" /></label>
      <label>Accent <input v-model="t.accent" type="color" /></label>
    </div>
    <p v-if="ratio < 4.5" class="notice notice--warn" role="status">Text on background contrast is {{ ratio.toFixed(1) }}:1. Aim for 4.5:1 so it is easy to read.</p>
    <p v-if="accentRatio < 3" class="notice notice--warn" role="status">The accent colour is hard to see against the background ({{ accentRatio.toFixed(1) }}:1).</p>

    <div class="ff__field"><label class="ff__label" for="sp-font">Fonts</label>
      <select id="sp-font" :value="t.fontPreset" @change="applyFont($event.target.value)"><option v-for="f in fontPairs" :key="f.id" :value="f.id">{{ f.label }}</option></select>
    </div>
    <div class="ff__field"><label class="ff__label" for="sp-rad">Corners</label>
      <select id="sp-rad" v-model="t.radius"><option v-for="r in radii" :key="r.id" :value="r.id">{{ r.label }}</option></select>
    </div>

    <details class="ff__item">
      <summary>Pick colours from an image</summary>
      <p class="muted small">Upload a logo or photo. Colours are sampled in your browser with simple pixel counting.</p>
      <input type="file" accept="image/*" @change="fromImage" />
      <div v-if="palette.length" class="swatches swatches--sm">
        <button v-for="c in palette" :key="c" class="dotbtn" :class="{ on: picked === c }" :style="{ background: c }" :aria-label="'Pick ' + c" @click="picked = c"></button>
      </div>
      <div v-if="picked" class="row"><small>Use as:</small>
        <button class="btn btn--sm btn--ghost" @click="use('accent')">Accent</button>
        <button class="btn btn--sm btn--ghost" @click="use('bg')">Background</button>
        <button class="btn btn--sm btn--ghost" @click="use('ink')">Text</button>
      </div>
    </details>
  </div>
</template>
