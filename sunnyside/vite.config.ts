/// <reference types="vitest/config" />
import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    // game/, engine/, state/ тестируются без браузера (граница game↔scene, 21-client §3.1).
    environment: 'node',
    globals: true,
    // .tsx — component-тесты ui/ (@testing-library/react); per-file `@vitest-environment
    // jsdom` докблок переключает окружение только для них (по умолчанию — 'node' выше).
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    // Playwright-смоуки живут отдельно (e2e/), их сюда не пускаем.
    exclude: ['e2e/**', 'node_modules/**', 'dist/**'],
    coverage: {
      provider: 'v8',
      // Гейт 21-client §3.10: ≥90% строк для чистых эконом-формул.
      include: ['src/engine/econ/**'],
      thresholds: {
        lines: 90,
        functions: 90,
        branches: 80,
        statements: 90,
      },
    },
  },
})
