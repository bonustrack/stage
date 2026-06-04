/** Babel — Expo preset + Reanimated plugin (reanimated v3 bundles its worklet
 *  transform; the plugin MUST be last). `unstable_transformImportMeta` rewrites
 *  `import.meta` (used by zustand@5, pulled in via Reown AppKit/wagmi) so it runs
 *  under Hermes, which has no native support. */
module.exports = function (api) {
  api.cache(true);
  return {
    presets: [['babel-preset-expo', { unstable_transformImportMeta: true }]],
    plugins: ['react-native-reanimated/plugin'],
  };
};
