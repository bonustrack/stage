import { defineConfig } from '@stage-labs/config';

export default defineConfig({
  workspaces: {
    '.': {
      type: 'library',
      knip: { kind: 'scripts', entry: ['stage.config.js', 'scripts/**/*.{mjs,js,sh}'], project: ['scripts/**/*.{mjs,js}'] },
    },
    'apps/stage': {
      type: 'react-native',
      knip: {
        entry: [
          'app/**/*.{ts,tsx}',
          'babel.config.js',
          'fingerprint.config.js',
          'lib/**/*.web.{ts,tsx}',
          'lib/**/*.ios.{ts,tsx}',
          'components/**/*.web.{ts,tsx}',
          'components/**/*.ios.{ts,tsx}',
          'modules/*/index.ts',
          'platform/**/*.ts',
          'plugins/**/*.{js,ts}',
          'scripts/**/*.js',
          'extension/background.js',
          'extension/asyncRequire.js',
          'extension/package.mjs',
          'extension/build.mjs',
        ],
        project: ['app/**', 'components/**', 'lib/**', 'modules/**', 'platform/**'],
        ignoreDependencies: ['buffer', 'events', 'babel-preset-expo', 'expo-system-ui', '@types/markdown-it'],
      },
    },
    'apps/proxy': { type: 'worker', knip: { entry: [] } },
    'apps/dispatch': { type: 'worker', knip: { entry: [] } },
    'apps/stage/desktop': { type: 'library', knip: { entry: ['src/preload.ts', 'scripts/*.mjs'], ignoreBinaries: ['codesign'] } },
    'packages/client': { type: 'library', knip: { entry: [], includeEntryExports: true } },
    'packages/kit': {
      type: 'library',
      knip: { entry: ['stories/*.stories.tsx', 'src/**/*.native.ts'], project: ['src/**', 'stories/**', 'gallery/**'] },
    },
    'packages/config': { type: 'library', knip: { entry: ['knip/*.js', 'oxlint/*.js', 'bin/*.js'], project: ['**/*.js'] } },
  },
});
