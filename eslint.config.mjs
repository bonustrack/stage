import { fileURLToPath } from 'node:url';
import tseslint from 'typescript-eslint';
import { ignores as baseIgnores, recommended, strictTsBlock, typeCheckedLanguageOptions, commentPlugins, COMMENT_RULES, QUOTES } from '@stage-labs/config/eslint/base';
import { reactNative } from './apps/app/eslint.mjs';
import { kitEslint } from './packages/kit/eslint.js';

const ROOT_DIR = fileURLToPath(new URL('.', import.meta.url));

function typeAwareBlock(dir, project, extraFiles = []) {
  return {
    files: [`${dir}/**/*.{ts,tsx}`, ...extraFiles],
    languageOptions: typeCheckedLanguageOptions(ROOT_DIR, project),
  };
}

function prefixGlob(dir, glob) {
  if (glob.startsWith('!')) return '!' + prefixGlob(dir, glob.slice(1));
  return `${dir}/${glob}`;
}

function scopeBlock(dir, block) {
  const out = { ...block };
  if (Array.isArray(block.ignores)) {
    out.ignores = block.ignores.map((g) => prefixGlob(dir, g));
  }
  if (Array.isArray(block.files)) {
    out.files = block.files.map((g) => prefixGlob(dir, g));
  } else if (!Array.isArray(block.ignores)) {
    out.files = [`${dir}/**/*.{ts,tsx,mts,cts,js,jsx,mjs,cjs,vue}`];
  }
  return out;
}

function scopePreset(dir, preset) {
  return preset.map((block) => scopeBlock(dir, block));
}

async function loadVueToolchain() {
  const [{ vue: vuePreset }, vueParser, vuePlugin] = await Promise.all([
    import('@stage-labs/config/eslint/vue'),
    import('vue-eslint-parser').then((m) => m.default ?? m),
    import('eslint-plugin-vue').then((m) => m.default ?? m),
  ]);
  return { vuePreset, vueParser, vuePlugin };
}

async function buildConfig({ vue = true } = {}) {
  const vueToolchain = vue ? await loadVueToolchain() : null;
  const kitVueOptions = vueToolchain
    ? { vueParser: vueToolchain.vueParser, vuePlugin: vueToolchain.vuePlugin, rootDir: ROOT_DIR, project: 'packages/kit/tsconfig.json' }
    : undefined;

  const config = [
    { ignores: ['**/node_modules/**', '**/dist/**', '**/.expo/**', '**/.vite/**'] },

    typeAwareBlock('apps/app', 'apps/app/tsconfig.eslint.json'),
    ...scopePreset('apps/app', reactNative()),
    typeAwareBlock('packages/kit', 'packages/kit/tsconfig.json'),
    ...scopePreset('packages/kit', kitEslint(kitVueOptions)),

    typeAwareBlock('apps/proxy', 'apps/proxy/tsconfig.eslint.json'),
    ...scopePreset('apps/proxy', [baseIgnores(), ...recommended, strictTsBlock({ tsconfigRootDir: ROOT_DIR, project: 'apps/proxy/tsconfig.eslint.json' })]),
    typeAwareBlock('packages/client', 'packages/client/tsconfig.eslint.json'),
    ...scopePreset('packages/client', [baseIgnores(), ...recommended, strictTsBlock({ tsconfigRootDir: ROOT_DIR, project: 'packages/client/tsconfig.eslint.json' })]),

  ];

  if (vueToolchain) {
    const { vuePreset, vueParser, vuePlugin } = vueToolchain;
    config.push(typeAwareBlock('apps/ui', 'apps/ui/tsconfig.json'));
    config.push(...scopePreset('apps/ui', vuePreset({ vueParser, vuePlugin, rootDir: ROOT_DIR, project: 'apps/ui/tsconfig.json' })));
  }

  config.push(
    { files: ['**/*.{js,jsx,cjs,mjs}'], ...tseslint.configs.disableTypeChecked },
    { files: ['**/*.config.{ts,mts,cts}'], ...tseslint.configs.disableTypeChecked },
  );

  config.push({
    files: ['**/*.{js,jsx,cjs,mjs}'],
    plugins: commentPlugins,
    rules: { ...COMMENT_RULES },
  });

  config.push({
    files: ['**/*.{js,jsx,cjs,mjs}'],
    rules: { quotes: QUOTES },
  });

  return config;
}

export default await buildConfig();
