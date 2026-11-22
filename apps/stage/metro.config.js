const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '..', '..');

const config = getDefaultConfig(projectRoot);
config.resolver.assetExts = [...config.resolver.assetExts, 'woff2'];
config.watchFolders = [...(config.watchFolders ?? []), workspaceRoot];
config.resolver.nodeModulesPaths = [path.resolve(projectRoot, 'node_modules'), path.resolve(workspaceRoot, 'node_modules')];

const desktopShellBlock = /[/\\]apps[/\\]stage[/\\]desktop[/\\].*/;
config.resolver.blockList = config.resolver.blockList ? [].concat(config.resolver.blockList, desktopShellBlock) : desktopShellBlock;

const nodeCorePolyfills = { buffer: 'buffer', events: 'events' };

config.resolver.extraNodeModules = {
  ...(config.resolver.extraNodeModules ?? {}),
  react: path.dirname(require.resolve('react/package.json')),
  'react-native': path.dirname(require.resolve('react-native/package.json')),
  'react-native-svg': path.dirname(require.resolve('react-native-svg/package.json')),
  ...Object.fromEntries(Object.entries(nodeCorePolyfills).map(([name, target]) => [name, require.resolve(target)])),
};

const isInstalled = (name) => {
  try {
    require.resolve(`${name}/package.json`, { paths: [projectRoot] });
    return true;
  } catch {
    return false;
  }
};
const privyOptionalPeers = ['permissionless', 'expo-apple-authentication'].filter((name) => !isInstalled(name));
const isPrivyOptionalPeer = (name) => privyOptionalPeers.some((peer) => name === peer || name.startsWith(`${peer}/`));
const resolveWith = (context, moduleName, platform, overrides) => {
  const scoped = { ...context, ...overrides };
  return scoped.resolveRequest(scoped, moduleName, platform);
};
const upstreamResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (isPrivyOptionalPeer(moduleName)) return { type: 'empty' };
  if (platform !== 'web' && moduleName === 'jose') {
    return resolveWith(context, moduleName, platform, { unstable_conditionNames: ['browser'] });
  }
  if (platform !== 'web' && (moduleName === 'zustand' || moduleName.startsWith('zustand/'))) {
    return resolveWith(context, moduleName, platform, { unstable_enablePackageExports: false });
  }
  return (upstreamResolveRequest ?? context.resolveRequest)(context, moduleName, platform);
};

const expoTransformOptions = config.transformer.getTransformOptions;
config.transformer.getTransformOptions = async (entryPoints, options, getDependenciesOf) => {
  const base = await expoTransformOptions(entryPoints, options, getDependenciesOf);
  return { ...base, transform: { ...base.transform, inlineRequires: options.platform !== 'web' } };
};

if (process.env.STAGE_EXTENSION === '1') {
  config.transformer.asyncRequireModulePath = require.resolve('./extension/asyncRequire');
}

module.exports = config;
