/// <reference types="vitest/config" />
import { defineConfig } from 'vitest/config';

/**
 * Vite + Vitest configuration.
 *
 * - `index.html` at the project root is the app entry; it loads
 *   `/frontend/src/main.ts`.
 * - The `test` block is consumed by Vitest. Tests run in a Node
 *   environment because the suites here exercise data, validators and
 *   security invariants (no DOM required).
 */
export default defineConfig({
  appType: 'spa',
  build: {
    outDir: 'dist',
    target: 'es2022',
    sourcemap: true,
  },
  server: {
    port: 5173,
  },
  preview: {
    port: 4173,
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    reporters: 'default',
  },
});
