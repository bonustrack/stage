/**
 * Extends Expo's Metro config for the bun monorepo:
 * - accept `.woff2` as a bundled asset (Calibre fonts under assets/fonts/)
 * - watch the repo root so the workspace packages (@metro-labs/client,
 *   @metro-labs/kit under ../../packages/*) resolve and hot-reload
 * - resolve modules from both the app-local and the hoisted root node_modules
 * - pin react / react-native / react-native-svg to the app's SINGLE copy so the
 *   @metro-labs/kit RN components (button/text/title/icon) resolve them without
 *   relying on a manual symlink in packages/kit/node_modules. The kit declares
 *   these as `*` peerDependencies; bun stores them under node_modules/.bun/ and
 *   does NOT expose them on a path the kit can reach, so icon.tsx's
 *   `react-native-svg` import would otherwise fail to resolve on device (and a
 *   stray duplicate would risk a second React instance). extraNodeModules gives
 *   every importer the same instance.
 */
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '..', '..');

const config = getDefaultConfig(projectRoot);
if (!config.resolver.assetExts.includes('woff2')) {
  config.resolver.assetExts.push('woff2');
}
config.watchFolders = [...(config.watchFolders ?? []), workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// Single instance of the React/RN runtime for every package (incl. @metro-labs/kit).
const appNodeModules = path.resolve(projectRoot, 'node_modules');
config.resolver.extraNodeModules = {
  ...(config.resolver.extraNodeModules ?? {}),
  react: path.join(appNodeModules, 'react'),
  'react-native': path.join(appNodeModules, 'react-native'),
  'react-native-svg': path.join(appNodeModules, 'react-native-svg'),
};

module.exports = config;
