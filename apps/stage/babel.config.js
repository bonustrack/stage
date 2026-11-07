const path = require('node:path');
const { readFileSync } = require('node:fs');

const APP_DIR = path.relative(path.join(__dirname, '../..'), __dirname).split(path.sep).join('/');
const REACT_COMPILER_RULE = 'react/rules-of-hooks';

function reactCompilerSources() {
  const lint = JSON.parse(readFileSync(path.join(__dirname, '../../.oxlintrc.json'), 'utf8'));
  const override = lint.overrides.find((entry) => entry.rules && REACT_COMPILER_RULE in entry.rules);
  if (!override) throw new Error(`.oxlintrc.json has no override with ${REACT_COMPILER_RULE}: it lists the React Compiler files.`);
  return override.files.map((file) => path.posix.relative(APP_DIR, file));
}

const compilerSources = reactCompilerSources();

module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      [
        'babel-preset-expo',
        {
          unstable_transformImportMeta: true,
          'react-compiler': {
            sources: (filename) => compilerSources.includes(path.relative(__dirname, filename).split(path.sep).join('/')),
          },
        },
      ],
    ],
    plugins: ['react-native-worklets/plugin'],
  };
};
