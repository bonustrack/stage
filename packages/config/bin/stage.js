#!/usr/bin/env node
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve, join } from 'node:path';
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

const LINT_VALUE_FLAGS = new Set([
  '-c', '--config', '--ext', '--global', '--parser', '--parser-options', '--plugin', '--rule', '--fix-type',
  '--ignore-pattern', '--stdin-filename', '--max-warnings', '-o', '--output-file', '-f', '--format',
  '--report-unused-disable-directives-severity', '--report-unused-inline-configs', '--cache-file',
  '--cache-location', '--cache-strategy', '--suppress-rule', '--suppressions-location', '--print-config',
  '--flag', '--concurrency',
]);
const LANE_FORWARDED_FLAGS = new Set(['--fix', '--fix-dry-run', '--fix-type', '--stats']);
const LANE_REPORT_FLAGS = new Set(['-f', '--format', '-o', '--output-file', '--max-warnings', '--color', '--no-color']);
const LINTABLE = /\.(ts|tsx|mts|cts|js|jsx|mjs|cjs|vue)$/;
const FORMATS_WITHOUT_RULES_META = new Set(['stylish', 'json']);

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

function flagValue(flags, names) {
  return flags.filter((flag) => names.includes(flag.name)).map((flag) => flag.value).pop();
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

function lintableCount(dir) {
  return nulSplit(git(['ls-files', '-z', '--', dir]) ?? '').filter((file) => LINTABLE.test(file)).length;
}

function lintProjects(temp) {
  const script = join(dirname(temp), 'workspaces.mjs');
  writeFileSync(script, `import cfg from ${JSON.stringify(configUrl())};\nprocess.stdout.write(JSON.stringify(Object.keys(cfg.workspaces)));\n`);
  const res = spawnSync(process.execPath, [script], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] });
  if (res.status !== 0) return null;
  return JSON.parse(res.stdout.trim().split('\n').pop() ?? '[]')
    .filter((path) => path !== '.' && existsSync(resolve(cwd, path, 'tsconfig.json')))
    .map((path) => ({ path, size: lintableCount(path) }))
    .sort((a, b) => b.size - a.size)
    .map(({ path }) => path);
}

function repoTasks(projects) {
  const nested = (dir) => projects.filter((path) => dir === '.' || path.startsWith(`${dir}/`));
  return [...projects, '.'].map((dir) => [
    dir,
    '--no-error-on-unmatched-pattern',
    ...nested(dir).flatMap((path) => ['--ignore-pattern', `${path}/**`]),
  ]);
}

function changedTasks(projects, files) {
  const groups = new Map();
  for (const file of files) {
    const owner = projects.filter((path) => file.startsWith(`${path}/`)).sort((a, b) => b.length - a.length)[0] ?? '.';
    groups.set(owner, [...(groups.get(owner) ?? []), file]);
  }
  return [...groups.values()].map((group) => [...group, '--no-warn-ignored']);
}

function lintJobs() {
  const jobs = Number.parseInt(process.env.STAGE_LINT_JOBS ?? '', 10);
  return jobs > 0 ? jobs : 2;
}

function spawnLane(args) {
  const nodeOptions = `${process.env.NODE_OPTIONS ?? ''} --disable-warning=MODULE_TYPELESS_PACKAGE_JSON`.trim();
  return new Promise((done) => {
    const child = spawn(localBin('eslint'), args, { stdio: 'inherit', cwd, env: { ...process.env, NODE_OPTIONS: nodeOptions } });
    child.on('error', (error) => {
      process.stderr.write(`stage lint: ${error.message}\n`);
      done(2);
    });
    child.on('close', (code) => done(code ?? 2));
  });
}

async function reportLint(temp, results, flags) {
  const { ESLint } = await import(resolvePkg('eslint'));
  const engine = new ESLint({ cwd, overrideConfigFile: temp });
  const format = flagValue(flags, ['-f', '--format']) ?? 'stylish';
  const formatter = await engine.loadFormatter(format);
  for (const result of FORMATS_WITHOUT_RULES_META.has(format) ? [] : results) {
    if (result.messages.length + result.suppressedMessages.length > 0) await engine.calculateConfigForFile(result.filePath);
  }
  const errors = results.reduce((sum, result) => sum + result.errorCount, 0);
  const warnings = results.reduce((sum, result) => sum + result.warningCount, 0);
  const maxWarnings = Number(flagValue(flags, ['--max-warnings']) ?? -1);
  const tooManyWarnings = maxWarnings >= 0 && warnings > maxWarnings;
  const color = flags.filter((flag) => flag.name === '--color' || flag.name === '--no-color').pop();
  const meta = {};
  if (color) meta.color = color.name === '--color';
  if (tooManyWarnings) meta.maxWarningsExceeded = { maxWarnings, foundWarnings: warnings };
  const output = await formatter.format(results, meta);
  const outputFile = flagValue(flags, ['-o', '--output-file']);
  if (outputFile) {
    mkdirSync(dirname(resolve(cwd, outputFile)), { recursive: true });
    writeFileSync(resolve(cwd, outputFile), output);
  } else if (output) {
    await new Promise((done) => process.stdout.write(`${output}\n`, done));
  }
  if (!errors && tooManyWarnings) console.error('ESLint found too many warnings (maximum: %s).', maxWarnings);
  return errors || tooManyWarnings ? 1 : 0;
}

async function runLintLanes(temp, tasks, flags) {
  const forwarded = flags.filter((flag) => LANE_FORWARDED_FLAGS.has(flag.name)).flatMap((flag) => flag.raw);
  const outputs = tasks.map((_, i) => join(dirname(temp), `lane-${i}.json`));
  const queue = tasks.map((targets, i) => ['--config', temp, ...targets, '--format', 'json', '--output-file', outputs[i], ...forwarded]);
  const codes = [];
  const lane = async () => {
    for (let args = queue.shift(); args; args = queue.shift()) codes.push(await spawnLane(args));
  };
  await Promise.all(Array.from({ length: Math.min(lintJobs(), queue.length) }, lane));
  const failed = codes.find((code) => code > 1);
  if (failed !== undefined) return failed;
  if (!outputs.every((file) => existsSync(file))) return 2;
  const results = outputs.flatMap((file) => JSON.parse(readFileSync(file, 'utf8')));
  try {
    return await reportLint(temp, results, flags);
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    return 2;
  }
}

function lintTargets(paths, files) {
  if (files) return [...files, '--no-warn-ignored'];
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
  const native = firstExisting(['eslint.config.js', 'eslint.config.mjs', 'eslint.config.cjs', 'eslint.config.ts']);
  if (native) {
    process.stderr.write(`stage lint: deferring to native ${native}\n`);
    return run(localBin('eslint'), [...lintTargets(paths, files), ...rest]);
  }
  const temp = writeTemp('stage-lint-', [
    `import { buildLintConfig } from ${JSON.stringify(resolvePkg('@stage-labs/config/lint'))};`,
    `import cfg from ${JSON.stringify(configUrl())};`,
    `export default await buildLintConfig(cfg, ${JSON.stringify(cwd)});`,
    '',
  ].join('\n'));
  const laned = paths.length === 0 && flags.every((flag) =>
    flag.name === '--changed' || LANE_FORWARDED_FLAGS.has(flag.name) || LANE_REPORT_FLAGS.has(flag.name));
  try {
    if (!laned) return run(localBin('eslint'), ['--config', temp, ...lintTargets(paths, files), ...rest]);
    const projects = lintProjects(temp);
    if (!projects) return 2;
    return await runLintLanes(temp, files ? changedTasks(projects, files) : repoTasks(projects), flags);
  } finally {
    rmSync(dirname(temp), { recursive: true, force: true });
  }
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
    status = await cmdLint(argv);
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
