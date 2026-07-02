import { resolve } from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const sharedEntry = resolve(__dirname, '../../packages/shared/src/index.ts')
const uiEntry = resolve(__dirname, '../../packages/ui/src/index.ts')

export default defineConfig(async () => ({
  plugins: [tailwindcss(), react()],
  resolve: {
    alias: {
      '@cs2ann/shared': sharedEntry,
      '@cs2ann/ui': uiEntry,
    },
  },
  clearScreen: false,
  server: {
    port: 5183,
    strictPort: true,
  },
  envPrefix: ['VITE_', 'TAURI_'],
  build: {
    target: process.env.TAURI_ENV_PLATFORM === 'windows' ? 'chrome105' : 'safari13',
    minify: !process.env.TAURI_ENV_DEBUG ? 'esbuild' : false,
    sourcemap: !!process.env.TAURI_ENV_DEBUG,
  },
}))
