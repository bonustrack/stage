const base = {
  $schema: 'https://unpkg.com/knip@6/schema.json',
  ignoreExportsUsedInFile: true,
};

const library = ({ entry = ['src/**/*.ts'], project = ['src/**'], ...rest } = {}) => ({
  entry,
  project,
  ...rest,
});

const vueApp = ({ entry = ['index.html'], project = ['src/**'], vite = true, vue = true, ...rest } = {}) => ({
  entry,
  project,
  vite,
  vue,
  ...rest,
});

const rnApp = ({
  entry = ['app/**/*.{ts,tsx}'],
  project = ['app/**', 'components/**', 'lib/**', 'modules/**'],
  ...rest
} = {}) => ({
  entry,
  project,
  ...rest,
});

const cloudflareWorker = ({ entry = ['src/index.ts'], project = ['src/**'], ...rest } = {}) => ({
  entry,
  project,
  ...rest,
});

const scriptsWorkspace = ({
  entry = ['scripts/**/*.{mjs,js,sh}'],
  project = ['scripts/**/*.{mjs,js}'],
  ...rest
} = {}) => ({
  entry,
  project,
  ...rest,
});

const workspaces = (map) => ({ ...base, workspaces: map });

const single = (opts) => ({ ...base, ...library(opts) });

const KNIP_HELPERS = {
  library,
  vue: vueApp,
  'react-native': rnApp,
  worker: cloudflareWorker,
  scripts: scriptsWorkspace,
};

const buildKnipConfig = (stageConfig) => {
  const map = {};
  for (const [path, workspace] of Object.entries(stageConfig.workspaces)) {
    const overrides = workspace.knip ?? {};
    const kind = overrides.kind ?? workspace.type;
    const helper = KNIP_HELPERS[kind] ?? library;
    const { kind: _kind, ...opts } = overrides;
    map[path] = helper(opts);
  }
  const repoKnip = stageConfig.knip ?? {};
  return { ...base, ...repoKnip, workspaces: map };
};

export { base, library, vueApp, rnApp, cloudflareWorker, scriptsWorkspace, workspaces, single, buildKnipConfig };
