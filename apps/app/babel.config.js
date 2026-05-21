/** Babel — Expo preset + Worklets plugin (required by react-native-reanimated v4). */
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: ['react-native-worklets/plugin'],
  };
};
