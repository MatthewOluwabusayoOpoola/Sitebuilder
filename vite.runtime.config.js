// Builds the tiny runtime that exported sites load to hydrate prerendered pages.
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  define: { 'process.env.NODE_ENV': '"production"' },
  publicDir: false,
  build: {
    outDir: 'public/runtime',
    emptyOutDir: true,
    cssCodeSplit: false,
    lib: { entry: 'src/runtime/main.js', name: 'SiteRuntime', formats: ['iife'], fileName: () => 'site.js', cssFileName: 'site' },
  },
})
