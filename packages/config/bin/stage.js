#!/usr/bin/env node
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { spawn, spawnSync } from 'node:child_process';

const requireFromCwd = createRequire(join(process.cwd(), 'noop.js'));

const SUBS = ['lint', 'fmt', 'check', 'knip'];

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

function findLocalBin(name) {
  let dir = cwd;
  for (;;) {
    const candidate = resolve(dir, 'node_modules', '.bin', name);
    if (existsSync(candidate)) return candidate;
    const parent = resolve(dir, '..');
    if (parent === dir) return null;
    dir = parent;
  }
}

function localBin(name) {
  return findLocalBin(name) ?? name;
}

function run(bin, args) {
  const res = spawnSync(bin, args, { stdio: 'inherit', cwd });
  return res.status ?? 1;
}

const LINT_VALUE_FLAGS = new Set([
  '-c',
  '--config',
  '--ext',
  '--global',
  '--parser',
  '--parser-options',
  '--plugin',
  '--rule',
  '--fix-type',
  '--ignore-pattern',
  '--stdin-filename',
  '--max-warnings',
  '-o',
  '--output-file',
  '-f',
  '--format',
  '--report-unused-disable-directives-severity',
  '--report-unused-inline-configs',
  '--cache-file',
  '--cache-location',
  '--cache-strategy',
  '--suppress-rule',
  '--suppressions-location',
  '--print-config',
  '--flag',
  '--concurrency',
]);
const LINTABLE = /\.(ts|tsx|mts|cts|js|jsx|mjs|cjs|vue)$/;

function parseLintArgs(argv) {
  const paths = [];
  let changed = false;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const name = arg.split('=')[0];
    if (!arg.startsWith('-')) paths.push(arg);
    else if (name === '--changed') changed = true;
    else if (!arg.includes('=') && LINT_VALUE_FLAGS.has(name) && i + 1 < argv.length) i += 1;
  }
  return { paths, changed };
}

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

function oxlintTargets(paths, files) {
  if (files) return [...files, '--no-error-on-unmatched-pattern'];
  return paths.length > 0 ? [] : ['.'];
}

async function cmdLint(argv) {
  const { paths, changed } = parseLintArgs(argv);
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
  return run(localBin('oxlint'), ['--type-aware', ...oxlintTargets(paths, files), ...rest]);
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
  const native = ['knip.config.js', 'knip.config.ts', 'knip.config.json', 'knip.json'].find((name) => existsSync(resolve(cwd, name)));
  if (native) {
    process.stderr.write(`stage knip: deferring to native ${native}\n`);
    return run(localBin('knip'), [...argv]);
  }
  const config = [
    `import { buildKnipConfig } from ${JSON.stringify(pathToFileURL(requireFromCwd.resolve('@stage-labs/config/knip')).href)};`,
    `import cfg from ${JSON.stringify(pathToFileURL(stageConfigPath()).href)};`,
    'export default buildKnipConfig(cfg);',
    '',
  ].join('\n');
  const temp = join(mkdtempSync(join(tmpdir(), 'stage-knip-')), 'config.mjs');
  writeFileSync(temp, config);
  return run(localBin('knip'), ['--config', temp, ...argv]);
}

const CHECK_JOBS = 2;

function spawnCaptured(bin, args) {
  return new Promise((done) => {
    const child = spawn(bin, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => {
      output += chunk;
    });
    child.stderr.on('data', (chunk) => {
      output += chunk;
    });
    child.on('error', (error) => done({ status: 2, output: `${error.message}\n` }));
    child.on('close', (code) => done({ status: code ?? 2, output }));
  });
}

async function cmdCheck(stageConfig, argv) {
  const flags = [...(process.stdout.isTTY ? ['--pretty'] : []), ...argv];
  const queue = Object.entries(stageConfig.workspaces)
    .map(([path]) => ({ path, project: path === '.' ? 'tsconfig.json' : `${path}/tsconfig.json` }))
    .filter(({ project }) => existsSync(resolve(cwd, project)));
  const failures = [];
  const lane = async () => {
    for (let job = queue.shift(); job; job = queue.shift()) {
      const { status, output } = await spawnCaptured('bun', ['check', '--no-script', '-p', job.project, ...flags]);
      await new Promise((done) => process.stdout.write(`stage check: ${job.path}\n${output}`, done));
      if (status !== 0) failures.push(job.path);
    }
  };
  await Promise.all(Array.from({ length: Math.min(CHECK_JOBS, queue.length) }, lane));
  if (failures.length > 0) {
    process.stderr.write(`stage check: failed in ${failures.join(', ')}\n`);
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
    status = await cmdLint(argv);
  } else if (sub === 'fmt') {
    status = cmdFmt(argv);
  } else if (sub === 'knip') {
    stageConfigPath();
    status = cmdKnip(argv);
  } else if (sub === 'check') {
    status = await cmdCheck(await loadStageConfig(), argv);
  }
  process.exit(status);
}

await main();
