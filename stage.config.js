import { defineConfig } from '@stage-labs/config';

export default defineConfig({
  workspaces: {
    '.': {
      type: 'library',
      knip: {
        kind: 'scripts',
        entry: ['stage.config.js', 'scripts/**/*.{mjs,js,sh}'],
        project: ['scripts/**/*.{mjs,js}'],
      },
    },
    'apps/stage': {
      type: 'react-native',
      knip: {
        entry: [
          'app/**/*.{ts,tsx}',
          'babel.config.js',
          'fingerprint.config.js',
          'lib/**/*.web.{ts,tsx}',
          'lib/xmtp.stripGuard.ts',
          'components/**/*.web.{ts,tsx}',
          'modules/**/*.{ts,tsx}',
          'platform/**/*.ts',
          'plugins/**/*.{js,ts}',
          'scripts/**/*.js',
        ],
        project: ['app/**', 'components/**', 'lib/**', 'modules/**', 'platform/**'],
        ignoreDependencies: [
          'buffer',
          'events',
          'babel-preset-expo',
          'expo-system-ui',
          '@types/markdown-it',
        ],
      },
    },
    'apps/proxy': {
      type: 'worker',
      knip: { entry: ['src/**/*.ts'] },
    },
    'apps/stage/desktop': {
      type: 'library',
      knip: { entry: ['src/preload.ts', 'scripts/*.mjs'], ignoreBinaries: ['codesign'] },
    },
    'packages/client': {
      type: 'library',
      knip: { entry: ['src/**/*.ts'] },
    },
    'packages/kit': {
      type: 'library',
      knip: {
        entry: ['stories/*.stories.tsx'],
        project: ['src/**', 'stories/**', 'gallery/**'],
        ignoreDependencies: ['react-native-web'],
      },
    },
    'packages/config': {
      type: 'library',
      knip: {
        entry: ['eslint/*.js', 'knip/*.js', 'oxlint/*.js', 'bin/*.js'],
        project: ['**/*.js'],
        ignoreDependencies: ['madge', 'eslint-plugin-vue', 'vue-eslint-parser'],
      },
    },
  },
  madge: {
    roots: [
      'apps/stage/desktop/src',
      'apps/stage/app',
      'apps/stage/components',
      'apps/stage/lib',
      'apps/stage/modules',
      'apps/stage/platform',
      'apps/proxy/src',
      'packages/client/src',
      'packages/config',
      'packages/kit/src',
    ],
  },
});
