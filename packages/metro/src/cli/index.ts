#!/usr/bin/env bun
/** Metro CLI: parses argv, dispatches to subcommands. Bun runtime required (uses Bun.spawn for trains). */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import pkg from '../../package.json' with { type: 'json' };
import { errMsg, log } from '../log.js';
import { listLines, loadMetroEnv, STATE_DIR } from '../paths.js';
import { readHistory } from '../history.js';
import { cmdDoctor, cmdSetup, cmdUpdate } from './config.js';
import { cmdClaim, cmdClaims, cmdRelease, cmdTail } from './tail.js';
import { cmdCall, cmdTrains, cmdTunnel, cmdWebhook } from './webhook.js';
import {
  flagOne, isJson, parseArgs, writeJson, type ExitErr, type Flags,
} from './util.js';

/** True if another live process owns the dispatcher lockfile. Mirrors
 *  paths.acquireLock's detection but as a peek — no claim, no exit. */
function anotherDispatcherRunning(): boolean {
  const lockFile = join(STATE_DIR, '.tail-lock');
  if (!existsSync(lockFile)) return false;
  const pid = Number(readFileSync(lockFile, 'utf8').trim());
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try { process.kill(pid, 0); return true; } catch { return false; }
}

const USAGE = `metro — event-interception wire. Trains in ~/.metro/trains/ produce events;
metro multiplexes them onto stdout. Outbound action calls flow back via \`metro call\`.

Usage:
  metro                                       Run the dispatcher (emits JSON events on stdout).
                                              If a dispatcher is already running, bare \`metro\`
                                              instead attaches as a live reader (tail --follow
                                              --json --since=tail) so a second agent can subscribe.
  metro setup                                 Print config status (credentials are owned by trains).
  metro setup skill [clear]                   Install/remove the metro skill into ~/.claude / ~/.codex.
  metro doctor                                Health check.
  metro lines                                 List recently-seen conversations.
  metro trains [list]                         List supervised trains (running, pid, fail count).
  metro trains restart <name>                 Kill + respawn a train (resets backoff).
  metro trains new <name>                     Scaffold ~/.metro/trains/<name>.ts from the example.
  metro call <train> <action> [args]          Forward an action call to a train via its stdin.
                                              [args] is JSON, '@file', '-' (stdin), or a bare string.
  metro history [--limit=N] [--line=…] [--station=…] [--from=…] [--text=…] [--since=…]
                                              Read the universal message log (newest first).
  metro tail [--as=<user-uri>] [--follow] [--strict | --unclaimed | --all] [--include-webhooks]
             [--chat=<line>] [--station=…] [--since=<offset|tail>] [--limit=N]
                                              Subscribe to the event log; claim-aware by default.
                                              --since: byte offset, or 'tail' for EOF (live only).
                                              Default (omitted) resumes from this reader's saved
                                              cursor. NB: the SSE /api/tail endpoint shares the
                                              flag name but defaults to EOF, not the cursor.
  metro claim <line> [--as=<user-uri>]        Take exclusive ownership of a line.
  metro release <line>                        Release a line (it returns to broadcast).
  metro claims                                Print the current claims map.
  metro webhook add <label> [--secret=…]      Register an HTTP receive endpoint (GitHub, Intercom, …).
  metro webhook list | remove <id>            List or remove webhook endpoints.
  metro tunnel setup <name> <hostname>        Configure a Cloudflare named tunnel.
  metro tunnel status                         Show current tunnel config.
  metro update                                Upgrade in place.
  metro --version | --help

Global flags:
  --json                                      Machine-readable output on any command (and on
                                              errors: {"ok":false,"error":…,"code":…}).

Trains: place \`<name>.ts\` files in ~/.metro/trains/. See \`@metro-labs/metro/examples\`.
Lines: metro://<station>/<path>. Multi-line args: pipe on stdin where supported.
Exit codes: 0 success · 1 usage · 2 config · 3 upstream · 4 daemon not running
`;

async function cmdLines(_: string[], f: Flags): Promise<void> {
  loadMetroEnv();
  const rows = listLines()
    .map(({ line, entry }) => ({ line, name: entry.name ?? null, lastSeenAt: entry.lastSeenAt ?? null }))
    .sort((a, b) => (b.lastSeenAt ?? '').localeCompare(a.lastSeenAt ?? ''));
  if (isJson(f)) return writeJson({ lines: rows });
  if (!rows.length) return void process.stdout.write('metro lines\n\n  (none yet — start the dispatcher and send a message)\n\n');
  const widest = Math.max(...rows.map(r => r.line.length));
  process.stdout.write('metro lines\n\n');
  for (const r of rows) {
    const when = r.lastSeenAt ? humanAgo(r.lastSeenAt) : '—';
    const tag = r.name ? `  ${r.name.slice(0, 40)}${r.name.length > 40 ? '…' : ''}` : '';
    process.stdout.write(`  ${when.padEnd(10)} ${r.line.padEnd(widest)}${tag}\n`);
  }
  process.stdout.write('\n');
}

function humanAgo(iso: string): string {
  const sec = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (sec < 60) return `${sec}s ago`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  return `${Math.floor(sec / 86400)}d ago`;
}

async function cmdHistory(_: string[], f: Flags): Promise<void> {
  loadMetroEnv();
  const since = flagOne(f, 'since');
  const entries = readHistory({
    line: flagOne(f, 'line'),
    station: flagOne(f, 'station'),
    from: flagOne(f, 'from'),
    textContains: flagOne(f, 'text'),
    since: since ? new Date(since) : undefined,
    limit: Number(flagOne(f, 'limit')) || 50,
  });
  if (isJson(f)) return writeJson({ entries });
  if (!entries.length) { process.stdout.write('(no matching history entries)\n'); return; }
  process.stdout.write('time      id            from                      → to                        body\n');
  for (const e of entries.reverse()) {
    const ts = e.ts.slice(11, 19);
    const from = pad(fmtActor(e.from, e.fromName), 24);
    const to = pad(fmtActor(e.to), 24);
    const body = e.text ?? '';
    const text = body.length > 60 ? body.slice(0, 59) + '…' : body;
    process.stdout.write(`${ts}  ${e.id.padEnd(12)}  ${from} → ${to}  ${text}\n`);
  }
}

/** Compact display: fromName if known; else `station:@<id>` (user) or `station:<id>`. */
function fmtActor(uri: string, name?: string): string {
  if (name) return name;
  const m = uri.match(/^metro:\/\/([^/]+)(?:\/(?:(user)\/)?(.*))?$/);
  if (!m) return uri;
  const [, station, kind, rest] = m;
  if (kind === 'user') return `${station}:@${shortId(rest ?? '')}`;
  return rest ? `${station}:${shortId(rest)}` : station;
}
const shortId = (s: string): string => s.length <= 12 ? s : `${s.slice(0, 5)}…${s.slice(-4)}`;
const pad = (s: string, n: number): string => (s.length > n ? `${s.slice(0, n - 1)}…` : s.padEnd(n));

const COMMANDS: Record<string, (positional: string[], flags: Flags) => Promise<void>> = {
  setup: cmdSetup, doctor: cmdDoctor, lines: cmdLines,
  call: cmdCall, trains: cmdTrains,
  webhook: cmdWebhook, tunnel: cmdTunnel,
  history: cmdHistory, tail: cmdTail,
  claim: cmdClaim, release: cmdRelease, claims: cmdClaims,
  update: cmdUpdate,
};

async function main(): Promise<void> {
  const cmd = process.argv[2];
  if (cmd === '--version' || cmd === '-v') return void process.stdout.write(`${pkg.version}\n`);
  if (cmd === '--help' || cmd === '-h') return void process.stdout.write(USAGE);
  if (!cmd) {
    /** Multi-agent: another `metro` already owns the dispatcher → drop
     *  into tail mode so a second agent (e.g. Codex while Claude is
     *  running) still gets the event stream. */
    if (anotherDispatcherRunning()) {
      log.info({}, 'dispatcher already running; subscribing as tail (--follow --json --since=tail)');
      await cmdTail([], { follow: true, json: true, since: 'tail' });
      return;
    }
    await import('../dispatcher.js');
    return;
  }

  const handler = COMMANDS[cmd];
  if (!handler) { process.stderr.write(`unknown command '${cmd}'\n\n${USAGE}`); process.exit(1); }
  const { positional, flags } = parseArgs(process.argv.slice(3));
  try { await handler(positional, flags); }
  catch (err) {
    const code = (err as ExitErr).code;
    if (isJson(flags)) writeJson({ ok: false, error: errMsg(err), code: code ?? 1 });
    else process.stderr.write(`error: ${errMsg(err)}\n`);
    process.exit(typeof code === 'number' ? code : 1);
  }
}

await main();
