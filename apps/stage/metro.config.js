const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '..', '..');

const config = getDefaultConfig(projectRoot);
config.watchFolders = [...(config.watchFolders ?? []), workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

const desktopShellBlock = /[/\\]apps[/\\]stage[/\\]desktop[/\\].*/;
config.resolver.blockList = config.resolver.blockList
  ? [].concat(config.resolver.blockList, desktopShellBlock)
  : desktopShellBlock;

const appNodeModules = path.resolve(projectRoot, 'node_modules');

const nodeCorePolyfills = {
  buffer: 'buffer',
  events: 'events',
};

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
};

module.exports = config;
