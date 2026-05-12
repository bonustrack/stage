#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import pkg from '../../package.json' with { type: 'json' };
import { cmdLines } from './lines.js';
import { cmdUpdate } from './update.js';
import { DiscordStation } from '../stations/discord/index.js';
import { TelegramStation } from '../stations/telegram/index.js';
import { fmtCapabilities, listStations } from '../stations/listing.js';
import { sendToLine } from '../stations/send.js';
import { errMsg } from '../log.js';
import { CONFIG_ENV_FILE, configuredPlatforms, loadMetroEnv, readDotenv, STATE_DIR, writeDotenv } from '../paths.js';

const USAGE = `metro — Telegram + Discord bridge for your Claude Code / Codex agent

Usage:
  metro                                       Run the dispatcher daemon.
  metro setup [telegram|discord <token>]      Save token, or show status with no args.
  metro setup clear [telegram|discord|all]    Remove tokens.
  metro doctor                                Health check.
  metro stations                              List stations + capabilities.
  metro lines                                 List active conversations (sorted by recency).
  metro send <line> <text>                    Post a message to a metro:// line.
  metro update                                Upgrade in place.
  metro --version | --help
Exit codes: 0 success · 1 usage · 2 config · 3 upstream
`;

type Flags = Record<string, string | boolean>;
type ExitErr = Error & { code?: number };
const exitErr = (msg: string, code: number): ExitErr => Object.assign(new Error(msg), { code });
const isJson = (f: Flags): boolean => f.json === true;
const emit = (f: Flags, human: string, structured: unknown): void =>
  void process.stdout.write(isJson(f) ? JSON.stringify(structured) + '\n' : human + '\n');
const maskToken = (t: string): string => !t ? '' : t.length <= 8 ? '••••' : `${t.slice(0, 6)}…${t.slice(-2)}`;
const TOKEN_KEYS = { telegram: 'TELEGRAM_BOT_TOKEN', discord: 'DISCORD_BOT_TOKEN' } as const;

function parseArgs(argv: string[]): { positional: string[]; flags: Flags } {
  const positional: string[] = [], flags: Flags = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) { positional.push(a); continue; }
    const eq = a.indexOf('=');
    if (eq !== -1) { flags[a.slice(2, eq)] = a.slice(eq + 1); continue; }
    const key = a.slice(2), next = argv[i + 1];
    if (next !== undefined && !next.startsWith('--')) { flags[key] = next; i++; } else flags[key] = true;
  }
  return { positional, flags };
}

/** Apply a token across CONFIG_ENV_FILE (always set/cleared) AND cwd/.env (only if it exists). Returns paths touched. */
function applyTokenToAllEnvs(key: string, value: string | null): string[] {
  const out: string[] = [];
  for (const path of [CONFIG_ENV_FILE, join(process.cwd(), '.env')]) {
    if (path !== CONFIG_ENV_FILE && !existsSync(path)) continue;
    const env = readDotenv(path);
    if (value === null) { if (!(key in env)) continue; delete env[key]; } else env[key] = value;
    writeDotenv(path, env); out.push(path);
  }
  return out;
}

async function cmdSetup(positional: string[], flags: Flags): Promise<void> {
  const [sub, value] = positional;
  if (!sub) return cmdSetupStatus(flags);

  if (sub === 'telegram' || sub === 'discord') {
    if (!value) throw new Error(`metro setup ${sub} <token> — token is required`);
    const trimmed = value.trim();
    let identity: string | undefined;
    if (!flags['no-validate']) {
      process.env[TOKEN_KEYS[sub]] = trimmed;
      try { identity = sub === 'telegram' ? `@${(await new TelegramStation().getMe()).username}` : (await new DiscordStation().getMe()).username; }
      catch (err) { delete process.env[TOKEN_KEYS[sub]]; throw exitErr(`token rejected by ${sub}: ${errMsg(err)} (use --no-validate to save anyway)`, 3); }
    }
    const paths = applyTokenToAllEnvs(TOKEN_KEYS[sub], trimmed);
    emit(flags, `saved ${TOKEN_KEYS[sub]}${identity ? ` (verified as ${identity})` : ''} to ${paths.join(', ')}\nrestart metro for the new token to take effect.`, { ok: true, saved: TOKEN_KEYS[sub], paths, verified_as: identity ?? null });
    return;
  }

  if (sub === 'clear') {
    const target = value ?? 'all';
    if (target !== 'all' && target !== 'telegram' && target !== 'discord') throw new Error(`metro setup clear <telegram|discord|all> — got '${target}'`);
    const keys = target === 'all' ? ['TELEGRAM_BOT_TOKEN', 'DISCORD_BOT_TOKEN'] : [TOKEN_KEYS[target]];
    const paths = new Set<string>();
    for (const k of keys) for (const p of applyTokenToAllEnvs(k, null)) paths.add(p);
    const label = target === 'all' ? 'all metro tokens' : TOKEN_KEYS[target];
    return void emit(flags, `cleared ${label} from ${[...paths].join(', ') || '(no files had it)'}\nrestart metro for changes to take effect.`, { ok: true, cleared: target, paths: [...paths] });
  }
  throw new Error(`unknown setup subcommand '${sub}' (try: telegram, discord, clear)`);
}

async function cmdSetupStatus(flags: Flags): Promise<void> {
  loadMetroEnv();
  const tg = process.env.TELEGRAM_BOT_TOKEN ?? '', dc = process.env.DISCORD_BOT_TOKEN ?? '';
  if (isJson(flags)) return void process.stdout.write(JSON.stringify({ version: pkg.version, config_env_file: CONFIG_ENV_FILE,
    tokens: { telegram: { set: !!tg, masked: maskToken(tg) }, discord: { set: !!dc, masked: maskToken(dc) } } }) + '\n');
  const cfgState = existsSync(CONFIG_ENV_FILE) ? '' : ' (not yet written)';
  process.stdout.write(`metro ${pkg.version}\n\nconfig:  ${CONFIG_ENV_FILE}${cfgState}\n\n  TELEGRAM_BOT_TOKEN  ${tg ? `set (${maskToken(tg)})` : 'not set'}\n  DISCORD_BOT_TOKEN   ${dc ? `set (${maskToken(dc)})` : 'not set'}\n\n${!tg && !dc
    ? 'Get started:\n  1. metro setup telegram <token>   # https://t.me/BotFather\n     metro setup discord <token>     # https://discord.com/developers/applications\n  2. metro doctor\n  3. metro\n'
    : 'Run `metro` to start the dispatcher, or `metro doctor` to verify.\n'}`);
}

type DoctorCheck = { name: string; ok: boolean | null; detail: string };

/** Find which file (or process env) supplied the currently-loaded token, so doctor can name the real source. */
function tokenSource(key: string): string {
  const val = process.env[key]; if (!val) return '';
  for (const path of [join(process.cwd(), '.env'), CONFIG_ENV_FILE]) if (existsSync(path) && readDotenv(path)[key] === val) return path;
  return 'process env';
}

async function cmdDoctor(flags: Flags): Promise<void> {
  loadMetroEnv();
  const cfg = configuredPlatforms();
  const sources = ([['telegram', 'TELEGRAM_BOT_TOKEN'], ['discord', 'DISCORD_BOT_TOKEN']] as const).filter(([p]) => cfg[p]).map(([p, k]) => `${p}←${tokenSource(k)}`).join(', ');
  const checks: DoctorCheck[] = [{ name: 'tokens', ok: cfg.telegram || cfg.discord,
    detail: cfg.telegram || cfg.discord ? sources : 'no platform configured — run `metro setup telegram|discord <token>`',
  }];

  const getMeFns = { telegram: () => new TelegramStation().getMe(), discord: () => new DiscordStation().getMe() } as const;
  for (const p of ['telegram', 'discord'] as const) {
    if (!cfg[p]) { checks.push({ name: p, ok: null, detail: 'not configured' }); continue; }
    try { const me = await getMeFns[p](); checks.push({ name: p, ok: true, detail: `getMe → ${p === 'telegram' ? '@' : ''}${me.username}` }); }
    catch (err) { checks.push({ name: p, ok: false, detail: errMsg(err) }); }
  }

  checks.push(dispatcherCheck());
  if (isJson(flags)) process.stdout.write(JSON.stringify({ checks }) + '\n');
  else {
    process.stdout.write('metro doctor\n\n');
    for (const c of checks) process.stdout.write(`  ${c.ok === true ? '✓' : c.ok === false ? '✗' : '–'} ${c.name.padEnd(15)} ${c.detail}\n`);
    process.stdout.write('\n');
  }
  if (checks.some(c => c.ok === false)) throw exitErr('one or more checks failed', 3);
}

function dispatcherCheck(): DoctorCheck {
  const lockFile = join(STATE_DIR, '.tail-lock');
  if (!existsSync(lockFile)) return { name: 'dispatcher', ok: null, detail: 'not running' };
  try {
    const pid = Number(readFileSync(lockFile, 'utf8').trim());
    if (!Number.isInteger(pid) || pid <= 0) throw new Error('invalid pid');
    process.kill(pid, 0); return { name: 'dispatcher', ok: true, detail: `running (pid ${pid})` };
  } catch { return { name: 'dispatcher', ok: null, detail: 'stale lockfile (will auto-reclaim on next start)' }; }
}

async function cmdSend(positional: string[], flags: Flags): Promise<void> {
  const [to, ...rest] = positional;
  if (!to || !rest.length) throw exitErr('usage: metro send <line> <text>', 1);
  loadMetroEnv();
  const { line, messageId } = await sendToLine(to, rest.join(' '));
  emit(flags, `sent ${messageId} to ${line}`, { ok: true, line, messageId });
}

async function cmdStations(flags: Flags): Promise<void> {
  loadMetroEnv();
  const rows = listStations();
  if (isJson(flags)) return void process.stdout.write(JSON.stringify({ stations: rows }) + '\n');
  process.stdout.write('metro stations\n\n');
  for (const s of rows) {
    const mark = s.configured === true ? '✓' : s.configured === false ? '✗' : '·';
    process.stdout.write(`  ${mark} ${s.name.padEnd(10)} ${s.kind.padEnd(6)} ${fmtCapabilities(s.capabilities)}\n        ${s.detail}\n`);
  }
  process.stdout.write('\n');
}

const COMMANDS: Record<string, (positional: string[], flags: Flags) => Promise<void>> = {
  setup: cmdSetup,
  doctor: (_, f) => cmdDoctor(f),
  stations: (_, f) => cmdStations(f),
  lines: (_, f) => cmdLines(isJson(f)),
  send: cmdSend,
  update: (_, f) => cmdUpdate(isJson(f)),
};

async function main(): Promise<void> {
  const cmd = process.argv[2];
  if (cmd === '--version' || cmd === '-v') return void process.stdout.write(`${pkg.version}\n`);
  if (cmd === '--help' || cmd === '-h') return void process.stdout.write(USAGE);
  if (!cmd) { await import('../dispatcher.js'); return; }

  const handler = COMMANDS[cmd];
  if (!handler) { process.stderr.write(`unknown command '${cmd}'\n\n${USAGE}`); process.exit(1); }
  const { positional, flags } = parseArgs(process.argv.slice(3));
  try { await handler(positional, flags); }
  catch (err) {
    const code = (err as ExitErr).code;
    if (isJson(flags)) process.stdout.write(JSON.stringify({ ok: false, error: errMsg(err), code: code ?? 1 }) + '\n'); else process.stderr.write(`error: ${errMsg(err)}\n`);
    process.exit(typeof code === 'number' ? code : 1);
  }
}

await main();
