import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    include: ['src/__tests__/**/*.test.ts', 'tests/**/*.test.ts'],
    setupFiles: ['src/__tests__/setup.ts'],
    environment: 'node',
    testTimeout: 30000,
    hookTimeout: 30000,
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: false,
      },
    },
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/__tests__/**', 'src/index.ts'],
    },
  },
});
