import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'build', // Specify the output directory
    sourcemap: true, // Generate source maps for debugging
    minify: 'esbuild', // Use esbuild for minification
  },
})
