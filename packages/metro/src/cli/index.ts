#!/usr/bin/env node
/** CLI entry: known subcommands + the generic `metro <station> <action> <args>` catch-all. */

import pkg from '../../package.json' with { type: 'json' };
import { Client } from '../client.js';
import { errMsg } from '../log.js';
import { listLines } from '../cache.js';
import { listUsers } from '../registry.js';
import { loadMetroEnv } from '../paths.js';
import { readHistory, type HistoryKind } from '../history.js';
import { cmdDoctor, cmdSetup, cmdUpdate } from './config.js';
import { cmdCall } from './call.js';
import { cmdClaim, cmdClaims, cmdRelease, cmdTail } from './tail.js';
import { cmdTunnel, cmdWebhook } from './webhook.js';
import {
  flagOne, isJson, parseArgs, writeJson, type ExitErr, type Flags,
} from './util.js';

const USAGE = `metro — pluggable bridge between chat/webhook platforms and your local Claude/Codex session

Usage:
  metro                                       Run the dispatcher (emits JSON envelopes on stdout).
  metro <station> <action> [args]             Invoke any station action. args = JSON | @file | -.
                                              e.g. metro discord reply '{"line":"…","messageId":"…","text":"hi"}'
                                              e.g. metro gmail send '{"to":"a@b","subject":"…","body":"…"}'
                                              e.g. metro github comment '{"repo":"x/y","issue":42,"body":"…"}'
  metro stations                              List discovered stations + actions.
  metro setup [telegram|discord <token>]      Save token, or show status.
  metro setup clear [telegram|discord|all]    Remove tokens.
  metro setup skill [clear]                   Install the metro skill into ~/.claude / ~/.codex.
  metro doctor                                Health check.
  metro lines                                 List recently-seen conversations.
  metro history [--limit=N] [--line=…] [--station=…] [--kind=…] [--from=…] [--text=…] [--since=…]
                                              Read the universal message log (newest first).
  metro tail [--as=<user-uri>] [--follow] [--strict | --unclaimed | --all] [--include-webhooks]
             [--chat=<line>] [--station=…] [--since=<offset|tail>] [--limit=N]
                                              Subscribe to the event log.
  metro claim <line> [--as=<user-uri>]        Take exclusive ownership.
  metro release <line>                        Release a line.
  metro claims                                Print the current claims map.
  metro webhook add <label> [--secret=…]      Register an HTTP receive endpoint.
  metro webhook list | remove <id>            List or remove webhook endpoints.
  metro tunnel setup <name> <hostname>        Configure a Cloudflare named tunnel.
  metro tunnel status                         Show current tunnel config.
  metro update                                Upgrade in place.
  metro --version | --help

Lines: metro://<station>/<path>. See docs/uri-scheme.md.
Args: JSON object string, @path/to/file, or - (stdin).
Exit codes: 0 success · 1 usage · 2 config · 3 upstream
`;

async function cmdStations(_: string[], f: Flags): Promise<void> {
  loadMetroEnv();
  const client = new Client();
  await client.load();
  const rows = client.stations();
  const usersByStation = { claude: listUsers('claude'), codex: listUsers('codex') };
  if (isJson(f)) return writeJson({ stations: rows, users: usersByStation });
  process.stdout.write('metro stations\n\n');
  for (const s of rows) {
    const mark = s.configured ? '✓' : '·';
    const actions = s.actions.length ? `  · actions: ${s.actions.join(', ')}` : '  · (receive-only)';
    process.stdout.write(`  ${mark} ${s.name.padEnd(12)}${actions}\n`);
    const seen = (usersByStation as Record<string, typeof usersByStation.claude>)[s.name] ?? [];
    for (const inst of seen) {
      const sessionsTxt = inst.sessions.length ? ` · sessions: ${inst.sessions.length}` : '';
      process.stdout.write(`          seen: ${inst.userId}${sessionsTxt}\n`);
    }
  }
  process.stdout.write('\n');
}

async function cmdLines(_: string[], f: Flags): Promise<void> {
  loadMetroEnv();
  const rows = listLines()
    .map(({ line, entry }) => ({ line, name: entry.name ?? null, lastSeenAt: entry.lastSeenAt ?? null }))
    .sort((a, b) => (b.lastSeenAt ?? '').localeCompare(a.lastSeenAt ?? ''));
  if (isJson(f)) return writeJson({ lines: rows });
  if (!rows.length) return void process.stdout.write('metro lines\n\n  (none yet — start the dispatcher)\n\n');
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
    line: flagOne(f, 'line'), station: flagOne(f, 'station'),
    kind: flagOne(f, 'kind') as HistoryKind | undefined,
    from: flagOne(f, 'from'), textContains: flagOne(f, 'text'),
    since: since ? new Date(since) : undefined,
    limit: Number(flagOne(f, 'limit')) || 50,
  });
  if (isJson(f)) return writeJson({ entries });
  if (!entries.length) { process.stdout.write('(no matching history entries)\n'); return; }
  process.stdout.write('time      id            kind          from                      → to                        body\n');
  for (const e of entries.reverse()) {
    const ts = e.ts.slice(11, 19);
    const from = pad(fmtActor(e.from, e.fromName), 24);
    const to = pad(fmtActor(e.to), 24);
    const body = e.text ?? (e.emoji ? `[react ${e.emoji}]` : '');
    const text = body.length > 60 ? body.slice(0, 59) + '…' : body;
    process.stdout.write(`${ts}  ${e.id.padEnd(12)}  ${e.kind.padEnd(12)}  ${from} → ${to}  ${text}\n`);
  }
}

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
  setup: cmdSetup, doctor: cmdDoctor, stations: cmdStations, lines: cmdLines,
  webhook: cmdWebhook, tunnel: cmdTunnel,
  history: cmdHistory, tail: cmdTail,
  claim: cmdClaim, release: cmdRelease, claims: cmdClaims,
  update: cmdUpdate,
};

async function main(): Promise<void> {
  const cmd = process.argv[2];
  if (cmd === '--version' || cmd === '-v') return void process.stdout.write(`${pkg.version}\n`);
  if (cmd === '--help' || cmd === '-h') return void process.stdout.write(USAGE);
  if (!cmd) { await import('../dispatcher.js'); return; }

  const handler = COMMANDS[cmd];
  if (handler) {
    const { positional, flags } = parseArgs(process.argv.slice(3));
    try { await handler(positional, flags); }
    catch (err) {
      const code = (err as ExitErr).code;
      if (isJson(flags)) writeJson({ ok: false, error: errMsg(err), code: code ?? 1 });
      else process.stderr.write(`error: ${errMsg(err)}\n`);
      process.exit(typeof code === 'number' ? code : 1);
    }
    return;
  }

  /** Catch-all: `metro <station> <action> [args]`. */
  const action = process.argv[3];
  if (!action) { process.stderr.write(`unknown command '${cmd}'\n\n${USAGE}`); process.exit(1); }
  const { positional, flags } = parseArgs(process.argv.slice(4));
  try { await cmdCall(cmd, action, positional, flags); }
  catch (err) {
    const code = (err as ExitErr).code;
    if (isJson(flags)) writeJson({ ok: false, error: errMsg(err), code: code ?? 1 });
    else process.stderr.write(`error: ${errMsg(err)}\n`);
    process.exit(typeof code === 'number' ? code : 1);
  }
}

await main();
