/* eslint-env node */
/**
 * Extends Expo's Metro config to accept `.woff2` as a bundled asset — the
 * Calibre fonts under assets/fonts/ are woff2. Without this, the bundler
 * raises "UnableToResolveError" when expo-font requires them.
 */
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
if (!config.resolver.assetExts.includes('woff2')) {
  config.resolver.assetExts.push('woff2');
}

module.exports = config;
