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
          // ── Vendor: React core ──
          if (
            id.includes('node_modules/react/') ||
            id.includes('node_modules/react-dom/') ||
            id.includes('node_modules/react-router') ||
            id.includes('node_modules/scheduler/')
          ) {
            return 'vendor'
          }

          // ── Supabase ──
          if (id.includes('node_modules/@supabase/')) {
            return 'supabase'
          }

          // ── Charts (recharts only — d3 deps shared with xyflow stay auto-split) ──
          if (id.includes('node_modules/recharts/')) {
            return 'charts'
          }

          // ── d3 shared deps (used by both recharts and xyflow) ──
          if (
            id.includes('node_modules/d3-') ||
            id.includes('node_modules/internmap/')
          ) {
            return 'd3'
          }

          // ── Maps (mapbox-gl) ──
          if (id.includes('node_modules/mapbox-gl/')) {
            return 'maps'
          }

          // ── Flow / canvas (xyflow) ──
          if (id.includes('node_modules/@xyflow/')) {
            return 'xyflow'
          }

          // ── Remotion ──
          if (
            id.includes('node_modules/remotion/') ||
            id.includes('node_modules/@remotion/')
          ) {
            return 'remotion'
          }

          // ── UI primitives (Radix + icons + motion) ──
          if (
            id.includes('node_modules/@radix-ui/') ||
            id.includes('node_modules/lucide-react/') ||
            id.includes('node_modules/framer-motion/') ||
            id.includes('node_modules/class-variance-authority/') ||
            id.includes('node_modules/clsx/') ||
            id.includes('node_modules/tailwind-merge/')
          ) {
            return 'ui'
          }

          // ── Data fetching (tanstack query) ──
          if (id.includes('node_modules/@tanstack/')) {
            return 'query'
          }
        },
      },
    },
  },
})
