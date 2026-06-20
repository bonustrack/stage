import tseslint from 'typescript-eslint';
import { ignores as baseIgnores, recommended, strictTsBlock, typeCheckedLanguageOptions, commentPlugins, COMMENT_RULES } from './base.js';

export function single({ tsconfigRootDir = process.cwd(), project, files = ['src/**/*.{ts,tsx}'], ignores = [] } = {}) {
  return [
    baseIgnores(ignores),
    { files, languageOptions: typeCheckedLanguageOptions(tsconfigRootDir, project) },
    ...recommended,
    strictTsBlock({ files, tsconfigRootDir, project }),
    { files: ['**/*.{js,jsx,cjs,mjs}'], ...tseslint.configs.disableTypeChecked },
    { files: ['**/*.config.{ts,mts,cts}'], ...tseslint.configs.disableTypeChecked },
    { files: ['**/*.{js,jsx,cjs,mjs}'], plugins: commentPlugins, rules: { ...COMMENT_RULES } },
  ];
}
