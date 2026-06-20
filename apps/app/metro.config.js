/** @file Expo Metro config for the bun monorepo: workspace watch, node-core polyfills, axios browser build. */

/** Polyfill Array.prototype.toReversed for Node 18 (metro-config 0.83 calls it during loadConfig). */
if (!Array.prototype.toReversed) {
  Object.defineProperty(Array.prototype, 'toReversed', { value: function () { return [...this].reverse(); }, writable: true, configurable: true });
}

/** Extend Expo Metro for the bun monorepo: watch root, dual node_modules, pin a single react/react-native/svg copy. */
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '..', '..');

const config = getDefaultConfig(projectRoot);
config.watchFolders = [...(config.watchFolders ?? []), workspaceRoot];
/** Keep serverRoot at the workspace root so bun's .bun store symlink path resolves instead of 404ing. */
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

/** Block the embedded-Node host (nodejs-assets) from Metro; nodejs-mobile bundles it natively instead. */
const nodejsHostBlock = /[/\\]nodejs-assets[/\\].*/;
config.resolver.blockList = config.resolver.blockList
  ? [].concat(config.resolver.blockList, nodejsHostBlock)
  : nodejsHostBlock;

/** Single instance of the React/RN runtime for every package (incl. @metro-labs/kit). */
const appNodeModules = path.resolve(projectRoot, 'node_modules');

/** Map node-core names to pure-JS browser polyfills (or an empty shim) for the RAILGUN SDK on RN. */
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

/** Rewrite resolved axios to its browser build (XHR adapter) so it pulls in no node-core. */
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

if (process.env.RG_BLOCK_WORKTREES) {
  config.resolver.blockList = [/\.claude\/worktrees\/(?!agent-a3a263f507bde95a6)/];
}

module.exports = config;
