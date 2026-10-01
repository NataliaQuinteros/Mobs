import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // MapLibre parses vector tiles in a web worker it loads from its own package. The dev dependency
  // optimizer rewrites the library but leaves that worker behind, so it 404s and only the raster part
  // of the map ever draws. Left unoptimized, the worker resolves. Both go together, or the Leaflet
  // bridge ends up talking to a second copy of MapLibre and the pmtiles:// protocol is lost on it.
  optimizeDeps: {
    exclude: ['maplibre-gl', '@maplibre/maplibre-gl-leaflet'],
  },
  server: {
    proxy: { '/api': 'http://localhost:3001' },
  },
  test: {
    environment: 'jsdom',
    globals: false,
    setupFiles: ['src/test-setup.ts'],
  },
})
