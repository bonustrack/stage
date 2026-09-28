const path = require('node:path');
const compilerSources = require('./react-compiler-sources.cjs');

module.exports = function (api) {
  api.cache(true);
  return {
    presets: [['babel-preset-expo', {
      unstable_transformImportMeta: true,
      'react-compiler': {
        sources: (filename) => compilerSources.includes(path.relative(__dirname, filename).split(path.sep).join('/')),
      },
    }]],
    plugins: ['react-native-worklets/plugin'],
  };
};
