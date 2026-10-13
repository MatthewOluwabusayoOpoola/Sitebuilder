export const colorPresets = [
  { id: 'ivory-oxblood', label: 'Ivory & Oxblood', bg: '#F8F6F3', surface: '#FFFFFF', ink: '#0D0C0C', accent: '#7A2B24' },
  { id: 'navy-gold', label: 'Navy & Gold', bg: '#F5F7FA', surface: '#FFFFFF', ink: '#0B1F3A', accent: '#B8893B' },
  { id: 'midnight-lime', label: 'Midnight & Lime', bg: '#1C1C1C', surface: '#262626', ink: '#F4F1EC', accent: '#CDEF54' },
  { id: 'forest', label: 'Forest', bg: '#F3F5F0', surface: '#FFFFFF', ink: '#14281D', accent: '#2F6B4F' },
  { id: 'violet', label: 'Violet', bg: '#FAF8FF', surface: '#FFFFFF', ink: '#1B1530', accent: '#6C47D9' },
  { id: 'charcoal', label: 'Charcoal & Coral', bg: '#F4F2F0', surface: '#FFFFFF', ink: '#222222', accent: '#E4572E' },
]

export const fontPairs = [
  { id: 'system', label: 'System (fastest)', display: 'system-ui, -apple-system, "Segoe UI", sans-serif', body: 'system-ui, -apple-system, "Segoe UI", sans-serif', href: '' },
  { id: 'modern', label: 'Modern sans', display: '"Inter", system-ui, sans-serif', body: '"Inter", system-ui, sans-serif', href: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700&display=swap' },
  { id: 'editorial', label: 'Editorial serif', display: '"Bodoni Moda", Georgia, serif', body: '"Inter", system-ui, sans-serif', href: 'https://fonts.googleapis.com/css2?family=Bodoni+Moda:wght@400;600;800&family=Inter:wght@400;500&display=swap' },
  { id: 'bold', label: 'Bold display', display: '"Archivo Black", Impact, sans-serif', body: '"Inter", system-ui, sans-serif', href: 'https://fonts.googleapis.com/css2?family=Archivo+Black&family=Inter:wght@400;500;700&display=swap' },
]

export const radii = [
  { id: '0px', label: 'Square' },
  { id: '8px', label: 'Soft' },
  { id: '18px', label: 'Round' },
]

export function makeTheme(colorId, fontId, radius = '8px') {
  const c = colorPresets.find((x) => x.id === colorId) || colorPresets[0]
  const f = fontPairs.find((x) => x.id === fontId) || fontPairs[1]
  return {
    colorPreset: c.id, bg: c.bg, surface: c.surface, ink: c.ink, accent: c.accent,
    fontPreset: f.id, displayFont: f.display, bodyFont: f.body, fontsHref: f.href, radius,
  }
}
