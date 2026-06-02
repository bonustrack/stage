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
// Leave serverRoot at its default (the workspace root — the common ancestor of
// projectRoot + watchFolders). The dev client on device resolves the app entry
// through bun's .bun store symlink, requesting it as
// /node_modules/.bun/expo-router@<hash>/node_modules/expo-router/entry.bundle —
// a path rooted at the WORKSPACE root. Pinning serverRoot to the app dir puts that
// .bun path outside serverRoot and 404s with UnableToResolveError. The workspace
// packages still resolve via watchFolders + nodeModulesPaths.
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// EXCLUDE the embedded-Node host from the Metro bundle. nodejs-assets/nodejs-
// project/ runs the RAILGUN engine + Groth16 prover INSIDE nodejs-mobile-react-
// native (a real Node runtime), not in Hermes — see lib/railgun/bridge/. Those
// files are node-only (require('rn-bridge'), node-core, an N-API prover) and
// must never be traversed/bundled by Metro; nodejs-mobile-react-native bundles
// them into the native binary at build time instead. Mirrors RAILGUN Railway-
// Wallet's metro blacklist of /nodejs-assets/ + /nodejs-src/.
const nodejsHostBlock = /[/\\]nodejs-assets[/\\].*/;
config.resolver.blockList = config.resolver.blockList
  ? [].concat(config.resolver.blockList, nodejsHostBlock)
  : nodejsHostBlock;

// Single instance of the React/RN runtime for every package (incl. @metro-labs/kit).
const appNodeModules = path.resolve(projectRoot, 'node_modules');

// node-core polyfills for the RAILGUN SDK (@railgun-community/wallet + ethers +
// axios). The Railgun graph pulls in axios's NODE build (dist/node/axios.cjs ->
// url/http/https/stream/zlib) and ethers' commonjs node files (crypto/net/http),
// none of which exist on React Native. Map every reachable node-core name to a
// pure-JS browser polyfill (all JS shims — NO new native deps), and to an empty
// module for the socket/fs/compression internals whose RN/browser code paths
// never actually run. `buffer` reuses the shim the app already uses for
// viem/XMTP; `crypto` falls to crypto-browserify (the global getRandomValues
// shim in lib/cryptoShim.ts still backs the platform RNG separately).
const emptyShim = path.resolve(projectRoot, 'metro.shims', 'empty.js');
const nodeCorePolyfills = {
  url: 'react-native-url-polyfill',
  stream: 'stream-browserify',
  crypto: 'crypto-browserify',
  buffer: 'buffer',
  events: 'events',
  process: 'process',
  util: 'util',
  assert: 'assert',
  path: 'path-browserify',
  punycode: 'punycode',
  querystring: 'querystring-es3',
  string_decoder: 'string_decoder',
};
const emptyShimNames = [
  'http',
  'https',
  'zlib',
  'net',
  'tls',
  'fs',
  'dns',
  'child_process',
  'os',
  'vm',
];

config.resolver.extraNodeModules = {
  ...(config.resolver.extraNodeModules ?? {}),
  react: path.join(appNodeModules, 'react'),
  'react-native': path.join(appNodeModules, 'react-native'),
  'react-native-svg': path.join(appNodeModules, 'react-native-svg'),
  ...Object.fromEntries(
    Object.entries(nodeCorePolyfills).map(([name, target]) => [
      name,
      require.resolve(target),
    ]),
  ),
  ...Object.fromEntries(emptyShimNames.map((name) => [name, emptyShim])),
};

// Force axios to its BROWSER build (XHR adapter) instead of dist/node/axios.cjs,
// which requires url/http/https/form-data/proxy-from-env. The browser bundle
// uses XMLHttpRequest (which RN provides) and pulls in no node-core. axios is a
// transitive dep of the Railgun SDK (not a direct app dep), so we let Metro
// resolve it normally and then rewrite the resolved file to the browser build
// that sits alongside it in the same package — no hard-coded bun-store hash.
const upstreamResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const resolved = upstreamResolveRequest
    ? upstreamResolveRequest(context, moduleName, platform)
    : context.resolveRequest(context, moduleName, platform);
  if (
    moduleName === 'axios' &&
    resolved &&
    resolved.type === 'sourceFile' &&
    resolved.filePath.includes(`${path.sep}axios${path.sep}`)
  ) {
    const pkgDir = resolved.filePath.split(
      `${path.sep}dist${path.sep}`,
    )[0];
    const browser = path.join(pkgDir, 'dist', 'browser', 'axios.cjs');
    return { ...resolved, filePath: browser };
  }
  return resolved;
};

module.exports = config;
