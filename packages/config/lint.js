import tseslint from 'typescript-eslint';
import {
  ignores as baseIgnores,
  recommended,
  strictTsBlock,
  typeCheckedLanguageOptions,
  commentPlugins,
  COMMENT_RULES,
  QUOTES,
} from './eslint/base.js';

function prefixGlob(dir, glob) {
  if (dir === '.') return glob;
  if (glob.startsWith('!')) return '!' + prefixGlob(dir, glob.slice(1));
  return `${dir}/${glob}`;
}

function scopeBlock(dir, block) {
  if (dir === '.') return { ...block };
  const out = { ...block };
  if (Array.isArray(block.ignores)) {
    out.ignores = block.ignores.map((g) => prefixGlob(dir, g));
  }
  if (Array.isArray(block.files)) {
    out.files = block.files.map((g) => prefixGlob(dir, g));
  }
  return out;
}

function scopePreset(dir, preset) {
  return preset.map((block) => scopeBlock(dir, block));
}

async function loadVueToolchain() {
  const [{ vue: vuePreset }, vueParser, vuePlugin] = await Promise.all([
    import('./eslint/vue.js'),
    import('vue-eslint-parser').then((m) => m.default ?? m),
    import('eslint-plugin-vue').then((m) => m.default ?? m),
  ]);
  return { vuePreset, vueParser, vuePlugin };
}

function libraryPreset(rootDir, files) {
  return [
    baseIgnores(),
    { files, languageOptions: typeCheckedLanguageOptions(rootDir) },
    ...recommended,
    strictTsBlock({ files, tsconfigRootDir: rootDir }),
  ];
}

async function presetFor(workspace, rootDir, vueToolchain) {
  const files = workspace.src ?? ['src/**/*.{ts,tsx}'];
  if (workspace.type === 'vue') {
    const tc = vueToolchain ?? (await loadVueToolchain());
    return tc.vuePreset({ vueParser: tc.vueParser, vuePlugin: tc.vuePlugin, rootDir });
  }
  return libraryPreset(rootDir, files);
}

export async function buildLintConfig(stageConfig, cwd) {
  const rootDir = cwd ?? process.cwd();
  const entries = Object.entries(stageConfig.workspaces);
  const needsVue = entries.some(([, w]) => w.type === 'vue');
  const vueToolchain = needsVue ? await loadVueToolchain() : null;

  const config = [{ ignores: ['**/node_modules/**', '**/dist/**', '**/.expo/**', '**/.vite/**'] }];

  const repoEslint = stageConfig.eslint ?? {};
  if (Array.isArray(repoEslint.ignores) && repoEslint.ignores.length > 0) {
    config.push({ ignores: repoEslint.ignores });
  }

  for (const [path, workspace] of entries) {
    const preset = await presetFor(workspace, rootDir, vueToolchain);
    config.push(...scopePreset(path, preset));
  }

  if (Array.isArray(repoEslint.extends)) {
    config.push(...repoEslint.extends);
  }

  config.push(
    { files: ['**/*.{js,jsx,cjs,mjs}'], ...tseslint.configs.disableTypeChecked },
    { files: ['**/*.config.{ts,mts,cts}'], ...tseslint.configs.disableTypeChecked },
  );
  config.push({ files: ['**/*.{js,jsx,cjs,mjs}'], plugins: commentPlugins, rules: { ...COMMENT_RULES } });
  config.push({ files: ['**/*.{js,jsx,cjs,mjs}'], rules: { quotes: QUOTES } });

  if (repoEslint.rules && typeof repoEslint.rules === 'object') {
    config.push({ rules: repoEslint.rules });
  }

  return config;
}
