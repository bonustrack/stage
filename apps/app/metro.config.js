/* eslint-env node */
/**
 * Extends Expo's Metro config for the bun monorepo:
 * - accept `.woff2` as a bundled asset (Calibre fonts under assets/fonts/)
 * - watch the repo root so the workspace packages (@stage-labs/metro-client,
 *   @stage-labs/metro-kit under ../../packages/*) resolve and hot-reload
 * - resolve modules from both the app-local and the hoisted root node_modules
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

module.exports = config;
