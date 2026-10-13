import { clone, normPath, slug, uid } from './util.js'
import { newSection } from './blocks.js'
import { makeTheme } from './themes.js'

// Neutral SVG placeholder so templates look finished before real photos are added.
export function placeholder(label, c1 = '#cfd6e0', c2 = '#8e9bb0', w = 1200, h = 800) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient></defs><rect width="${w}" height="${h}" fill="url(#g)"/><text x="50%" y="50%" text-anchor="middle" dominant-baseline="middle" font-family="system-ui,sans-serif" font-size="${Math.round(Math.min(h / 12, (w * 0.84) / (Math.max(label.length, 6) * 0.52)))}" fill="rgba(255,255,255,.85)">${label.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</text></svg>`
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg)
}

const S = (type, props) => newSection(type, props)
const item = (title, rest) => ({ id: slug(title) + '-' + uid().slice(0, 3), title, imageAlt: title, ...rest })

// ---------------------------------------------------------------- real estate
const listingColors = [['#9db4d0', '#4b6a93'], ['#c8b79a', '#8b7656'], ['#a7c4b5', '#4f7a67'], ['#c6a9b8', '#855e73'], ['#b5b9d8', '#5d6397'], ['#d2b49e', '#946445']]
const listings = [
  ['Sunlit 2-bed loft', 420000, 'Riverside', 2, 1, 980, 'For sale', 'Bright corner loft with floor-to-ceiling windows and a private balcony.'],
  ['Family home with garden', 585000, 'Maple Park', 4, 3, 2400, 'For sale', 'Spacious four-bedroom home with a landscaped garden and double garage.'],
  ['Modern city studio', 1850, 'Downtown', 1, 1, 520, 'For rent', 'Compact studio steps from transit, cafes and the waterfront.'],
  ['Townhouse near the park', 349000, 'Greenfield', 3, 2, 1650, 'For sale', 'Three-level townhouse with a roof terrace and open-plan living area.'],
  ['Penthouse with skyline views', 920000, 'Harbour District', 3, 2, 1800, 'For sale', 'Top-floor penthouse with a wraparound terrace and concierge service.'],
  ['Cosy cottage', 2400, 'Old Village', 2, 1, 1100, 'For rent', 'Character cottage with a fireplace, garden and quiet street.'],
].map((r, i) => item(r[0], { price: r[1], location: r[2], beds: r[3], baths: r[4], area: r[5], status: r[6], description: r[7], image: placeholder(r[0], ...listingColors[i]) }))

const realEstate = {
  id: 'real-estate',
  label: 'Real estate',
  blurb: 'Listings grid, listing detail pages, enquiry form.',
  theme: () => makeTheme('navy-gold', 'modern', '8px'),
  header: { logoText: '{{name}}', ctaLabel: 'Book a viewing', ctaLink: '/contact' },
  footer: { text: '© {{year}} {{name}}. All rights reserved.', links: [] },
  collections: () => ({
    listings: {
      label: 'Listings', itemLabel: 'Listing', currency: '$',
      fields: [
        { key: 'title', label: 'Title', type: 'text' }, { key: 'price', label: 'Price', type: 'number' },
        { key: 'status', label: 'Status', type: 'select', options: [['For sale', 'For sale'], ['For rent', 'For rent'], ['Sold', 'Sold']] },
        { key: 'location', label: 'Location', type: 'text' }, { key: 'beds', label: 'Bedrooms', type: 'number' },
        { key: 'baths', label: 'Bathrooms', type: 'number' }, { key: 'area', label: 'Area (sq ft)', type: 'number' },
        { key: 'image', label: 'Photo', type: 'image' }, { key: 'imageAlt', label: 'Photo description', type: 'text' },
        { key: 'description', label: 'Description', type: 'textarea' },
      ],
      display: { price: 'price', subtitle: 'location', tag: 'status', badges: [{ key: 'beds', suffix: ' bd' }, { key: 'baths', suffix: ' ba' }, { key: 'area', suffix: ' sq ft' }] },
      detail: { enabled: true, showQuantity: false, buttonLabel: 'Book a viewing', buttonLink: '/contact' },
      items: clone(listings),
    },
  }),
  pages: [
    { id: 'home', title: 'Home', path: '/', nav: true, required: true, description: 'Find your next home with {{name}}: homes for sale and rent, local expertise and friendly service.', sections: () => [
      S('hero', { layout: 'split', eyebrow: 'Homes for sale and rent', headline: "Find the place you'll call home", subline: '{{name}} helps you buy, sell and rent with local knowledge and honest advice.', image: placeholder('Your best photo here', '#9db4d0', '#4b6a93'), imageAlt: 'A bright modern home', ctaLabel: 'Browse listings', ctaLink: '/listings' }),
      S('stats', { items: [{ value: '120+', label: 'Homes sold' }, { value: '15 yrs', label: 'Local experience' }, { value: '48h', label: 'Average first viewing' }] }),
      S('collectionGrid', { heading: 'Featured homes', collection: 'listings', limit: 3, columns: 3 }),
      S('features', { heading: 'Why choose us', items: [{ title: 'Local expertise', text: 'We know every street, school and shortcut in the neighbourhoods we serve.', image: '', imageAlt: '' }, { title: 'Straight answers', text: 'Clear pricing and honest advice, from first viewing to keys in hand.', image: '', imageAlt: '' }, { title: 'Always reachable', text: 'One named contact who answers the phone and follows through.', image: '', imageAlt: '' }] }),
      S('testimonials', { heading: 'What clients say', items: [{ quote: 'They found us the perfect home in three weeks and handled everything.', name: 'Sample client', role: 'First-time buyer' }, { quote: 'Sold above asking, with no stress.', name: 'Sample client', role: 'Seller' }] }),
      S('cta', { headline: 'Looking to buy, sell or rent?', body: 'Tell us what you need and we will be in touch within one working day.', ctaLabel: 'Contact us', ctaLink: '/contact' }),
    ] },
    { id: 'listings', title: 'Listings', path: '/listings', nav: true, description: 'Browse all homes for sale and rent from {{name}}.', sections: () => [
      S('hero', { layout: 'compact', headline: 'All listings', subline: 'Homes for sale and rent. Select a listing for details.', ctaLabel: '', ctaLink: '' }),
      S('collectionGrid', { heading: '', collection: 'listings', limit: 24, columns: 3 }),
    ] },
    { id: 'about', title: 'About', path: '/about', nav: true, description: 'Meet the team at {{name}}.', sections: () => [
      S('hero', { layout: 'compact', headline: 'About {{name}}', subline: 'A local team that treats every move like our own.', ctaLabel: '', ctaLink: '' }),
      S('richText', { heading: 'Our story', body: 'Tell visitors who you are, how long you have worked in the area, and what makes your service different.\n\nKeep it personal: people hire people.' }),
      S('faq', { heading: 'Common questions', items: [{ q: 'How much does it cost to sell?', a: 'Describe your fees here, in plain language.' }, { q: 'Do you manage rentals?', a: 'Explain your rental management service here.' }] }),
    ] },
    { id: 'contact', title: 'Contact', path: '/contact', nav: true, description: 'Contact {{name}} to book a viewing or ask about a property.', sections: () => [
      S('hero', { layout: 'compact', headline: 'Contact us', subline: '{{address}}  ·  {{phone}}  ·  {{email}}', ctaLabel: '', ctaLink: '' }),
      S('contactForm', { heading: 'Book a viewing or ask a question', intro: 'Tell us which property you are interested in and when you are free.' }),
    ] },
  ],
}

// ----------------------------------------------------------------- restaurant
const dishColors = [['#e0a458', '#a8641b'], ['#d9825b', '#8a3f22'], ['#9cc27a', '#4d7a2f'], ['#e3c16f', '#9c7a1f'], ['#c97b84', '#7d3641'], ['#8fb8c9', '#3f6f87']]
const dishes = [
  ['Signature burger', 11, 'Burgers', 'Double patty, house sauce, pickles, lettuce and tomato on a toasted bun.'],
  ['Crispy chicken sandwich', 10, 'Sandwiches', 'Buttermilk fried chicken, slaw and hot honey.'],
  ['Salt & vinegar fries', 5, 'Sides', 'Hand-cut, twice fried and seasoned while hot.'],
  ['Garden salad', 8, 'Sides', 'Seasonal leaves, herbs and a lemon dressing.'],
  ['Thick shake', 6, 'Drinks', 'Vanilla, chocolate or strawberry.'],
  ['Brownie', 5, 'Dessert', 'Warm, fudgy and served with cream.'],
].map((r, i) => item(r[0], { price: r[1], category: r[2], description: r[3], image: placeholder(r[0], ...dishColors[i], 900, 900) }))

const restaurant = {
  id: 'restaurant',
  label: 'Restaurant or cafe',
  blurb: 'Menu grid, dish pages with quantity and order button, bold look.',
  theme: () => makeTheme('midnight-lime', 'bold', '18px'),
  header: { logoText: '{{name}}', ctaLabel: 'Order online', ctaLink: '/menu' },
  footer: { text: '© {{year}} {{name}}  ·  {{address}}', links: [] },
  collections: () => ({
    menu: {
      label: 'Menu', itemLabel: 'Dish', currency: '$',
      fields: [
        { key: 'title', label: 'Name', type: 'text' }, { key: 'price', label: 'Price', type: 'number' },
        { key: 'category', label: 'Category', type: 'text' }, { key: 'image', label: 'Photo', type: 'image' },
        { key: 'imageAlt', label: 'Photo description', type: 'text' }, { key: 'description', label: 'Description', type: 'textarea' },
      ],
      display: { price: 'price', subtitle: 'category', badges: [] },
      detail: { enabled: true, showQuantity: true, buttonLabel: 'Order online', buttonLink: '' },
      items: clone(dishes),
    },
  }),
  pages: [
    { id: 'home', title: 'Home', path: '/', nav: true, required: true, description: '{{name}}: fresh food made to order. See the menu and order online.', sections: () => [
      S('hero', { layout: 'center', headline: 'Fresh.\nLocal.\nMade to order.', subline: '{{name}} serves honest food with good ingredients.', image: placeholder('Your signature dish', '#e0a458', '#a8641b', 1400, 700), imageAlt: 'Our signature dish', ctaLabel: 'See the menu', ctaLink: '/menu' }),
      S('banner', { tone: 'accent', headline: 'The dish\nyou will\nremember', body: 'Tell people what makes your kitchen different in one or two sentences.', ctaLabel: 'About us', ctaLink: '/about' }),
      S('collectionGrid', { heading: '', collection: 'menu', limit: 2, columns: 2, style: 'overlay' }),
      S('marquee', { text: 'FRESH EVERY DAY  ·  MADE TO ORDER  ·  ', tone: 'accent' }),
      S('gallery', { heading: 'Inside the kitchen', images: [{ src: placeholder('Kitchen', '#6b7280', '#374151'), alt: 'Our kitchen' }, { src: placeholder('Dining room', '#a78b6b', '#6b4f2f'), alt: 'The dining room' }, { src: placeholder('Team', '#7b8fa6', '#3b4c63'), alt: 'The team at work' }] }),
      S('cta', { headline: 'Order online\nor come visit us today', body: '{{address}}', ctaLabel: 'Order now', ctaLink: '/menu' }),
    ] },
    { id: 'menu', title: 'Menu', path: '/menu', nav: true, description: 'The full {{name}} menu. Choose a dish and order online.', sections: () => [
      S('banner', { tone: 'accent', headline: 'The full\nmenu', body: 'Choose a dish to see details and place an order.', ctaLabel: '', ctaLink: '' }),
      S('collectionGrid', { heading: '', collection: 'menu', limit: 24, columns: 2, style: 'overlay' }),
    ] },
    { id: 'about', title: 'About', path: '/about', nav: true, description: 'The story behind {{name}}.', sections: () => [
      S('hero', { layout: 'compact', headline: 'Our story', subline: 'Where we cook, who we cook for, and why.', ctaLabel: '', ctaLink: '' }),
      S('richText', { heading: 'How we started', body: 'Write a few honest paragraphs about your kitchen, your suppliers and your people.' }),
      S('faq', { heading: 'Good to know', items: [{ q: 'Do you take bookings?', a: 'Explain how to book a table here.' }, { q: 'Do you cater for allergies?', a: 'Tell guests how you handle dietary needs.' }] }),
    ] },
    { id: 'contact', title: 'Contact', path: '/contact', nav: true, description: 'Opening hours, address and contact details for {{name}}.', sections: () => [
      S('hero', { layout: 'compact', headline: 'Find us', subline: '{{address}}  ·  {{phone}}  ·  {{email}}', ctaLabel: '', ctaLink: '' }),
      S('contactForm', { heading: 'Questions or bookings?', intro: 'Send us a message and we will reply as soon as we can.' }),
    ] },
  ],
}

// --------------------------------------------------------------------- agency
const caseColors = [['#cbb8a6', '#7a5f4a'], ['#a9b8c9', '#4c6079'], ['#c9a9b3', '#7a4a5a'], ['#b5c9a9', '#58774a']]
const cases = ['Northwind identity', 'Aster & Co website', 'Fieldnote editorial', 'Halcyon packaging'].map((t, i) =>
  item(t, { category: ['Branding', 'Web design', 'Editorial', 'Packaging'][i], description: 'A short case study summary. Explain the brief, your approach and the result.', image: placeholder(t, ...caseColors[i]) }))

const agency = {
  id: 'agency',
  label: 'Studio or agency',
  blurb: 'Services, case studies, testimonials and FAQ in an editorial style.',
  theme: () => makeTheme('ivory-oxblood', 'editorial', '0px'),
  header: { logoText: '{{name}}', ctaLabel: 'Start a project', ctaLink: '/contact' },
  footer: { text: '© {{year}} {{name}}. All rights reserved.', links: [] },
  collections: () => ({
    work: {
      label: 'Work', itemLabel: 'Project', currency: '',
      fields: [
        { key: 'title', label: 'Title', type: 'text' }, { key: 'category', label: 'Category', type: 'text' },
        { key: 'image', label: 'Cover image', type: 'image' }, { key: 'imageAlt', label: 'Image description', type: 'text' },
        { key: 'description', label: 'Summary', type: 'textarea' },
      ],
      display: { subtitle: 'category', badges: [] },
      detail: { enabled: true, showQuantity: false, buttonLabel: 'Start a project', buttonLink: '/contact' },
      items: clone(cases),
    },
  }),
  pages: [
    { id: 'home', title: 'Home', path: '/', nav: true, required: true, description: '{{name}}: branding and web design for creative businesses.', sections: () => [
      S('hero', { layout: 'center', eyebrow: 'Branding & web design', headline: 'Make something\npeople remember.', subline: 'Strategic identities and bespoke websites for studios that refuse to be ordinary.', ctaLabel: 'See our work', ctaLink: '/work' }),
      S('collectionGrid', { heading: 'Selected work', collection: 'work', limit: 4, columns: 2 }),
      S('features', { heading: 'Services', items: [{ title: 'Brand identity', text: 'Strategy, naming, logo and a complete visual system.', image: '', imageAlt: '' }, { title: 'Web design', text: 'Fast, accessible websites designed around your story.', image: '', imageAlt: '' }, { title: 'Design days', text: 'A focused one-day sprint to move a project forward.', image: '', imageAlt: '' }] }),
      S('testimonials', { heading: 'Client notes', items: [{ quote: 'They changed how our clients see us.', name: 'Sample client', role: 'Founder' }] }),
      S('cta', { headline: 'Craft your legacy.', body: 'We take on a limited number of projects each quarter.', ctaLabel: 'Start the conversation', ctaLink: '/contact' }),
    ] },
    { id: 'work', title: 'Work', path: '/work', nav: true, description: 'Recent projects from {{name}}.', sections: () => [
      S('hero', { layout: 'compact', headline: 'Work', subline: 'A selection of recent projects.', ctaLabel: '', ctaLink: '' }),
      S('collectionGrid', { heading: '', collection: 'work', limit: 24, columns: 2 }),
    ] },
    { id: 'about', title: 'About', path: '/about', nav: true, description: 'About {{name}} and how we work.', sections: () => [
      S('hero', { layout: 'compact', headline: 'About', subline: 'Designing with intention and impact.', ctaLabel: '', ctaLink: '' }),
      S('richText', { heading: 'How we work', body: 'Describe your process and what clients can expect.' }),
      S('stats', { items: [{ value: '120+', label: 'Brands elevated' }, { value: '8 yrs', label: 'In practice' }, { value: '2 wks', label: 'Typical first concept' }] }),
      S('faq', { heading: 'FAQ', items: [{ q: 'What is your revision policy?', a: 'Explain how revision rounds work.' }, { q: 'How long does a project take?', a: 'Give a typical range.' }] }),
    ] },
    { id: 'contact', title: 'Contact', path: '/contact', nav: true, description: 'Start a project with {{name}}.', sections: () => [
      S('hero', { layout: 'compact', headline: 'Start a project', subline: '{{email}}  ·  {{phone}}', ctaLabel: '', ctaLink: '' }),
      S('contactForm', { heading: 'Client application', intro: 'Tell us about your business and what you need.' }),
    ] },
  ],
}

export const templates = [realEstate, restaurant, agency]
export const getTemplate = (id) => templates.find((t) => t.id === id)

// Build a complete site document from wizard choices.
export function buildSite({ templateId, pageIds, theme, basics }) {
  const tpl = getTemplate(templateId)
  const picked = tpl.pages.filter((p) => p.required || !pageIds || pageIds.includes(p.id))
  const keep = new Set(picked.map((p) => normPath(p.path)))
  const site = {
    schemaVersion: 1,
    theme: theme || tpl.theme(),
    settings: { name: basics.name, contactEmail: basics.email || '', phone: basics.phone || '', address: basics.address || '', formEndpoint: '', domain: '', template: templateId },
    header: clone(tpl.header),
    footer: clone(tpl.footer),
    collections: tpl.collections(),
    pages: picked.map((p) => ({ id: p.id + '_' + uid().slice(0, 3), title: p.title, path: p.path, nav: p.nav, description: p.description, sections: p.sections() })),
  }
  // Links to pages that were not chosen fall back to home.
  const fix = (v) => {
    if (Array.isArray(v)) return v.map(fix)
    if (v && typeof v === 'object') { for (const k of Object.keys(v)) v[k] = fix(v[k]); return v }
    if (typeof v === 'string' && /^\/[a-z0-9\-/]*$/.test(v) && !keep.has(normPath(v)) && !Object.keys(site.collections).some((c) => v.startsWith('/' + c + '/'))) return '/'
    return v
  }
  fix(site.pages); fix(site.header); fix(site.collections)
  const vars = { name: basics.name, email: basics.email || '', phone: basics.phone || '', address: basics.address || '', year: String(new Date().getFullYear()) }
  let json = JSON.stringify(site)
  json = json.replace(/\{\{(\w+)\}\}/g, (_, k) => JSON.stringify(vars[k] ?? '').slice(1, -1))
  const out = JSON.parse(json)
  // Tidy empty separators left by missing optional basics, e.g. "  ·    ·  ".
  const tidy = (s) => s.replace(/(\s*·\s*){2,}/g, '  ·  ').replace(/^\s*·\s*|\s*·\s*$/g, '')
  const walk = (v) => {
    if (Array.isArray(v)) return v.map(walk)
    if (v && typeof v === 'object') { for (const k of Object.keys(v)) v[k] = walk(v[k]); return v }
    return typeof v === 'string' && v.includes('·') ? tidy(v) : v
  }
  return walk(out)
}
