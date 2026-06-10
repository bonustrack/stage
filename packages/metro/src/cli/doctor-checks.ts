/** `metro doctor` real-world failure checks: each turns a tribal operational failure mode into a */
/** pass/warn/fail line with the EXACT fix on failure. Read-only (never mutates) + fast (<5s, short */
/** timeouts, degrade offline). Pure primitives are exported for FS-mocked tests; live probes skipped there. */

import { spawnSync } from 'node:child_process';
import { accessSync, constants, existsSync, readFileSync, statSync } from 'node:fs';
import { createConnection } from 'node:net';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { STATE_DIR, envSources, readDotenv } from '../paths.js';

/** A check is pass (true) / warn (null) / fail (false). On fail, `fix` prints the exact command. */
export type Status = 'pass' | 'warn' | 'fail';
export type Check = { name: string; status: Status; detail: string; fix?: string };

export const pass = (name: string, detail: string): Check => ({ name, status: 'pass', detail });
export const warn = (name: string, detail: string, fix?: string): Check => ({ name, status: 'warn', detail, ...(fix ? { fix } : {}) });
export const fail = (name: string, detail: string, fix: string): Check => ({ name, status: 'fail', detail, fix });

/* ──────────── file / permission primitives (pure, FS-mockable) ──────────── */

/** Octal permission bits (e.g. 0o600) of a file, or null if it does not exist / is unreadable. */
export function fileMode(path: string): number | null {
  try { return statSync(path).mode & 0o777; } catch { return null; }
}

/** True when the file is at most 0600 (owner rw, nothing for group/other). */
export const isLockedDown = (mode: number): boolean => (mode & 0o077) === 0;

export const octal = (mode: number): string => '0' + mode.toString(8).padStart(3, '0');

/** Count newline-delimited non-empty records in a JSONL file (0 if missing/unreadable). */
export function countLines(path: string): number {
  try {
    const raw = readFileSync(path, 'utf8');
    if (!raw) return 0;
    return raw.split('\n').filter(l => l.trim().length > 0).length;
  } catch { return 0; }
}

/* ──────────── env-precedence primitive (pure, FS-mockable) ──────────── */

export type EnvOrigin = { value: string; label: string; path: string };
/** Which env file (in precedence order) defines each key, and whether it is shadowed. */
export type EnvResolution = {
  /** The winning origin per key (first source that sets it). */
  winner: Record<string, EnvOrigin>;
  /** Keys defined in more than one source — the shadowed (losing) origins. */
  shadowed: Record<string, EnvOrigin[]>;
};

/** Resolve env keys across the documented source files (process.env NOT consulted — we want
 *  to report file precedence, which is the tribal confusion: ~/.metro/.env vs $CONFIG/.env). */
export function resolveEnv(keys: string[]): EnvResolution {
  const sources = envSources().map(s => ({ ...s, vars: readDotenv(s.path) }));
  const winner: Record<string, EnvOrigin> = {};
  const shadowed: Record<string, EnvOrigin[]> = {};
  for (const key of keys) {
    const hits = sources.filter(s => s.vars[key] !== undefined)
      .map(s => ({ value: s.vars[key], label: s.label, path: s.path }));
    if (hits.length) {
      winner[key] = hits[0];
      if (hits.length > 1) shadowed[key] = hits.slice(1);
    }
  }
  return { winner, shadowed };
}

/* ──────────── required creds per train (data, pure) ──────────── */

/** Tribal credential precedence: which keys each train needs. `optional` ⇒ warn (not fail) when absent. */
export const REQUIRED_CREDS: Array<{ key: string; train: string; optional?: boolean }> = [
  { key: 'DISCORD_BOT_TOKEN', train: 'discord' },
  { key: 'TELEGRAM_BOT_TOKEN', train: 'telegram' },
  { key: 'EXPO_TOKEN', train: 'eas/build', optional: true },
  { key: 'GITHUB_TOKEN', train: 'github', optional: true },
];

/** Files that must be 0600 (private keys / mnemonics). */
export const SECRET_FILES = (): Array<{ label: string; path: string }> => [
  { label: 'xmtp-accounts.json', path: join(STATE_DIR, 'xmtp-accounts.json') },
];

/* ──────────── named-tunnel + FCM-push paths (data) ──────────── */

export type TunnelProbe = { name: string; url: string; localPort: number };
export const TUNNELS: TunnelProbe[] = [
  { name: 'bundler', url: 'https://bundler.metro.box', localPort: 8081 },
  { name: 'apk', url: 'https://apk.metro.box', localPort: 8082 },
];
export const tunnelFix = (t: TunnelProbe): string =>
  `cloudflared tunnel run --url http://127.0.0.1:${t.localPort} ${t.name}`;

export const FCM_SERVICE_ACCOUNT = (): string => join(homedir(), '.config', 'metro', 'firebase-service-account.json');
export const PUSH_TOKENS_FILE = (): string => join(homedir(), '.cache', 'metro', 'xmtp-push-tokens.json');

/** Count push tokens in xmtp-push-tokens.json (supports array, {tokens:[]}, or object map shapes). */
export function countPushTokens(path: string): number | null {
  try {
    const data = JSON.parse(readFileSync(path, 'utf8')) as unknown;
    if (Array.isArray(data)) return data.length;
    if (data && typeof data === 'object') {
      const obj = data as Record<string, unknown>;
      if (Array.isArray(obj.tokens)) return obj.tokens.length;
      return Object.keys(obj).length;
    }
    return 0;
  } catch { return null; }
}

/* ──────────── live probes (skipped in tests) ──────────── */

/** HEAD/GET an URL with a short timeout. Returns the HTTP status, or null when unreachable/offline.
 *  Cloudflare returns 530 when the named tunnel's origin is down — the canonical "tunnel down" signal. */
export async function httpStatus(url: string, timeoutMs = 2500): Promise<number | null> {
  try {
    const res = await fetch(url, { method: 'GET', redirect: 'manual', signal: AbortSignal.timeout(timeoutMs) });
    return res.status;
  } catch { return null; }
}

/** Probe a unix socket for reachability (connect + immediate close). */
export function socketReachable(path: string, timeoutMs = 1500): Promise<boolean> {
  return new Promise(resolve => {
    if (!existsSync(path)) { resolve(false); return; }
    const sock = createConnection({ path });
    const done = (ok: boolean): void => { clearTimeout(timer); sock.destroy(); resolve(ok); };
    const timer = setTimeout(() => done(false), timeoutMs);
    sock.on('connect', () => done(true));
    sock.on('error', () => done(false));
  });
}

/** True if any local process command line matches the cloudflared run for `name`. Best-effort,
 *  read-only; returns null when `pgrep` is unavailable (degrade gracefully, don't fail the check). */
export function tunnelProcessRunning(name: string): boolean | null {
  try {
    const r = spawnSync('pgrep', ['-f', `cloudflared.*${name}`], { encoding: 'utf8' });
    if (r.error) return null;
    return r.status === 0 && r.stdout.trim().length > 0;
  } catch { return null; }
}

/* ──────────── check builders (group 1–5) ──────────── */

export type ProbeOpts = {
  /** Skip live HTTP/socket/process probes (tests + offline). */
  skipLive?: boolean;
  /** Resolver for the running daemon's reported version (null ⇒ unknown / predates probe). */
  daemonVersion?: () => Promise<string | null>;
  /** Installed package version, to detect a restart-pending mismatch. */
  installedVersion?: string;
};

/** 1. TUNNELS — named cloudflared tunnels: local process + public URL reachability. */
export async function tunnelChecks(o: ProbeOpts): Promise<Check[]> {
  if (o.skipLive) return [];
  return Promise.all(TUNNELS.map(async t => {
    const proc = tunnelProcessRunning(t.name);
    const status = await httpStatus(t.url);
    const name = `tunnel:${t.name}`;
    if (status === null && proc !== true) return warn(name, `${t.url} unreachable (offline?) · no local cloudflared`, tunnelFix(t));
    if (status === 530) return fail(name, `${t.url} → 530 (tunnel origin down)`, tunnelFix(t));
    if (status === null) return warn(name, `${t.url} unreachable (offline?)`, tunnelFix(t));
    if (status >= 200 && status < 500) return pass(name, `${t.url} → ${status}${proc === false ? ' (no local process — remote origin)' : ''}`);
    return warn(name, `${t.url} → ${status}`, tunnelFix(t));
  }));
}

/** 2. FCM PUSH — firebase service account + push tokens file + token count. */
export function fcmChecks(): Check[] {
  const out: Check[] = [];
  const sa = FCM_SERVICE_ACCOUNT();
  out.push(existsSync(sa)
    ? pass('fcm:service-account', sa)
    : warn('fcm:service-account', `${sa} missing (push fan-out disabled)`,
      `place the Firebase service-account JSON at ${sa}`));
  const tok = PUSH_TOKENS_FILE();
  const count = countPushTokens(tok);
  if (count === null) {
    out.push(warn('fcm:push-tokens', `${tok} missing/unreadable (no devices registered yet)`,
      'register a device from the app to populate push tokens'));
  } else if (count === 0) {
    out.push(warn('fcm:push-tokens', `${tok} has 0 tokens (push silently off)`,
      'register a device from the app, or check the token-registration webhook'));
  } else {
    out.push(pass('fcm:push-tokens', `${count} token${count === 1 ? '' : 's'}`));
  }
  return out;
}

/** 3. ENV / CREDS — required keys per train, with env-precedence (which file wins) surfaced. */
export function credChecks(): Check[] {
  const out: Check[] = [];
  const keys = REQUIRED_CREDS.map(c => c.key);
  const res = resolveEnv(keys);
  for (const { key, train, optional } of REQUIRED_CREDS) {
    const fromEnv = process.env[key];
    const origin = res.winner[key];
    const shadow = res.shadowed[key];
    const where = origin
      ? `${origin.label}${shadow ? ` (shadows ${shadow.map(s => s.label).join(', ')})` : ''}`
      : fromEnv ? 'process.env' : null;
    const name = `cred:${key}`;
    if (where) out.push(pass(name, `${train} — set via ${where}`));
    else if (optional) out.push(warn(name, `${train} — unset (feature disabled)`,
      `export ${key}=… in ~/.metro/.env`));
    else out.push(fail(name, `${train} — required but unset`,
      `add ${key}=… to ~/.metro/.env`));
  }
  return out;
}

/** 4 & 5. STATE HEALTH + PERMS — history, outbox dead-letters, secret-file perms, daemon version. */
export async function stateChecks(o: ProbeOpts): Promise<Check[]> {
  const out: Check[] = [];

  // history.jsonl writable + size sanity
  const history = join(STATE_DIR, 'history.jsonl');
  if (!existsSync(history)) {
    out.push(warn('state:history', `${history} not created yet`, 'start the daemon with `metro` to create it'));
  } else {
    let writable = true;
    try { accessSync(history, constants.W_OK); }
    catch { writable = false; }
    let size = 0; try { size = statSync(history).size; } catch { /* ignore */ }
    const mb = (size / 1e6).toFixed(1);
    if (!writable) out.push(fail('state:history', `${history} NOT writable`, `chmod u+w ${history}`));
    else if (size > 500e6) out.push(warn('state:history', `${mb}MB — large, consider rotating`, `rotate/archive ${history}`));
    else out.push(pass('state:history', `${mb}MB, writable`));
  }

  // outbox dead-letters (additive — just count if the file exists)
  const outbox = join(STATE_DIR, 'outbox.jsonl');
  if (existsSync(outbox)) {
    const dead = countLines(outbox);
    out.push(dead > 0
      ? warn('state:outbox', `${dead} undelivered/dead-letter entr${dead === 1 ? 'y' : 'ies'}`,
        `inspect ${outbox} for stuck sends`)
      : pass('state:outbox', 'no dead-letters'));
  }

  // secret-file perms (0600)
  for (const { label, path } of SECRET_FILES()) {
    if (!existsSync(path)) continue;
    const mode = fileMode(path);
    if (mode === null) continue;
    out.push(isLockedDown(mode)
      ? pass(`perm:${label}`, `${octal(mode)}`)
      : fail(`perm:${label}`, `${octal(mode)} too permissive (must be 0600)`, `chmod 600 ${path}`));
  }

  // daemon socket reachable + version / restart-pending
  if (!o.skipLive) {
    const sockPath = join(STATE_DIR, 'metro.sock');
    const up = await socketReachable(sockPath);
    if (!up) {
      out.push(warn('daemon:socket', 'metro daemon not reachable', 'start it with `metro`'));
    } else {
      const running = o.daemonVersion ? await o.daemonVersion() : null;
      const installed = o.installedVersion;
      if (running && installed && running !== installed) {
        out.push(warn('daemon:version', `running ${running} ≠ installed ${installed} (restart pending)`,
          'restart the daemon to pick up the new code (Less does this — never auto-restart)'));
      } else if (running) {
        out.push(pass('daemon:version', `running ${running}`));
      } else {
        out.push(pass('daemon:socket', 'reachable (version probe unsupported — predates this build)'));
      }
    }
  }

  return out;
}

/** Assemble all real-world failure checks (groups 1–5). */
export async function runFailureChecks(o: ProbeOpts = {}): Promise<Check[]> {
  const [tunnels, state] = await Promise.all([tunnelChecks(o), stateChecks(o)]);
  return [...tunnels, ...fcmChecks(), ...credChecks(), ...state];
}
