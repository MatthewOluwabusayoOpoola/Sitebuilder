# Site Builder (no AI)

A template-driven website builder. Pick an industry, choose pages and a look, edit in a live
preview, then export a complete static website. Everything runs in the browser; nothing is sent anywhere.

## Run it

```sh
npm install
npm run dev        # builds the export runtime, then starts the builder
npm test           # 51 tests (frontend schema/render tests and API tests)
npm run build      # production build of the builder into dist/
```

Node 20+ recommended.

## What it does

- **Wizard (5 steps):** industry, pages, colours/fonts/corners (with colour suggestions sampled from an uploaded logo by plain canvas pixel counting), business basics, review. A live preview updates as you choose.
- **Editor:** pages and sections (add, reorder, hide, duplicate, delete), a form for every section generated from its field spec, collections (listings, menu items, projects) with their own item pages, site settings, desktop/tablet/phone preview, undo/redo (Ctrl+Z / Ctrl+Y), autosave to browser storage.
- **Templates:** Real estate, Restaurant/cafe, Studio/agency. 12 section types: hero, statement banner, feature grid, collection grid, gallery, scrolling text, testimonials, FAQ, stats, text, contact form, call to action.
- **Checks:** missing alt text, missing page descriptions, low colour contrast, broken internal links, invalid or duplicate page addresses, forms with nowhere to send.
- **Export (.zip):** every page and every item page as prerendered HTML (good for search engines), `site.css`, a small `site.js` that hydrates menus/forms/steppers, images as real files, `sitemap.xml` and `robots.txt` when a domain is set, `404.html`, `site.json` (re-importable), README. Works on any static host.

## How it is built

```
src/schema/      block catalog + field specs, templates, validation, themes, utilities
src/site/        the renderer used by BOTH the editor preview and the exported pages
src/blocks/      one small Vue component per section type
src/views/       dashboard, wizard, editor, export dialog
src/panels/      editor side panels (pages, collections, site settings)
src/export/      zip exporter (server-renders each page in the browser, extracts images)
src/runtime/     entry for the tiny script exported pages load (built by vite.runtime.config.js)
```

A site is one JSON document (`schemaVersion`, `theme`, `settings`, `header`, `footer`, `collections`, `pages`).
The renderer, editor, validator and exporter all read that same shape, so the preview matches the published site.

## Known limits of this first slice

- **Storage is the browser** (localStorage). No accounts, no sync. Use "Backup" to download JSON. Large photos can fill browser storage (images are downscaled to 1600px on upload).
- **No hosting or custom domains yet.** Export the zip and upload it to a static host.
- **Forms:** with no form address set, the contact form opens the visitor's email app. Set a form address in Site settings (any service accepting a JSON POST) for real submissions, or build the backend described in the plan.
- **Google Fonts** are linked from Google's servers. Self-hosting fonts is a planned improvement.
- Exported links use `<base href>` + folder URLs (`about/`), so open the export through a web server (`npx serve .`), not by double-clicking.
- Not yet built from the plan: accounts and database, hosted publishing, custom domains, form inbox, billing, collaboration.

## Accounts, cloud sync, hosting and form inbox (backend)

The builder works fully offline in the browser. Run the API to add accounts, saving to your account,
one-click publishing and a contact-form inbox. There is no AI anywhere in the product.

```bash
npm install
npm run build:runtime
npm run api      # API + hosted sites on http://localhost:8787 (embedded Postgres in ./data)
npm run dev      # builder on http://localhost:5173 (proxies /api and /s/ to the API)
```

In development, emails (verification, password reset, new form message) are printed to the API console.
For production run `npm run build`, serve `dist/` from your web server or CDN, route `/api` and `/s/` (or the wildcard sites domain) to `npm start`, and configure it with the
variables in `.env.example`:

| Variable | Purpose |
|---|---|
| `PORT` | API port (8787) |
| `DATABASE_URL` | Postgres connection string. Empty = embedded PGlite in `DATA_DIR` (dev only) |
| `DATA_DIR` | Uploaded images and published sites on local disk |
| `APP_URL` / `PUBLIC_URL` | Where the builder lives / the public address of this server (form endpoints, emailed links) |
| `SITES_DOMAIN` | Optional wildcard domain, so sites live at `<slug>.example.com`. Empty = `/s/<slug>/` |
| `COOKIE_SECURE`, `TRUST_PROXY` | Set to `true` behind HTTPS and a reverse proxy |
| `REQUIRE_VERIFIED` | Require a verified email to publish (default on in production) |
| `SMTP_URL`, `MAIL_FROM` | Real email delivery |
| `MAX_*` | Size and count limits (see `server/config.js`) |

Security notes: sessions are httpOnly cookies, state-changing calls need a custom CSRF header, uploads are
sniffed by content, published zips are validated and extracted safely, and published sites are served with a
sandboxing Content-Security-Policy. Known limits for a first release: the rate limiter is in memory (single
instance only), files live on local disk (swap `server/storage.js` for S3 to scale out), and there is no
billing, custom-domain or team support yet.

Tests: `npm test` (frontend schema/render tests and 32 API tests).

### Subdomain addresses in development

Set `SITES_DOMAIN=localhost:5173` (or `localhost:8787` to go straight to the API) when starting `npm run api`,
publish a site with the address `ade`, and open `http://ade.localhost:5173/`. Browsers resolve `*.localhost`
to your own machine, so no hosts-file edit is needed. In production, point a wildcard DNS record and
wildcard HTTPS certificate for `*.yourdomain.com` at the server and set `SITES_DOMAIN=yourdomain.com`.
