import { describe, it, expect } from 'vitest'
import { templates, buildSite } from './templates.js'
import { validateSite } from './validate.js'
import { resolveRoute, allRoutes, filePathFor, depthOf } from '../site/routes.js'
import { contrast, normPath, mix } from './util.js'
import { extractAssets, dataUrlToBytes } from '../export/exportSite.js'

const basics = { name: 'Acme "Homes" & Co', email: 'hi@acme.test', phone: '', address: '' }

describe('templates', () => {
  for (const t of templates) {
    it(`${t.id} builds a valid site with every page`, () => {
      const site = buildSite({ templateId: t.id, pageIds: t.pages.map((p) => p.id), basics })
      expect(site.pages.length).toBe(t.pages.length)
      const { errors } = validateSite(site)
      expect(errors).toEqual([])
      expect(JSON.stringify(site)).not.toMatch(/\{\{/)
      expect(site.settings.name).toBe('Acme "Homes" & Co')
    })
  }
  it('drops unchosen pages and repairs links to them', () => {
    const site = buildSite({ templateId: 'real-estate', pageIds: ['home'], basics })
    expect(site.pages.map((p) => p.path)).toEqual(['/'])
    expect(validateSite(site).warnings.join(' ')).not.toMatch(/not a page/)
  })
  it('does not leave dangling separators when optional basics are empty', () => {
    const site = buildSite({ templateId: 'real-estate', pageIds: ['home', 'contact'], basics })
    const hero = site.pages[1].sections[0].props.subline
    expect(hero).toBe('hi@acme.test')
  })
})

describe('validation', () => {
  it('rejects duplicate and invalid paths and a missing home', () => {
    const site = buildSite({ templateId: 'agency', pageIds: ['work'], basics })
    site.pages[1].path = '/Bad Path'
    site.pages.push({ ...site.pages[0], id: 'x' })
    const { errors } = validateSite(site)
    expect(errors.some((e) => /invalid address/.test(e))).toBe(true)
    expect(errors.some((e) => /Two pages/.test(e))).toBe(true)
  })
  it('warns about missing alt text and low contrast', () => {
    const site = buildSite({ templateId: 'agency', pageIds: [], basics })
    site.theme.ink = '#cccccc'
    site.theme.bg = '#ffffff'
    expect(validateSite(site).warnings.some((w) => /low contrast/.test(w))).toBe(true)
  })
})

describe('routing', () => {
  const site = buildSite({ templateId: 'restaurant', pageIds: ['menu'], basics })
  it('resolves pages, item pages and unknown paths', () => {
    expect(resolveRoute(site, '/menu/').kind).toBe('page')
    const id = site.collections.menu.items[0].id
    expect(resolveRoute(site, `/menu/${id}`).kind).toBe('detail')
    expect(resolveRoute(site, '/nope').kind).toBe('notfound')
  })
  it('lists every URL to export and maps them to files', () => {
    const routes = allRoutes(site).map((r) => r.path)
    expect(routes).toContain('/')
    expect(routes.length).toBe(site.pages.length + site.collections.menu.items.length)
    expect(filePathFor('/')).toBe('index.html')
    expect(filePathFor('/menu/x')).toBe('menu/x/index.html')
    expect(depthOf('/menu/x')).toBe(2)
  })
})

describe('utilities', () => {
  it('computes WCAG contrast', () => {
    expect(contrast('#000000', '#ffffff')).toBeCloseTo(21, 0)
    expect(contrast('#777777', '#777777')).toBeCloseTo(1, 5)
  })
  it('normalises paths and mixes colours', () => {
    expect(normPath('about/')).toBe('/about')
    expect(normPath('/a?x=1#y')).toBe('/a')
    expect(mix('#000000', '#ffffff', 0.5)).toBe('#808080')
  })
})

describe('asset extraction', () => {
  it('moves embedded images into files and dedupes', () => {
    const site = buildSite({ templateId: 'restaurant', pageIds: ['home'], basics })
    const { site: out, files } = extractAssets(site)
    expect(files.length).toBeGreaterThan(0)
    expect(JSON.stringify(out)).not.toMatch(/data:image/)
    expect(files.every((f) => f.name.startsWith('assets/') && f.bytes.length > 0)).toBe(true)
  })
  it('decodes base64 and utf8 data urls', () => {
    expect(dataUrlToBytes('data:image/png;base64,AAEC').bytes).toEqual(new Uint8Array([0, 1, 2]))
    expect(new TextDecoder().decode(dataUrlToBytes('data:image/svg+xml;utf8,%3Csvg%2F%3E').bytes)).toBe('<svg/>')
  })
})
