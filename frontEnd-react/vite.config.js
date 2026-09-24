import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), VitePWA({
    // The hand-maintained manifest is linked in index.html.
    manifest: false,
    injectRegister: false,
    registerType: 'prompt',
    includeAssets: ['manifest.json', 'app-icon.svg', 'app-icon-192.png', 'app-icon-512.png', 'apple-touch-icon.png'],
    workbox: {
      globPatterns: ['**/*.{js,css,html}'],
      navigateFallback: '/index.html',
      navigateFallbackDenylist: [/^\/api(?:\/|$)/],
      runtimeCaching: [],
      cleanupOutdatedCaches: true,
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
