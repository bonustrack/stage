const TYPES = ['vue', 'react-native', 'worker', 'library'];

function normalizeWorkspace(path, raw) {
  if (!raw || typeof raw !== 'object') {
    throw new Error(`defineConfig: workspace "${path}" must be an object with a "type".`);
  }
  const { type, knip = {}, eslint = {}, src, vue = false } = raw;
  if (!TYPES.includes(type)) {
    throw new Error(`defineConfig: workspace "${path}" has invalid type "${String(type)}". Expected one of ${TYPES.join(', ')}.`);
  }
  if (src !== undefined && !Array.isArray(src)) {
    throw new Error(`defineConfig: workspace "${path}" "src" must be an array of globs.`);
  }
  return Object.freeze({
    type,
    knip: knip ?? {},
    eslint: eslint ?? {},
    src: src ?? null,
    vue: Boolean(vue) || type === 'vue',
  });
}

function resolveWorkspaces(config) {
  if (config.workspaces && typeof config.workspaces === 'object') {
    return config.workspaces;
  }
  if (config.root && typeof config.root === 'object') {
    return { '.': config.root };
  }
  if (TYPES.includes(config.type)) {
    const { workspaces: _w, eslint: _e, madge: _m, knip: _k, ...ws } = config;
    return { '.': ws };
  }
  throw new Error('defineConfig: missing "workspaces". Provide a workspaces map, a "root" workspace, or a top-level single-package shorthand with a "type".');
}

export function defineConfig(config) {
  if (!config || typeof config !== 'object') {
    throw new Error('defineConfig: expected a config object.');
  }
  const rawWorkspaces = resolveWorkspaces(config);
  const entries = Object.entries(rawWorkspaces);
  if (entries.length === 0) {
    throw new Error('defineConfig: "workspaces" must declare at least one workspace.');
  }
  const workspaces = {};
  for (const [path, raw] of entries) {
    workspaces[path] = normalizeWorkspace(path, raw);
  }
  return Object.freeze({
    workspaces: Object.freeze(workspaces),
    eslint: config.eslint ?? {},
    madge: config.madge ?? {},
    knip: config.knip ?? {},
  });
}
