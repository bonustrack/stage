/** Babel — Expo preset + Worklets plugin (required by react-native-reanimated v4).
 *  `unstable_transformImportMeta` rewrites `import.meta` (used by zustand@5, pulled
 *  in via Reown AppKit/wagmi) so it runs under Hermes, which has no native support. */
module.exports = function (api) {
  api.cache(true);
  return {
    presets: [['babel-preset-expo', { unstable_transformImportMeta: true }]],
    plugins: ['react-native-worklets/plugin'],
  };
};
