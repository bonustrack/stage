/* eslint-env node */
/**
 * Extends Expo's Metro config:
 * - accept `.woff2` as a bundled asset (Calibre fonts under assets/fonts/)
 * - watch the sibling apps/_shared/ folder so the shared icon module resolves
 */
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
if (!config.resolver.assetExts.includes('woff2')) {
  config.resolver.assetExts.push('woff2');
}
const sharedDir = path.resolve(__dirname, '..', '_shared');
config.watchFolders = [...(config.watchFolders ?? []), sharedDir];

module.exports = config;
