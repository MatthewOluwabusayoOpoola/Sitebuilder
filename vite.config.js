import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  server: { proxy: { '/api': 'http://localhost:8787', '^/s/': 'http://localhost:8787' } },
  test: { environment: 'node', include: ['src/**/*.test.js', 'server/**/*.test.js'], testTimeout: 30000 },
})
