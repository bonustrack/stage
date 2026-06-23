import { defineConfig } from '@stage-labs/config';

export default defineConfig({
  workspaces: {
    '.': {
      type: 'library',
      knip: {
        kind: 'scripts',
        entry: ['scripts/**/*.{mjs,js,sh}'],
        project: ['scripts/**/*.{mjs,js}'],
      },
    },
    'apps/app': {
      type: 'react-native',
      knip: {
        entry: [
          'eslint.mjs',
          'app/**/*.{ts,tsx}',
          'babel.config.js',
          'modules/**/*.{ts,tsx}',
          'plugins/**/*.{js,ts}',
          'scripts/**/*.js',
          'scripts/**/*.mjs',
        ],
        project: ['app/**', 'components/**', 'lib/**', 'modules/**'],
        ignoreDependencies: [
          'buffer',
          'crypto-browserify',
          'path-browserify',
          'querystring-es3',
          'react-native-url-polyfill',
          'readable-stream',
          'stream-browserify',
          'babel-preset-expo',
          'expo-system-ui',
          '@railgun-privacy/native-prover',
          'node-gyp-build-mobile',
        ],
      },
    },
    'apps/ui': {
      type: 'vue',
    },
    'apps/proxy': {
      type: 'worker',
      knip: { entry: ['src/**/*.ts'] },
    },
    'packages/client': {
      type: 'library',
      knip: { entry: ['src/**/*.ts'] },
    },
    'packages/kit': {
      type: 'library',
      vue: true,
      knip: { entry: ['eslint.js'], vue: true },
    },
    'packages/config': {
      type: 'library',
      knip: {
        entry: ['eslint/*.js', 'knip/*.js', 'bin/*.js'],
        project: ['**/*.js'],
        ignoreDependencies: ['madge'],
      },
    },
  },
  madge: {
    roots: [
      'apps/app/app',
      'apps/app/components',
      'apps/app/lib',
      'apps/app/modules',
      'apps/ui/src',
      'apps/proxy/src',
      'packages/client/src',
      'packages/config',
      'packages/kit/src',
    ],
  },
});
