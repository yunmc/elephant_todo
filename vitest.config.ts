import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'url'

export default defineConfig({
  resolve: {
    alias: {
      '~~/': fileURLToPath(new URL('./', import.meta.url)) + '/',
      '~/': fileURLToPath(new URL('./', import.meta.url)) + '/',
      '~~': fileURLToPath(new URL('./', import.meta.url)),
      '~': fileURLToPath(new URL('./', import.meta.url)),
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
    globals: true,
    setupFiles: ['tests/setup.ts'],
  },
})
