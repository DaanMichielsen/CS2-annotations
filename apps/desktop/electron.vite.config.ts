import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const sharedEntry = resolve(__dirname, '../../packages/shared/src/index.ts')
const uiEntry = resolve(__dirname, '../../packages/ui/src/index.ts')

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin({ exclude: ['@cs2ann/shared'] })],
    resolve: {
      alias: {
        '@cs2ann/shared': sharedEntry,
      },
    },
    build: {
      rollupOptions: {
        input: resolve(__dirname, 'electron/main/index.ts'),
        output: {
          dir: 'out/main'
        }
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin({ exclude: ['@cs2ann/shared'] })],
    resolve: {
      alias: {
        '@cs2ann/shared': sharedEntry,
      },
    },
    build: {
      rollupOptions: {
        input: resolve(__dirname, 'electron/preload/index.ts'),
        output: {
          dir: 'out/preload'
        }
      }
    }
  },
  renderer: {
    root: '.',
    resolve: {
      alias: {
        '@cs2ann/shared': sharedEntry,
        '@cs2ann/ui': uiEntry,
      },
    },
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'index.html')
        },
        output: {
          dir: 'out/renderer'
        }
      }
    },
    plugins: [tailwindcss(), react()]
  }
})
