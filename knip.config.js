/** @file Root knip config: stage's per-workspace entry/project globs and ignore-dependency lists for the BLOCKING CI dead-code check (workspace topology is stage-specific, so it lives here, not in @stage-labs/config). */
const knipConfig = {
  $schema: 'https://unpkg.com/knip@6/schema.json',
  ignoreExportsUsedInFile: true,
  workspaces: {
    '.': {
      entry: ['scripts/**/*.{mjs,js,sh}'],
      project: ['scripts/**/*.{mjs,js}'],
    },
    'apps/app': {
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
    'apps/ui': {
      entry: ['index.html'],
      project: ['src/**'],
      vite: true,
      vue: true,
    },
    'packages/client': {
      entry: ['src/**/*.ts'],
      project: ['src/**'],
    },
    'packages/kit': {
      entry: ['eslint.js'],
      project: ['src/**'],
    },
    'packages/config': {
      entry: ['eslint/*.js'],
      project: ['**/*.js'],
    },
  },
};

export default knipConfig;
