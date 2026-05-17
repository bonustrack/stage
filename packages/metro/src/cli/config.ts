/** Setup / doctor / update — config-side commands. */

import { existsSync, readFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { homedir } from 'node:os';
import { join } from 'node:path';
import pkg from '../../package.json' with { type: 'json' };
import {
  CONFIG_ENV_FILE, loadMetroEnv, STATE_DIR,
} from '../paths.js';
import { TRAINS_DIR } from '../trains/supervisor.js';
import { emit, exitErr, isJson, writeJson, type Flags } from './util.js';
import { cmdSetupSkill, skillStatus } from './skill.js';

async function cmdSetupStatus(f: Flags): Promise<void> {
  loadMetroEnv();
  const cfgExists = existsSync(CONFIG_ENV_FILE);
  const trainsExists = existsSync(TRAINS_DIR);
  if (isJson(f)) return writeJson({
    version: pkg.version,
    config_env_file: CONFIG_ENV_FILE, config_env_exists: cfgExists,
    trains_dir: TRAINS_DIR, trains_dir_exists: trainsExists,
  });
  process.stdout.write(`metro ${pkg.version}\n\n`
    + `config dir:  ${CONFIG_ENV_FILE}${cfgExists ? '' : ' (not yet written)'}\n`
    + `trains dir:  ${TRAINS_DIR}${trainsExists ? '' : ' (will be created on first run)'}\n\n`
    + 'Get started:\n'
    + '  1. mkdir -p ~/.metro && cd ~/.metro && bun init -y\n'
    + '  2. Copy example trains from @stage-labs/metro/examples into ~/.metro/trains/\n'
    + '  3. cd ~/.metro && bun add <whatever the trains need>  (e.g. discord.js)\n'
    + '  4. Set credentials in ~/.metro/.env (trains read this)\n'
    + '  5. metro\n');
}

export async function cmdSetup(p: string[], f: Flags): Promise<void> {
  const [sub] = p;
  if (!sub) return cmdSetupStatus(f);
  if (sub === 'skill') return cmdSetupSkill(p.slice(1), f);
  throw new Error(`unknown setup subcommand '${sub}' (try: skill)`);
}

export async function cmdDoctor(_: string[], f: Flags): Promise<void> {
  loadMetroEnv();
  type Check = { name: string; ok: boolean | null; detail: string };
  const checks: Check[] = [];

  const trainsDir = TRAINS_DIR;
  if (!existsSync(trainsDir)) {
    checks.push({ name: 'trains', ok: null, detail: `${trainsDir} (not created — \`mkdir -p\` it and drop in train files)` });
  } else {
    const { readdirSync } = await import('node:fs');
    const files = readdirSync(trainsDir).filter(n => /\.(ts|js|mjs)$/.test(n) && !n.startsWith('_') && !n.startsWith('.'));
    checks.push({ name: 'trains', ok: files.length > 0,
      detail: files.length ? `${files.length} train${files.length === 1 ? '' : 's'}: ${files.join(', ')}` : '(empty — no trains configured)' });
  }

  const metroPkg = join(homedir(), '.metro', 'package.json');
  checks.push({ name: 'trains-pkg', ok: existsSync(metroPkg) ? true : null,
    detail: existsSync(metroPkg) ? metroPkg : `${metroPkg} not found (run \`cd ~/.metro && bun init\` if any train needs deps)` });

  const lockFile = join(STATE_DIR, '.tail-lock');
  if (!existsSync(lockFile)) checks.push({ name: 'dispatcher', ok: null, detail: 'not running' });
  else try {
    const pid = Number(readFileSync(lockFile, 'utf8').trim());
    if (!Number.isInteger(pid) || pid <= 0) throw new Error('invalid pid');
    process.kill(pid, 0);
    checks.push({ name: 'dispatcher', ok: true, detail: `running (pid ${pid})` });
  } catch { checks.push({ name: 'dispatcher', ok: null, detail: 'stale lockfile (auto-reclaims)' }); }

  checks.push({
    name: 'codex-rc', ok: null,
    detail: process.env.METRO_CODEX_RC
      ? `push enabled → ${process.env.METRO_CODEX_RC}`
      : 'not configured (set METRO_CODEX_RC=ws://… to enable Codex push)',
  });

  const sk = skillStatus();
  const installed = Object.entries(sk).filter(([, ok]) => ok).map(([r]) => r);
  checks.push({
    name: 'skill', ok: installed.length ? true : null,
    detail: installed.length ? `installed for ${installed.join(', ')}` : 'not installed (run `metro setup skill`)',
  });

  if (isJson(f)) return writeJson({ checks });
  process.stdout.write('metro doctor\n\n');
  for (const c of checks) {
    const mark = c.ok === true ? '✓' : c.ok === false ? '✗' : '–';
    process.stdout.write(`  ${mark} ${c.name.padEnd(15)} ${c.detail}\n`);
  }
  process.stdout.write('\n');
  if (checks.some(c => c.ok === false)) throw exitErr('one or more checks failed', 3);
}

export async function cmdUpdate(_: string[], f: Flags): Promise<void> {
  const tag = pkg.version.includes('-') ? 'beta' : 'latest';
  const res = await fetch('https://registry.npmjs.org/@stage-labs/metro', { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`npm registry: ${res.status}`);
  const latest = ((await res.json()) as { 'dist-tags'?: Record<string, string> })['dist-tags']?.[tag];
  if (!latest) throw new Error(`no '${tag}' dist-tag for @stage-labs/metro`);
  if (latest === pkg.version) {
    return emit(f, `already on ${pkg.version} (latest ${tag})`,
      { ok: true, current: pkg.version, latest, upgraded: false });
  }
  const argv1 = process.argv[1] ?? '', spec = `@stage-labs/metro@${tag}`;
  const argv = argv1.includes('/.bun/') || argv1.includes('\\bun\\') ? ['bun', 'add', '-g', spec]
    : argv1.includes('/pnpm/') || argv1.includes('\\pnpm\\') ? ['pnpm', 'add', '-g', spec]
    : ['npm', 'install', '-g', spec];
  emit(f, `metro ${pkg.version} → ${latest}\n$ ${argv.join(' ')}`,
    { ok: true, current: pkg.version, latest, command: argv.join(' ') });
  await new Promise<void>((resolve, reject) => {
    const child = spawn(argv[0], argv.slice(1), { stdio: isJson(f) ? 'ignore' : 'inherit' });
    child.on('exit', code => code === 0 ? resolve() : reject(new Error(`${argv[0]} exited ${code}`)));
    child.on('error', reject);
  });
}
