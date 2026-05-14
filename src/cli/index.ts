#!/usr/bin/env node
/** Metro CLI entry: parses argv, dispatches to subcommands, owns action + info commands. */

import pkg from '../../package.json' with { type: 'json' };
import { errMsg } from '../log.js';
import { listLines } from '../cache.js';
import { fmtCapabilities, listStations } from '../stations/index.js';
import { listAgents } from '../registry.js';
import { loadMetroEnv } from '../paths.js';
import { readHistory, type HistoryKind } from '../history.js';
import { cmdDoctor, cmdSetup, cmdUpdate } from './config.js';
import {
  cmdDownload, cmdEdit, cmdFetch, cmdReact, cmdReply, cmdSend,
} from './actions.js';
import {
  flagOne, isJson, parseArgs, writeJson, type ExitErr, type Flags,
} from './util.js';

const USAGE = `metro — Telegram + Discord stream for your Claude Code / Codex agent

Usage:
  metro                                       Run the dispatcher (emits JSON events on stdout).
  metro setup [telegram|discord <token>]      Save token, or show status with no args.
  metro setup clear [telegram|discord|all]    Remove tokens.
  metro setup skill [clear]                   Install the metro skill into ~/.claude / ~/.codex.
  metro doctor                                Health check.
  metro stations                              List stations + capabilities.
  metro lines                                 List recently-seen conversations.
  metro send <line> <text> [--image=<path>]… [--document=<path>]… [--voice=<path>] [--buttons=<json>]
                                              Post a fresh message; repeat --image/--document for multi-file albums.
  metro reply <line> <message_id> <text> [--image=… --document=… --voice=… --buttons=…]
                                              Threaded reply (same flags as send).
  metro edit <line> <message_id> <text> [--buttons=<json>]
                                              Edit a previously-sent message (text + buttons).
  metro react <line> <message_id> <emoji>     Set or clear ('') a reaction.
  metro download <line> <message_id> [--out=<dir>]
                                              Download image attachments to disk.
  metro fetch <line> [--limit=N]              Recent-message lookback (Discord only).
  metro history [--limit=N] [--line=…] [--station=…] [--kind=…] [--from=…] [--text=…] [--since=…]
                                              Read the universal message log (newest first).
  metro update                                Upgrade in place.
  metro --version | --help

Lines: metro://<station>/<path>. See docs/uri-scheme.md.
Multi-line --text: pipe on stdin in place of the positional arg.
Exit codes: 0 success · 1 usage · 2 config · 3 upstream
`;

async function cmdStations(_: string[], f: Flags): Promise<void> {
  loadMetroEnv();
  const rows = listStations();
  const agentsByStation = {
    claude: listAgents('claude'),
    codex: listAgents('codex'),
  };
  if (isJson(f)) return writeJson({ stations: rows, agents: agentsByStation });
  process.stdout.write('metro stations\n\n');
  for (const s of rows) {
    const mark = s.configured === true ? '✓' : s.configured === false ? '✗' : '·';
    process.stdout.write(
      `  ${mark} ${s.name.padEnd(10)} ${s.kind.padEnd(6)} ${fmtCapabilities(s.capabilities)}\n        ${s.detail}\n`,
    );
    if (s.kind === 'agent') {
      const seen = agentsByStation[s.name as 'claude' | 'codex'] ?? [];
      for (const inst of seen) {
        const sessionsTxt = inst.sessions.length ? ` · sessions: ${inst.sessions.length}` : '';
        process.stdout.write(`          seen: ${inst.agentId}${sessionsTxt}\n`);
      }
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
    kind: flagOne(f, 'kind') as HistoryKind | undefined,
    from: flagOne(f, 'from'),
    textContains: flagOne(f, 'text'),
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

/** Compact display: fromName if known; else `station:@<id>` (user), `station:bot`, or `station:<id>`. */
function fmtActor(uri: string, name?: string): string {
  if (name) return name;
  const m = uri.match(/^metro:\/\/([^/]+)(?:\/(?:(user|bot)\/)?(.*))?$/);
  if (!m) return uri;
  const [, station, kind, rest] = m;
  if (kind === 'bot') return `${station}:bot`;
  if (kind === 'user') return `${station}:@${shortId(rest ?? '')}`;
  return rest ? `${station}:${shortId(rest)}` : station;
}
const shortId = (s: string): string => s.length <= 12 ? s : `${s.slice(0, 5)}…${s.slice(-4)}`;
const pad = (s: string, n: number): string => (s.length > n ? `${s.slice(0, n - 1)}…` : s.padEnd(n));

const COMMANDS: Record<string, (positional: string[], flags: Flags) => Promise<void>> = {
  setup: cmdSetup, doctor: cmdDoctor, stations: cmdStations, lines: cmdLines,
  send: cmdSend, reply: cmdReply, edit: cmdEdit, react: cmdReact,
  download: cmdDownload, fetch: cmdFetch,
  history: cmdHistory, update: cmdUpdate,
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
    if (isJson(flags)) writeJson({ ok: false, error: errMsg(err), code: code ?? 1 });
    else process.stderr.write(`error: ${errMsg(err)}\n`);
    process.exit(typeof code === 'number' ? code : 1);
  }
}

await main();
