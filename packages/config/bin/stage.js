#!/usr/bin/env node
import { existsSync, mkdtempSync, readFileSync, writeFileSync, writeSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

const cwd = process.cwd();
const requireFromCwd = createRequire(join(cwd, 'noop.js'));

function usage(message) {
  if (message) process.stderr.write(`${message}\n`);
  process.stderr.write(`usage: stage <${SUBS.join('|')}> [...args]\n`);
  process.exit(1);
}

function stageConfigPath() {
  const p = resolve(cwd, 'stage.config.js');
  if (!existsSync(p)) {
    process.stderr.write(`stage: no stage.config.js found in ${cwd}\n`);
    process.exit(1);
  }
  return p;
}

async function loadStageConfig() {
  const mod = await import(pathToFileURL(stageConfigPath()).href);
  return mod.default ?? mod.config ?? mod;
}

function localBin(name) {
  let dir = cwd;
  for (;;) {
    const candidate = resolve(dir, 'node_modules', '.bin', name);
    if (existsSync(candidate)) return candidate;
    const parent = resolve(dir, '..');
    if (parent === dir) return name;
    dir = parent;
  }
}

function run(bin, args) {
  return spawnSync(bin, args, { stdio: 'inherit', cwd }).status ?? 1;
}

const LINTABLE = /\.(ts|tsx|mts|cts|js|jsx|mjs|cjs)$/;

function git(args) {
  const res = spawnSync('git', args, { cwd, encoding: 'utf8' });
  return res.status === 0 ? res.stdout : null;
}

function nulSplit(out) {
  return out.split('\0').filter(Boolean);
}

function changedFiles() {
  const base = git(['merge-base', 'HEAD', '@{upstream}'])?.trim() || 'HEAD';
  const diff = git(['diff', '-z', '--name-only', '--relative', '--diff-filter=d', base]);
  const untracked = git(['ls-files', '-z', '--others', '--exclude-standard']);
  if (diff === null || untracked === null) {
    process.stderr.write('stage lint --changed: git failed, run it inside a git checkout\n');
    return null;
  }
  const files = new Set([...nulSplit(diff), ...nulSplit(untracked)]);
  return [...files].filter((file) => LINTABLE.test(file) && existsSync(resolve(cwd, file)));
}

function cmdLint(argv) {
  const changed = argv.includes('--changed');
  const rest = argv.filter((arg) => arg !== '--changed');
  const files = changed ? changedFiles() : null;
  if (changed && !files) return 2;
  if (files?.length === 0) {
    process.stdout.write('stage lint: no changed files to lint\n');
    return 0;
  }
  if (!existsSync(resolve(cwd, '.oxlintrc.json'))) {
    process.stderr.write(`stage lint: no .oxlintrc.json found in ${cwd}\n`);
    return 1;
  }
  const targets = files ? [...files, '--no-error-on-unmatched-pattern'] : [];
  return run(localBin('oxlint'), ['--type-aware', ...targets, ...rest]);
}

function cmdFmt(argv) {
  const bunfig = resolve(cwd, 'bunfig.toml');
  if (!existsSync(bunfig) || !/^\[fmt\]/m.test(readFileSync(bunfig, 'utf8'))) {
    process.stderr.write(`stage fmt: no [fmt] section in ${bunfig}\n`);
    return 1;
  }
  return run('bun', ['fmt', '--no-script', ...argv]);
}

function cmdKnip(argv) {
  const configPath = stageConfigPath();
  const native = ['knip.config.js', 'knip.config.ts', 'knip.config.json', 'knip.json'].find((name) => existsSync(resolve(cwd, name)));
  if (native) {
    process.stderr.write(`stage knip: deferring to native ${native}\n`);
    return run(localBin('knip'), argv);
  }
  const config = [
    `import { buildKnipConfig } from ${JSON.stringify(pathToFileURL(requireFromCwd.resolve('@stage-labs/config/knip')).href)};`,
    `import cfg from ${JSON.stringify(pathToFileURL(configPath).href)};`,
    'export default buildKnipConfig(cfg);',
    '',
  ].join('\n');
  const temp = join(mkdtempSync(join(tmpdir(), 'stage-knip-')), 'config.mjs');
  writeFileSync(temp, config);
  return run(localBin('knip'), ['--config', temp, ...argv]);
}

function checkProjects(path) {
  const dir = path === '.' ? '' : `${path}/`;
  return [`${dir}tsconfig.json`, `${dir}test/tsconfig.json`].filter((project) => existsSync(resolve(cwd, project)));
}

async function cmdCheck(argv) {
  const failed = Object.keys((await loadStageConfig()).workspaces)
    .flatMap(checkProjects)
    .map(dirname)
    .filter((project) => {
      writeSync(1, `stage check: ${project}\n`);
      return run('bun', ['check', '--no-script', '-p', `${project}/tsconfig.json`, ...argv]) !== 0;
    });
  if (failed.length > 0) process.stderr.write(`stage check: failed in ${failed.join(', ')}\n`);
  return failed.length > 0 ? 1 : 0;
}

const COMMANDS = { lint: cmdLint, fmt: cmdFmt, check: cmdCheck, knip: cmdKnip };

const SUBS = Object.keys(COMMANDS);

async function main() {
  const [sub, ...argv] = process.argv.slice(2);
  if (!sub || !SUBS.includes(sub)) usage(sub ? `stage: unknown command "${sub}"` : null);
  process.exit(await COMMANDS[sub](argv));
}

await main();
