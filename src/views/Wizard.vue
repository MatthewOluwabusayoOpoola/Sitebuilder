<script setup>
import { computed, reactive, ref } from 'vue'
import { templates, getTemplate, buildSite } from '../schema/templates.js'
import { colorPresets, fontPairs, radii, makeTheme } from '../schema/themes.js'
import { fileToDataUrl, suggestPalette } from '../schema/util.js'
import { createSite } from '../store/sites.js'
import SiteRenderer from '../site/SiteRenderer.vue'

const emit = defineEmits(['cancel', 'created'])
const steps = ['Industry', 'Pages', 'Look', 'Basics', 'Review']
const step = ref(0)
const w = reactive({
  templateId: 'real-estate', pageIds: [], colorId: '', fontId: '', radius: '', accent: '',
  name: '', email: '', phone: '', address: '', logo: '', palette: [],
})
const tpl = computed(() => getTemplate(w.templateId))
const defaults = computed(() => tpl.value.theme())

function pickTemplate(t) {
  w.templateId = t.id
  w.pageIds = t.pages.map((p) => p.id)
  w.colorId = t.theme().colorPreset; w.fontId = t.theme().fontPreset; w.radius = t.theme().radius; w.accent = ''
}
pickTemplate(templates[0])

const theme = computed(() => {
  const t = makeTheme(w.colorId, w.fontId, w.radius)
  if (w.accent) t.accent = w.accent
  return t
})
const basics = computed(() => ({ name: w.name.trim() || 'Your Business', email: w.email.trim(), phone: w.phone.trim(), address: w.address.trim() }))
const previewSite = computed(() => {
  const s = buildSite({ templateId: w.templateId, pageIds: w.pageIds, theme: theme.value, basics: basics.value })
  if (w.logo) s.header.logoImage = w.logo
  return s
})

const emailBad = computed(() => w.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(w.email))
const canNext = computed(() => {
  if (step.value === 3) return w.name.trim().length > 0 && !emailBad.value
  return true
})

async function onLogo(e) {
  const f = e.target.files[0]
  if (!f) return
  w.logo = await fileToDataUrl(f, 400)
  try { w.palette = await suggestPalette(w.logo) } catch { w.palette = [] }
}

function create() {
  const id = createSite(previewSite.value)
  emit('created', id)
}
const togglePage = (p) => {
  if (p.required) return
  const i = w.pageIds.indexOf(p.id)
  i >= 0 ? w.pageIds.splice(i, 1) : w.pageIds.push(p.id)
}
</script>

<template>
  <div class="wiz">
    <header class="wiz__head">
      <button class="btn btn--ghost btn--sm" @click="emit('cancel')">← Cancel</button>
      <ol class="steps" aria-label="Progress">
        <li v-for="(s, i) in steps" :key="s" :class="{ on: i === step, done: i < step }" :aria-current="i === step ? 'step' : undefined">
          <span>{{ i + 1 }}</span> {{ s }}
        </li>
      </ol>
    </header>

    <div class="wiz__body">
      <section class="wiz__main">
        <!-- 1 -->
        <div v-if="step === 0">
          <h1>What kind of website?</h1>
          <p class="muted">The industry sets the pages, sections and sample content to start from.</p>
          <div class="choices">
            <button v-for="t in templates" :key="t.id" class="choice" :class="{ on: w.templateId === t.id }" @click="pickTemplate(t)">
              <strong>{{ t.label }}</strong><span>{{ t.blurb }}</span>
              <small>{{ t.pages.length }} pages</small>
            </button>
          </div>
        </div>
        <!-- 2 -->
        <div v-else-if="step === 1">
          <h1>Which pages do you need?</h1>
          <p class="muted">Home is always included. You can add or remove pages later.</p>
          <label v-for="p in tpl.pages" :key="p.id" class="check">
            <input type="checkbox" :checked="p.required || w.pageIds.includes(p.id)" :disabled="p.required" @change="togglePage(p)" />
            <span><strong>{{ p.title }}</strong> <code>{{ p.path }}</code></span>
          </label>
        </div>
        <!-- 3 -->
        <div v-else-if="step === 2">
          <h1>Choose the look</h1>
          <h3>Colours</h3>
          <div class="swatches">
            <button v-for="c in colorPresets" :key="c.id" class="swatch" :class="{ on: w.colorId === c.id && !w.accent }" :aria-pressed="w.colorId === c.id && !w.accent" @click="w.colorId = c.id; w.accent = ''">
              <span class="swatch__chip" :style="{ background: c.bg, borderColor: c.ink }"><i :style="{ background: c.accent }"></i><i :style="{ background: c.ink }"></i></span>{{ c.label }}
            </button>
          </div>
          <h3>Fonts</h3>
          <div class="row"><label v-for="f in fontPairs" :key="f.id" class="pill"><input v-model="w.fontId" type="radio" :value="f.id" name="font" /> {{ f.label }}</label></div>
          <h3>Corners</h3>
          <div class="row"><label v-for="r in radii" :key="r.id" class="pill"><input v-model="w.radius" type="radio" :value="r.id" name="radius" /> {{ r.label }}</label></div>
          <h3>Logo (optional)</h3>
          <p class="muted small">Upload a logo. The builder samples its colours with plain pixel maths and offers them as your accent colour.</p>
          <input type="file" accept="image/*" @change="onLogo" />
          <div v-if="w.logo" class="logo-row"><img :src="w.logo" alt="Your logo" /></div>
          <div v-if="w.palette.length" class="swatches swatches--sm">
            <button v-for="c in w.palette" :key="c" class="dotbtn" :style="{ background: c }" :aria-label="'Use ' + c + ' as accent colour'" :class="{ on: w.accent === c }" @click="w.accent = c"></button>
          </div>
        </div>
        <!-- 4 -->
        <div v-else-if="step === 3">
          <h1>About your business</h1>
          <label class="field"><span>Business name *</span><input v-model="w.name" type="text" autocomplete="organization" /></label>
          <label class="field"><span>Contact email</span><input v-model="w.email" type="email" autocomplete="email" /><em v-if="emailBad" class="err">That does not look like an email address.</em></label>
          <label class="field"><span>Phone</span><input v-model="w.phone" type="tel" autocomplete="tel" /></label>
          <label class="field"><span>Address or area</span><input v-model="w.address" type="text" autocomplete="street-address" /></label>
        </div>
        <!-- 5 -->
        <div v-else>
          <h1>Ready to create</h1>
          <ul class="summary">
            <li><strong>Type</strong> {{ tpl.label }}</li>
            <li><strong>Name</strong> {{ basics.name }}</li>
            <li><strong>Pages</strong> {{ previewSite.pages.map((p) => p.title).join(', ') }}</li>
            <li><strong>Look</strong> {{ colorPresets.find((c) => c.id === w.colorId)?.label }}<template v-if="w.accent"> with custom accent</template>, {{ fontPairs.find((f) => f.id === w.fontId)?.label }}</li>
          </ul>
          <p class="muted">You will land in the editor with a filled-in draft. Replace the sample text and photos, then export.</p>
        </div>

        <footer class="wiz__nav">
          <button class="btn btn--ghost" :disabled="step === 0" @click="step--">Back</button>
          <button v-if="step < steps.length - 1" class="btn" :disabled="!canNext" @click="step++">Next</button>
          <button v-else class="btn" @click="create">Create site</button>
        </footer>
      </section>

      <aside class="wiz__preview" aria-label="Live preview of your home page">
        <p class="muted small">Preview</p>
        <div class="mini"><div class="mini__inner"><SiteRenderer :site="previewSite" path="/" mode="edit" /></div></div>
      </aside>
    </div>
  </div>
</template>
