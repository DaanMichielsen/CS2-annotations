import { resolve } from 'path'
import { defineConfig } from 'vitest/config'

const sharedEntry = resolve(__dirname, '../../packages/shared/src/index.ts')
const uiEntry = resolve(__dirname, '../../packages/ui/src/index.ts')

export default defineConfig({
  resolve: {
    alias: {
      '@cs2ann/shared': sharedEntry,
      '@cs2ann/ui': uiEntry,
    },
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    passWithNoTests: true,
  },
})
