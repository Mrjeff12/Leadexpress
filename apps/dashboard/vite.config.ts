import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // Pin React to this app's node_modules to avoid monorepo version conflicts
      'react': path.resolve(__dirname, './node_modules/react'),
      'react-dom': path.resolve(__dirname, './node_modules/react-dom'),
    },
  },
  build: {
    // mapbox-gl is irreducibly ~1.7 MB minified; suppress the warning
    // since it is already lazy-loaded behind route-level code splitting
    chunkSizeWarningLimit: 1800,
    rollupOptions: {
      output: {
        manualChunks(id) {
          // ── Maps (mapbox-gl) — isolated because it's huge & lazy-loaded ──
          if (id.includes('node_modules/mapbox-gl/')) {
            return 'maps'
          }

          // ── Remotion — isolated because it's large & lazy-loaded ──
          if (
            id.includes('node_modules/remotion/') ||
            id.includes('node_modules/@remotion/')
          ) {
            return 'remotion'
          }
        },
      },
    },
  },
})
