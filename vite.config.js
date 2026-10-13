import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  server: { proxy: { '/api': 'http://localhost:8787', '^/s/': 'http://localhost:8787',
    // <slug>.localhost:5173 -> the API, which serves published sites by subdomain (needs SITES_DOMAIN=localhost:5173)
    '/': { target: 'http://localhost:8787', bypass: (req) => (/^[a-z0-9-]+\.localhost(:\d+)?$/i.test(req.headers.host || '') ? undefined : req.url) } } },
  test: { environment: 'node', include: ['src/**/*.test.js', 'server/**/*.test.js'], testTimeout: 30000 },
})
