import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { readFileSync } from 'node:fs'

// The release version lives in the root package.json; shown in Settings › Guide.
const appVersion = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version

// https://vite.dev/config/
export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
  },
  plugins: [react(), VitePWA({
    // The hand-maintained manifest is linked in index.html.
    manifest: false,
    injectRegister: false,
    registerType: 'prompt',
    includeAssets: ['push-sw.js', 'manifest.json', 'app-icon.svg', 'favicon-32.png', 'app-icon-192.png', 'app-icon-512.png', 'app-icon-maskable-512.png', 'apple-touch-icon.png'],
    workbox: {
      globPatterns: ['**/*.{js,css,html}'],
      navigateFallback: '/index.html',
      navigateFallbackDenylist: [/^\/api(?:\/|$)/],
      runtimeCaching: [],
      cleanupOutdatedCaches: true,
      // Adds the push / notificationclick handlers to the generated worker.
      importScripts: ['/push-sw.js'],
    },
  })],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:24127',
        changeOrigin: true
      }
    }
  },
  build: {
    cssCodeSplit: true
  }
})
