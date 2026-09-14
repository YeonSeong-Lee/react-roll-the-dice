import { resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  // GitHub Pages serves the build under /react-roll-the-dice/; the workflow
  // passes that in. Dev stays at / so scripts/film-demo.mjs keeps its URL.
  base: process.env.VITE_BASE ?? '/',
  plugins: [react()],
  server: { port: 5177 },
  build: {
    rollupOptions: {
      input: {
        // The published demo, which scripts/film-demo.mjs also captures the GIF
        // from; the test harness; and the repo's social preview card.
        main: resolve(import.meta.dirname, 'index.html'),
        harness: resolve(import.meta.dirname, 'harness.html'),
        social: resolve(import.meta.dirname, 'social.html'),
      },
    },
  },
})
