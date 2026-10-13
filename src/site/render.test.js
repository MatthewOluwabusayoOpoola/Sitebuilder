import { describe, it, expect } from 'vitest'
import { createSSRApp, h } from 'vue'
import { renderToString } from 'vue/server-renderer'
import SiteRenderer from './SiteRenderer.vue'
import { templates, buildSite } from '../schema/templates.js'
import { allRoutes } from './routes.js'
import { blockTypes, newSection } from '../schema/blocks.js'

const basics = { name: 'Test Co', email: 'a@b.co', phone: '123', address: '1 Road' }
const render = (site, path, mode = 'export') => renderToString(createSSRApp({ render: () => h(SiteRenderer, { site, path, mode }) }))

describe('server rendering', () => {
  for (const t of templates) {
    it(`${t.id}: every page and item page renders real content`, async () => {
      const site = buildSite({ templateId: t.id, pageIds: t.pages.map((p) => p.id), basics })
      for (const r of allRoutes(site)) {
        const html = await render(site, r.path)
        expect(html).toContain('<main')
        expect(html).not.toContain('Page not found')
        expect(html).toContain('Test Co')
      }
    })
  }
  it('renders every block type from its defaults without throwing', async () => {
    const site = buildSite({ templateId: 'agency', pageIds: [], basics })
    site.pages[0].sections = blockTypes.map((t) => {
      const s = newSection(t)
      if (t === 'collectionGrid') s.props.collection = 'work'
      return s
    })
    const html = await render(site, '/')
    expect(html.length).toBeGreaterThan(2000)
  })
  it('escapes user text so it cannot inject markup', async () => {
    const site = buildSite({ templateId: 'agency', pageIds: [], basics })
    site.pages[0].sections[0].props.headline = '<img src=x onerror=alert(1)>'
    const html = await render(site, '/')
    expect(html).not.toContain('<img src=x')
    expect(html).toContain('&lt;img src=x')
  })
  it('shows a friendly page for unknown addresses', async () => {
    const site = buildSite({ templateId: 'agency', pageIds: [], basics })
    expect(await render(site, '/nope')).toContain('Page not found')
  })
})
