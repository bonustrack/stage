import { fileURLToPath } from 'node:url';
import { defineConfig } from '@stage-labs/config';
import { reactNative } from './apps/app/eslint.js';
import { kitEslint } from './packages/kit/eslint.js';
import { viewsEslint } from './packages/views/eslint.js';
import { uiKitOnly } from './apps/ui/eslint.js';

const ROOT_DIR = fileURLToPath(new URL('.', import.meta.url));

const vuePlugin = await import('eslint-plugin-vue').then((m) => m.default ?? m);
const vueParser = await import('vue-eslint-parser').then((m) => m.default ?? m);

const kitVueOptions = { vueParser, vuePlugin, rootDir: ROOT_DIR };

export default defineConfig({
  workspaces: {
    '.': {
      type: 'library',
      eslint: { preset: 'none' },
      knip: {
        kind: 'scripts',
        entry: ['scripts/**/*.{mjs,js,sh}'],
        project: ['scripts/**/*.{mjs,js}'],
      },
    },
    'apps/app': {
      type: 'react-native',
      eslint: { preset: 'none', extends: reactNative() },
      knip: {
        entry: [
          'eslint.js',
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
      eslint: { extends: uiKitOnly(vuePlugin) },
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
      eslint: { preset: 'none', extends: kitEslint(kitVueOptions) },
      knip: { entry: ['eslint.js'], vue: true },
    },
    'packages/views': {
      type: 'library',
      eslint: { preset: 'none', extends: viewsEslint() },
      knip: { entry: ['eslint.js', 'src/index.ts'] },
    },
    'packages/config': {
      type: 'library',
      eslint: { preset: 'none' },
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
      'packages/views/src',
    ],
  },
});
