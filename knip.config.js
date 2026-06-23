import { workspaces, scriptsWorkspace, rnApp, vueApp, cloudflareWorker, library } from '@stage-labs/config/knip';

export default workspaces({
  '.': scriptsWorkspace(),
  'apps/app': rnApp({
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
  }),
  'apps/ui': vueApp(),
  'apps/proxy': cloudflareWorker({ entry: ['src/**/*.ts'] }),
  'packages/client': library({ entry: ['src/**/*.ts'] }),
  'packages/kit': library({ entry: ['eslint.js'], vue: true }),
  'packages/config': library({
    entry: ['eslint/*.js', 'knip/*.js', 'bin/*.js'],
    project: ['**/*.js'],
    ignoreDependencies: ['madge'],
  }),
});
