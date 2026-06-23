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

export { base, library, vueApp, rnApp, cloudflareWorker, scriptsWorkspace, workspaces, single };
