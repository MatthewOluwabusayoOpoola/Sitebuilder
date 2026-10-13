import { mix, readableOn } from '../schema/util.js'

export function themeStyle(t) {
  return {
    '--bg': t.bg, '--surface': t.surface, '--ink': t.ink, '--accent': t.accent,
    '--accent-ink': readableOn(t.accent),
    '--muted': mix(t.ink, t.bg, 0.4),
    '--line': mix(t.ink, t.bg, 0.82),
    '--font-display': t.displayFont, '--font-body': t.bodyFont, '--radius': t.radius,
  }
}
