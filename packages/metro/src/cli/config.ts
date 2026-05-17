/** Setup / doctor / update — config-side commands consumed by cli.ts. */

import { existsSync, readFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { join } from 'node:path';
import pkg from '../../package.json' with { type: 'json' };
import { Client } from '../client.js';
import { errMsg } from '../log.js';
import {
  CONFIG_ENV_FILE, configuredPlatforms, loadMetroEnv, readDotenv, STATE_DIR, writeDotenv,
} from '../paths.js';
import { emit, exitErr, isJson, writeJson, type Flags } from './util.js';
import { cmdSetupSkill, skillStatus } from './skill.js';

const TOKEN_KEYS = { telegram: 'TELEGRAM_BOT_TOKEN', discord: 'DISCORD_BOT_TOKEN' } as const;
type Platform = keyof typeof TOKEN_KEYS;

/** One-shot getMe via Client.call — used by setup + doctor to verify a token works. */
async function getMe(p: Platform): Promise<{ id: string | number; username: string }> {
  const client = new Client();
  try {
    await client.start();
    return await client.call<{ id: string | number; username: string }>(p, 'getMe');
  } finally { await client.stop().catch(() => {}); }
}
const maskToken = (t: string): string =>
  !t ? '' : t.length <= 8 ? '••••' : `${t.slice(0, 6)}…${t.slice(-2)}`;

/** Apply token across CONFIG_ENV_FILE (always set/cleared) AND cwd/.env (only if it exists). */
function applyToken(key: string, value: string | null): string[] {
  const out: string[] = [];
  for (const path of [CONFIG_ENV_FILE, join(process.cwd(), '.env')]) {
    if (path !== CONFIG_ENV_FILE && !existsSync(path)) continue;
    const env = readDotenv(path);
    if (value === null) { if (!(key in env)) continue; delete env[key]; } else env[key] = value;
    writeDotenv(path, env); out.push(path);
  }
  return out;
}

async function cmdSetupStatus(f: Flags): Promise<void> {
  loadMetroEnv();
  const tg = process.env.TELEGRAM_BOT_TOKEN ?? '', dc = process.env.DISCORD_BOT_TOKEN ?? '';
  if (isJson(f)) return writeJson({
    version: pkg.version, config_env_file: CONFIG_ENV_FILE,
    tokens: { telegram: { set: !!tg, masked: maskToken(tg) }, discord: { set: !!dc, masked: maskToken(dc) } },
  });
  const cfgState = existsSync(CONFIG_ENV_FILE) ? '' : ' (not yet written)';
  const getStarted = !tg && !dc
    ? 'Get started:\n  1. metro setup telegram <token>   # https://t.me/BotFather'
    + '\n     metro setup discord <token>     # https://discord.com/developers/applications'
    + '\n  2. metro doctor\n  3. metro\n'
    : 'Run `metro` to start the dispatcher, or `metro doctor` to verify.\n';
  process.stdout.write(`metro ${pkg.version}\n\nconfig:  ${CONFIG_ENV_FILE}${cfgState}\n\n`
    + `  TELEGRAM_BOT_TOKEN  ${tg ? `set (${maskToken(tg)})` : 'not set'}\n`
    + `  DISCORD_BOT_TOKEN   ${dc ? `set (${maskToken(dc)})` : 'not set'}\n\n${getStarted}`);
}

export async function cmdSetup(p: string[], f: Flags): Promise<void> {
  const [sub, value] = p;
  if (!sub) return cmdSetupStatus(f);
  if (sub === 'skill') return cmdSetupSkill(p.slice(1), f);

  if (sub === 'telegram' || sub === 'discord') {
    if (!value) throw new Error(`metro setup ${sub} <token> — token is required`);
    const trimmed = value.trim();
    let identity: string | undefined;
    if (!f['no-validate']) {
      process.env[TOKEN_KEYS[sub]] = trimmed;
      try {
        const me = await getMe(sub);
        identity = sub === 'telegram' ? `@${me.username}` : me.username;
      } catch (err) {
        delete process.env[TOKEN_KEYS[sub]];
        throw exitErr(`token rejected by ${sub}: ${errMsg(err)} (use --no-validate to save anyway)`, 3);
      }
    }
    const paths = applyToken(TOKEN_KEYS[sub], trimmed);
    const verified = identity ? ` (verified as ${identity})` : '';
    emit(f, `saved ${TOKEN_KEYS[sub]}${verified} to ${paths.join(', ')}\nrestart metro for the new token to take effect.`,
      { ok: true, saved: TOKEN_KEYS[sub], paths, verified_as: identity ?? null });
    return;
  }

  if (sub === 'clear') {
    const target = value ?? 'all';
    if (target !== 'all' && target !== 'telegram' && target !== 'discord')
      throw new Error(`metro setup clear <telegram|discord|all> — got '${target}'`);
    const keys = target === 'all' ? Object.values(TOKEN_KEYS) : [TOKEN_KEYS[target]];
    const paths = new Set<string>();
    for (const k of keys) for (const path of applyToken(k, null)) paths.add(path);
    const label = target === 'all' ? 'all metro tokens' : TOKEN_KEYS[target];
    emit(f, `cleared ${label} from ${[...paths].join(', ') || '(no files had it)'}\nrestart metro for changes to take effect.`,
      { ok: true, cleared: target, paths: [...paths] });
    return;
  }
  throw new Error(`unknown setup subcommand '${sub}' (try: telegram, discord, clear, skill)`);
}

function tokenSource(key: string): string {
  const val = process.env[key]; if (!val) return '';
  for (const path of [join(process.cwd(), '.env'), CONFIG_ENV_FILE]) {
    if (existsSync(path) && readDotenv(path)[key] === val) return path;
  }
  return 'process env';
}

export async function cmdDoctor(_: string[], f: Flags): Promise<void> {
  loadMetroEnv();
  const cfg = configuredPlatforms();
  type Check = { name: string; ok: boolean | null; detail: string };
  const checks: Check[] = [];
  const sources: string[] = [];
  for (const p of ['telegram', 'discord'] as const) {
    if (!cfg[p]) { checks.push({ name: p, ok: null, detail: 'not configured' }); continue; }
    sources.push(`${p}←${tokenSource(TOKEN_KEYS[p])}`);
    try {
      const me = await getMe(p);
      checks.push({ name: p, ok: true, detail: `getMe → ${p === 'telegram' ? '@' : ''}${me.username}` });
    } catch (err) { checks.push({ name: p, ok: false, detail: errMsg(err) }); }
  }
  checks.unshift({
    name: 'tokens', ok: cfg.telegram || cfg.discord,
    detail: sources.length ? sources.join(', ') : 'no platform configured — run `metro setup telegram|discord <token>`',
  });

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
