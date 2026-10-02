#!/usr/bin/env node
import { existsSync, mkdtempSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { spawn, spawnSync } from 'node:child_process';

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

const LINT_VALUE_FLAGS = new Set([
  '-c', '--config', '--ext', '--global', '--parser', '--parser-options', '--plugin', '--rule', '--fix-type',
  '--ignore-pattern', '--stdin-filename', '--max-warnings', '-o', '--output-file', '-f', '--format',
  '--report-unused-disable-directives-severity', '--report-unused-inline-configs', '--cache-file',
  '--cache-location', '--cache-strategy', '--suppress-rule', '--suppressions-location', '--print-config',
  '--flag', '--concurrency',
]);
const LINTABLE = /\.(ts|tsx|mts|cts|js|jsx|mjs|cjs|vue)$/;

function parseLintArgs(argv) {
  const paths = [];
  const flags = [];
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('-')) {
      paths.push(arg);
      continue;
    }
    const name = arg.split('=')[0];
    const takesValue = !arg.includes('=') && LINT_VALUE_FLAGS.has(name) && i + 1 < argv.length;
    const raw = takesValue ? [arg, argv[(i += 1)]] : [arg];
    flags.push({ name, raw, value: takesValue ? raw[1] : arg.slice(name.length + 1) });
  }
  return { paths, flags };
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
  const { paths, flags } = parseLintArgs(argv);
  const changed = flags.some((flag) => flag.name === '--changed');
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

const TYPECHECK_JOBS = 2;

function spawnCaptured(bin, args) {
  return new Promise((done) => {
    const child = spawn(bin, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => { output += chunk; });
    child.stderr.on('data', (chunk) => { output += chunk; });
    child.on('error', (error) => done({ status: 2, output: `${error.message}\n` }));
    child.on('close', (code) => done({ status: code ?? 2, output }));
  });
}

function typecheckCompiler(useTsc) {
  return !useTsc && findLocalBin('tsgo') ? 'tsgo' : 'tsc';
}

async function cmdTypecheck(stageConfig, argv) {
  const useTsc = argv.includes('--tsc');
  const flags = [...(process.stdout.isTTY ? ['--pretty'] : []), ...argv.filter((arg) => arg !== '--tsc')];
  const queue = Object.entries(stageConfig.workspaces)
    .map(([path]) => ({ path, project: path === '.' ? 'tsconfig.json' : `${path}/tsconfig.json`, compiler: typecheckCompiler(useTsc) }))
    .filter(({ project }) => existsSync(resolve(cwd, project)));
  const failures = [];
  const lane = async () => {
    for (let job = queue.shift(); job; job = queue.shift()) {
      const { status, output } = await spawnCaptured(localBin(job.compiler), ['--noEmit', '-p', job.project, ...flags]);
      await new Promise((done) => process.stdout.write(`stage typecheck: ${job.path} (${job.compiler})\n${output}`, done));
      if (status !== 0) failures.push(job.path);
    }
  };
  await Promise.all(Array.from({ length: Math.min(TYPECHECK_JOBS, queue.length) }, lane));
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
    status = await cmdLint(argv);
  } else if (sub === 'knip') {
    stageConfigPath();
    status = cmdKnip(argv);
  } else if (sub === 'madge') {
    status = await cmdMadge(await loadStageConfig(), argv);
  } else if (sub === 'typecheck') {
    status = await cmdTypecheck(await loadStageConfig(), argv);
  }
  process.exit(status);
}

await main();
