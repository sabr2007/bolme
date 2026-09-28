/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // e2e/*.spec.ts belong to Playwright; Vitest runs only the unit tests next to the code
  test: { include: ['src/**/*.test.ts'] },
})
