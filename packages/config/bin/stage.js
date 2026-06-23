#!/usr/bin/env node
import { existsSync, mkdtempSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

const requireFromCwd = createRequire(join(process.cwd(), 'noop.js'));

function resolvePkg(specifier) {
  return pathToFileURL(requireFromCwd.resolve(specifier)).href;
}

const SUBS = ['lint', 'knip', 'madge', 'typecheck'];

function usage(message) {
  if (message) process.stderr.write(`${message}\n`);
  process.stderr.write(`usage: stage <${SUBS.join('|')}> [...args]\n`);
  process.exit(1);
}

const cwd = process.cwd();

function stageConfigPath() {
  const p = resolve(cwd, 'stage.config.js');
  if (!existsSync(p)) {
    process.stderr.write(`stage: no stage.config.js found in ${cwd}\n`);
    process.exit(1);
  }
  return p;
}

async function loadStageConfig() {
  const p = stageConfigPath();
  const mod = await import(pathToFileURL(p).href);
  return mod.default ?? mod.config ?? mod;
}

function localBin(name) {
  let dir = cwd;
  for (;;) {
    const candidate = resolve(dir, 'node_modules', '.bin', name);
    if (existsSync(candidate)) return candidate;
    const parent = resolve(dir, '..');
    if (parent === dir) break;
    dir = parent;
  }
  return name;
}

function run(bin, args) {
  const res = spawnSync(bin, args, { stdio: 'inherit', cwd });
  return res.status ?? 1;
}

function firstExisting(names) {
  for (const name of names) {
    if (existsSync(resolve(cwd, name))) return name;
  }
  return null;
}

function writeTemp(prefix, contents) {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  const file = join(dir, 'config.mjs');
  writeFileSync(file, contents);
  return file;
}

function configUrl() {
  return pathToFileURL(stageConfigPath()).href;
}

function cmdLint(argv) {
  const native = firstExisting(['eslint.config.js', 'eslint.config.mjs', 'eslint.config.cjs', 'eslint.config.ts']);
  if (native) {
    process.stderr.write(`stage lint: deferring to native ${native}\n`);
    return run(localBin('eslint'), ['.', ...argv]);
  }
  const temp = writeTemp('stage-lint-', [
    `import { buildLintConfig } from ${JSON.stringify(resolvePkg('@stage-labs/config/lint'))};`,
    `import cfg from ${JSON.stringify(configUrl())};`,
    `export default await buildLintConfig(cfg, ${JSON.stringify(cwd)});`,
    '',
  ].join('\n'));
  return run(localBin('eslint'), ['--config', temp, '.', ...argv]);
}

function cmdKnip(argv) {
  const native = firstExisting(['knip.config.js', 'knip.config.ts', 'knip.config.json', 'knip.json']);
  if (native) {
    process.stderr.write(`stage knip: deferring to native ${native}\n`);
    return run(localBin('knip'), [...argv]);
  }
  const temp = writeTemp('stage-knip-', [
    `import { buildKnipConfig } from ${JSON.stringify(resolvePkg('@stage-labs/config/knip'))};`,
    `import cfg from ${JSON.stringify(configUrl())};`,
    'export default buildKnipConfig(cfg);',
    '',
  ].join('\n'));
  return run(localBin('knip'), ['--config', temp, ...argv]);
}

function globToDir(glob) {
  const idx = glob.indexOf('*');
  let base = idx === -1 ? glob : glob.slice(0, idx);
  base = base.replace(/\/+$/, '');
  return base || '.';
}

async function cmdMadge(stageConfig, argv) {
  const { madgeConfig } = await import('@stage-labs/config/madge');
  const { default: madge } = await import('madge');
  let roots;
  if (argv.length > 0) {
    roots = argv;
  } else if (Array.isArray(stageConfig.madge?.roots) && stageConfig.madge.roots.length > 0) {
    roots = stageConfig.madge.roots;
  } else {
    roots = [];
    for (const [path, workspace] of Object.entries(stageConfig.workspaces)) {
      if (Array.isArray(workspace.src) && workspace.src.length > 0) {
        for (const g of workspace.src) roots.push(prefixed(path, globToDir(g)));
      } else {
        roots.push(path === '.' ? 'src' : `${path}/src`);
      }
    }
  }
  roots = roots.filter((r) => existsSync(resolve(cwd, r)));
  const res = await madge(roots, madgeConfig);
  const circular = res.circular();
  if (circular.length === 0) {
    process.stdout.write(`madge: no circular dependencies found across ${roots.length} source ${roots.length === 1 ? 'root' : 'roots'}.\n`);
    return 0;
  }
  process.stdout.write(`madge: ${circular.length} circular dependenc${circular.length === 1 ? 'y' : 'ies'} found:\n\n`);
  for (const cycle of circular) process.stdout.write('  ' + cycle.join(' -> ') + '\n');
  return 1;
}

function prefixed(path, dir) {
  if (path === '.') return dir;
  if (dir === '.') return path;
  return `${path}/${dir}`;
}

function cmdTypecheck(stageConfig, argv) {
  let failures = [];
  for (const [path, workspace] of Object.entries(stageConfig.workspaces)) {
    const project = path === '.' ? 'tsconfig.json' : `${path}/tsconfig.json`;
    if (!existsSync(resolve(cwd, project))) continue;
    const useVue = workspace.vue === true || workspace.type === 'vue';
    const bin = localBin(useVue ? 'vue-tsc' : 'tsc');
    process.stdout.write(`stage typecheck: ${path} (${useVue ? 'vue-tsc' : 'tsc'})\n`);
    const status = run(bin, ['--noEmit', '-p', project, ...argv]);
    if (status !== 0) failures.push(path);
  }
  if (failures.length > 0) {
    process.stderr.write(`stage typecheck: failed in ${failures.join(', ')}\n`);
    return 1;
  }
  return 0;
}

async function main() {
  const [sub, ...argv] = process.argv.slice(2);
  if (!sub || !SUBS.includes(sub)) {
    usage(sub ? `stage: unknown command "${sub}"` : null);
  }
  let status = 1;
  if (sub === 'lint') {
    stageConfigPath();
    status = cmdLint(argv);
  } else if (sub === 'knip') {
    stageConfigPath();
    status = cmdKnip(argv);
  } else if (sub === 'madge') {
    status = await cmdMadge(await loadStageConfig(), argv);
  } else if (sub === 'typecheck') {
    status = cmdTypecheck(await loadStageConfig(), argv);
  }
  process.exit(status);
}

await main();
