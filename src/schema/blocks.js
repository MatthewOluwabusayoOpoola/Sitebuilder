// Block catalog: each block has defaults and an editor field spec.
// Field types: text, textarea, image, link, select, number, list, collection
import { clone, uid } from './util.js'

const cta = [
  { key: 'ctaLabel', label: 'Button label', type: 'text' },
  { key: 'ctaLink', label: 'Button link', type: 'link' },
]

export const blockDefs = {
  hero: {
    label: 'Hero',
    defaults: { eyebrow: '', headline: 'Your headline goes here', subline: 'One clear sentence about what you do.', image: '', imageAlt: '', ctaLabel: 'Get started', ctaLink: '/contact', layout: 'center' },
    fields: [
      { key: 'layout', label: 'Layout', type: 'select', options: [['center', 'Centered'], ['split', 'Text + image'], ['compact', 'Compact (no image)']] },
      { key: 'eyebrow', label: 'Small label above', type: 'text' },
      { key: 'headline', label: 'Headline', type: 'textarea' },
      { key: 'subline', label: 'Subline', type: 'textarea' },
      { key: 'image', label: 'Image', type: 'image' },
      { key: 'imageAlt', label: 'Image description (alt text)', type: 'text' },
      ...cta,
    ],
  },
  banner: {
    label: 'Statement banner',
    defaults: { headline: 'A bold statement', body: 'Support it with a short paragraph.', ctaLabel: 'Learn more', ctaLink: '/about', tone: 'accent' },
    fields: [
      { key: 'tone', label: 'Colour', type: 'select', options: [['accent', 'Accent'], ['ink', 'Dark'], ['surface', 'Light']] },
      { key: 'headline', label: 'Headline', type: 'textarea' },
      { key: 'body', label: 'Text', type: 'textarea' },
      ...cta,
    ],
  },
  features: {
    label: 'Feature grid',
    defaults: { heading: 'What we do', items: [{ title: 'First feature', text: 'Describe it briefly.', image: '', imageAlt: '' }, { title: 'Second feature', text: 'Describe it briefly.', image: '', imageAlt: '' }, { title: 'Third feature', text: 'Describe it briefly.', image: '', imageAlt: '' }] },
    fields: [
      { key: 'heading', label: 'Heading', type: 'text' },
      { key: 'items', label: 'Items', type: 'list', itemLabel: 'title', itemFields: [
        { key: 'title', label: 'Title', type: 'text' },
        { key: 'text', label: 'Text', type: 'textarea' },
        { key: 'image', label: 'Image (optional)', type: 'image' },
        { key: 'imageAlt', label: 'Image description', type: 'text' },
      ] },
    ],
  },
  collectionGrid: {
    label: 'Collection grid',
    defaults: { heading: 'Featured', collection: '', limit: 6, columns: 3, style: 'plain', exclude: '' },
    fields: [
      { key: 'heading', label: 'Heading', type: 'text' },
      { key: 'collection', label: 'Collection', type: 'collection' },
      { key: 'limit', label: 'How many to show', type: 'number' },
      { key: 'columns', label: 'Columns', type: 'select', options: [[2, '2'], [3, '3'], [4, '4']] },
      { key: 'style', label: 'Card style', type: 'select', options: [['plain', 'Plain'], ['overlay', 'Label on image']] },
    ],
  },
  gallery: {
    label: 'Gallery',
    defaults: { heading: 'Gallery', images: [] },
    fields: [
      { key: 'heading', label: 'Heading', type: 'text' },
      { key: 'images', label: 'Images', type: 'list', itemLabel: 'alt', itemFields: [
        { key: 'src', label: 'Image', type: 'image' },
        { key: 'alt', label: 'Image description (alt text)', type: 'text' },
      ] },
    ],
  },
  marquee: {
    label: 'Scrolling text',
    defaults: { text: 'SAY SOMETHING MEMORABLE', tone: 'accent' },
    fields: [
      { key: 'text', label: 'Text', type: 'text' },
      { key: 'tone', label: 'Colour', type: 'select', options: [['accent', 'Accent'], ['ink', 'Ink']] },
    ],
  },
  testimonials: {
    label: 'Testimonials',
    defaults: { heading: 'Kind words', items: [{ quote: 'A short quote from a happy client.', name: 'Client name', role: 'Role or company' }] },
    fields: [
      { key: 'heading', label: 'Heading', type: 'text' },
      { key: 'items', label: 'Testimonials', type: 'list', itemLabel: 'name', itemFields: [
        { key: 'quote', label: 'Quote', type: 'textarea' },
        { key: 'name', label: 'Name', type: 'text' },
        { key: 'role', label: 'Role', type: 'text' },
      ] },
    ],
  },
  faq: {
    label: 'FAQ',
    defaults: { heading: 'Questions', items: [{ q: 'A common question?', a: 'A clear answer.' }] },
    fields: [
      { key: 'heading', label: 'Heading', type: 'text' },
      { key: 'items', label: 'Questions', type: 'list', itemLabel: 'q', itemFields: [
        { key: 'q', label: 'Question', type: 'text' },
        { key: 'a', label: 'Answer', type: 'textarea' },
      ] },
    ],
  },
  stats: {
    label: 'Stats row',
    defaults: { items: [{ value: '100+', label: 'Happy clients' }, { value: '10 yrs', label: 'Experience' }, { value: '24h', label: 'Reply time' }] },
    fields: [
      { key: 'items', label: 'Stats', type: 'list', itemLabel: 'label', itemFields: [
        { key: 'value', label: 'Value', type: 'text' },
        { key: 'label', label: 'Label', type: 'text' },
      ] },
    ],
  },
  richText: {
    label: 'Text section',
    defaults: { heading: 'About us', body: 'Write a few paragraphs here.\n\nA blank line starts a new paragraph.' },
    fields: [
      { key: 'heading', label: 'Heading', type: 'text' },
      { key: 'body', label: 'Text', type: 'textarea', rows: 8 },
    ],
  },
  contactForm: {
    label: 'Contact form',
    defaults: { heading: 'Get in touch', intro: 'Tell us a little about your project and we will reply soon.', buttonLabel: 'Send message', successMessage: 'Thank you. Your message has been sent.' },
    fields: [
      { key: 'heading', label: 'Heading', type: 'text' },
      { key: 'intro', label: 'Intro text', type: 'textarea' },
      { key: 'buttonLabel', label: 'Button label', type: 'text' },
      { key: 'successMessage', label: 'Success message', type: 'text' },
    ],
  },
  cta: {
    label: 'Call to action',
    defaults: { headline: 'Ready to start?', body: '', ctaLabel: 'Contact us', ctaLink: '/contact' },
    fields: [
      { key: 'headline', label: 'Headline', type: 'textarea' },
      { key: 'body', label: 'Text', type: 'textarea' },
      ...cta,
    ],
  },
}

export const blockTypes = Object.keys(blockDefs)

export function newSection(type, props = {}) {
  const def = blockDefs[type]
  if (!def) throw new Error('Unknown block type: ' + type)
  return { id: 's_' + uid(), type, hidden: false, props: { ...clone(def.defaults), ...props } }
}
