import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Use the src/__tests__ directory for test files
    include: ['src/__tests__/**/*.test.ts'],

    // Global setup/teardown
    setupFiles: ['src/__tests__/setup.ts'],

    // Environment: node (default for backend)
    environment: 'node',

    // Timeouts: generous for Fastify app startup/teardown
    testTimeout: 10_000,
    hookTimeout: 10_000,

    // Run tests sequentially within a file (routes share app state)
    // but files in parallel for speed
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: false,
      },
    },

    // Coverage configuration (run with --coverage flag)
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/__tests__/**', 'src/index.ts'],
    },
  },
});
