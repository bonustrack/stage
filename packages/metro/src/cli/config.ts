/** `metro setup` / `metro doctor` / `metro update` / `metro setup skill`. */

import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, unlinkSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pkg from '../../package.json' with { type: 'json' };
import { errMsg } from '../log.js';
import { CONFIG_ENV_FILE, loadMetroEnv, STATE_DIR } from '../paths.js';
import { TRAINS_DIR } from '../trains/supervisor.js';
import { listEndpoints, loadTunnelConfig, webhookPort } from '../tunnel.js';
import { emit, exitErr, isJson, writeJson, type Flags } from './util.js';

/* ──────────── setup skill: install/clear SKILL.md into ~/.claude or ~/.codex ──────────── */

type Runtime = 'claude-code' | 'codex';
const RUNTIME_DIRS: Record<Runtime, string> = {
  'claude-code': join(homedir(), '.claude', 'skills', 'metro'),
  codex: join(homedir(), '.codex', 'skills', 'metro'),
};
const skillDest = (r: Runtime): string => join(RUNTIME_DIRS[r], 'SKILL.md');
/** dist/cli/config.js → <package-root>/skills/metro/SKILL.md */
const bundledSkill = (): string =>
  join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'skills', 'metro', 'SKILL.md');

const skillStatus = (): Record<Runtime, boolean> => ({
  'claude-code': existsSync(skillDest('claude-code')), codex: existsSync(skillDest('codex')),
});

async function cmdSetupSkill(p: string[], f: Flags): Promise<void> {
  const sub = p[0];
  if (sub === 'clear') {
    const removed: string[] = [];
    for (const r of Object.keys(RUNTIME_DIRS) as Runtime[]) {
      const path = skillDest(r);
      if (existsSync(path)) { try { unlinkSync(path); removed.push(path); } catch { /* ignore */ } }
    }
    return emit(f, removed.length ? `removed metro skill from ${removed.join(', ')}` : 'no installed skill found',
      { ok: true, removed });
  }
  if (sub && sub !== 'install') throw exitErr(`unknown skill subcommand '${sub}' (try: install, clear)`, 1);
  const src = bundledSkill();
  if (!existsSync(src)) throw exitErr(`bundled SKILL.md missing at ${src} (broken install?)`, 2);
  const installed: string[] = [];
  for (const r of Object.keys(RUNTIME_DIRS) as Runtime[]) {
    if (!existsSync(join(homedir(), r === 'claude-code' ? '.claude' : '.codex'))) continue;
    const dest = skillDest(r);
    try { mkdirSync(RUNTIME_DIRS[r], { recursive: true }); copyFileSync(src, dest); installed.push(dest); }
    catch (err) { throw exitErr(`failed to install skill for ${r}: ${errMsg(err)}`, 2); }
  }
  if (!installed.length) throw exitErr('no user runtime detected (~/.claude or ~/.codex). Install one and rerun.', 2);
  emit(f, `installed metro skill → ${installed.join(', ')}`, { ok: true, installed });
}

/* ──────────── doctor: env-var discovery ──────────── */

type Check = { name: string; ok: boolean | null; detail: string };

/** Scan ~/.metro/trains/*.{ts,js,mjs} for `process.env.<NAME>` refs; report set/unset status. */
function envCheck(): Check[] {
  if (!existsSync(TRAINS_DIR)) return [];
  const names = new Set<string>();
  for (const f of readdirSync(TRAINS_DIR).filter(n => /\.(ts|js|mjs)$/.test(n) && !/^[._]/.test(n))) {
    try {
      const src = readFileSync(join(TRAINS_DIR, f), 'utf8');
      for (const m of src.matchAll(/process\.env\.([A-Z][A-Z0-9_]*)/g)) names.add(m[1]);
    } catch { /* ignore */ }
  }
  /** METRO_* are internal — don't surface them as "missing credentials". */
  const interesting = [...names].filter(n => !n.startsWith('METRO_')).sort();
  if (!interesting.length) return [];
  const set = interesting.filter(n => process.env[n]);
  const missing = interesting.filter(n => !process.env[n]);
  return [{ name: 'env-vars', ok: missing.length ? false : true,
    detail: `set: ${set.join(', ') || '(none)'}${missing.length ? ` · missing: ${missing.join(', ')}` : ''}` }];
}

/* ──────────── setup / doctor / update ──────────── */

export async function cmdSetup(p: string[], f: Flags): Promise<void> {
  const [sub] = p;
  if (sub === 'skill') return cmdSetupSkill(p.slice(1), f);
  if (sub) throw new Error(`unknown setup subcommand '${sub}' (try: skill)`);
  loadMetroEnv();
  const cfgExists = existsSync(CONFIG_ENV_FILE), trainsExists = existsSync(TRAINS_DIR);
  if (isJson(f)) return writeJson({
    version: pkg.version,
    config_env_file: CONFIG_ENV_FILE, config_env_exists: cfgExists,
    trains_dir: TRAINS_DIR, trains_dir_exists: trainsExists,
  });
  process.stdout.write(
    `metro ${pkg.version}\n\nconfig dir:  ${CONFIG_ENV_FILE}${cfgExists ? '' : ' (not yet written)'}\n`
    + `trains dir:  ${TRAINS_DIR}${trainsExists ? '' : ' (will be created on first run)'}\n\n`
    + 'Get started: see @stage-labs/metro/examples; drop train scripts in ~/.metro/trains/.\n');
}

export async function cmdDoctor(_: string[], f: Flags): Promise<void> {
  loadMetroEnv();
  const checks: Check[] = [];
  if (!existsSync(TRAINS_DIR)) {
    checks.push({ name: 'trains', ok: null, detail: `${TRAINS_DIR} (not created — \`mkdir -p\` it and drop in train files)` });
  } else {
    const files = readdirSync(TRAINS_DIR).filter(n => /\.(ts|js|mjs)$/.test(n) && !/^[._]/.test(n));
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
  checks.push({ name: 'codex-rc', ok: null,
    detail: process.env.METRO_CODEX_RC ? `push enabled → ${process.env.METRO_CODEX_RC}`
      : 'not configured (set METRO_CODEX_RC=ws://… to enable Codex push)' });
  const tunnel = loadTunnelConfig();
  checks.push({ name: 'tunnel', ok: tunnel ? true : null,
    detail: tunnel ? `${tunnel.hostname} → 127.0.0.1:${webhookPort()}`
      : 'not configured (run `metro tunnel setup <name> <hostname>`)' });
  const eps = listEndpoints();
  checks.push({ name: 'webhooks', ok: eps.length ? true : null,
    detail: eps.length ? `${eps.length} endpoint${eps.length === 1 ? '' : 's'}: ${eps.map(e => e.label).join(', ')}`
      : 'none (run `metro webhook add <label>`)' });
  for (const c of envCheck()) checks.push(c);
  const installed = Object.entries(skillStatus()).filter(([, ok]) => ok).map(([r]) => r);
  checks.push({ name: 'skill', ok: installed.length ? true : null,
    detail: installed.length ? `installed for ${installed.join(', ')}` : 'not installed (run `metro setup skill`)' });
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
