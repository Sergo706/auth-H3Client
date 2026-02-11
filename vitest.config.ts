import { defineConfig } from 'vitest/config'
import path from 'path'
import 'dotenv/config';

export default defineConfig(async () => ({
  test: {
    coverage: {
      enabled: true,
      reporter: ['html'],
      cleanOnRerun: true,
      include: ['packages/client-h3v2/src/**', 'packages/client-h3v1/src/**', 'packages/client/composables/**', 'packages/client/server/**', 'packages/client/utils/**'],
    },
    projects: [
      {
        resolve: {
          alias: {
            '~~/': path.resolve(__dirname, './') + '/',
            '~~': path.resolve(__dirname, './'),
            '~/': path.resolve(__dirname, './') + '/',
            '~': path.resolve(__dirname, './'),
            '@internal/shared': path.resolve(__dirname, './packages/shared/src/index.ts'),
            'auth-h3client/v1': path.resolve(__dirname, './packages/client-h3v1/src/main.ts'),
            'auth-h3client/v2': path.resolve(__dirname, './packages/client-h3v2/src/main.ts'),
            'auth-h3client/client': path.resolve(__dirname, './packages/client/main.ts'),
          },
        },
        test: {
          name: 'integration',
          include: ['test/integration/**/*.{test,spec}.ts'],
          environment: 'node',
          setupFiles: ['test/integration/setup.ts'],
          globalSetup: ['./test/globalSetup.ts'],
          hookTimeout: 60000 * 25,
          fileParallelism: false,
          maxConcurrency: 2,
        },
      },
      {
        resolve: {
          alias: {
            '~~/': path.resolve(__dirname, './') + '/',
            '~~': path.resolve(__dirname, './'),
            '~/': path.resolve(__dirname, './') + '/',
            '~': path.resolve(__dirname, './'),
            '@internal/shared': path.resolve(__dirname, './packages/shared/src/index.ts'),
            'auth-h3client/v1': path.resolve(__dirname, './packages/client-h3v1/src/main.ts'),
            'auth-h3client/v2': path.resolve(__dirname, './packages/client-h3v2/src/main.ts'),
            'auth-h3client/client': path.resolve(__dirname, './packages/client/main.ts'),
          },
        },
        test: {
          name: 'units',
          include: ['test/units/**/*.{test,spec}.ts'],
          setupFiles: ['test/units/setup.ts'],
          environment: 'node',
        },
      },
    ],
  },
}))
