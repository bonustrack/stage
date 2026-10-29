const base = {
  $schema: 'https://unpkg.com/knip@6/schema.json',
  ignoreExportsUsedInFile: true,
  ignoreBinaries: ['check'],
};

const preset = (defaultEntry, defaultProject) => ({ entry = [...defaultEntry], project = [...defaultProject], ...rest } = {}) => ({
  entry,
  project,
  ...rest,
});

const library = preset(['src/**/*.ts'], ['src/**']);
const rnApp = preset(['app/**/*.{ts,tsx}'], ['app/**', 'components/**', 'lib/**', 'modules/**']);
const cloudflareWorker = preset(['src/index.ts'], ['src/**']);
const scriptsWorkspace = preset(['scripts/**/*.{mjs,js,sh}'], ['scripts/**/*.{mjs,js}']);

const workspaces = (map) => ({ ...base, workspaces: map });

const single = (opts) => ({ ...base, ...library(opts) });

const KNIP_HELPERS = {
  library,
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

export { base, library, rnApp, cloudflareWorker, scriptsWorkspace, workspaces, single, buildKnipConfig };
