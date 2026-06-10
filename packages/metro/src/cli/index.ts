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
import { cmdSchema } from './schema-cmd.js';
import {
  cmdDelete, cmdEdit, cmdRead, cmdReact, cmdReply, cmdSend, cmdUnreact,
} from './messaging.js';
import { cmdSessions, cmdWhoami } from './whoami.js';
import { cmdChannel, cmdGroup, cmdDm } from './channels.js';
import {
  flagOne, isJson, parseArgs, writeJson, type ExitErr, type Flags,
} from './util.js';
import { cmdAccount } from './account.js';

/** True if another live process owns the dispatcher lockfile. Mirrors */
/** paths.acquireLock's detection but as a peek — no claim, no exit. */
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
  metro whoami [--json]                       Show the resolved identity: owner URI, account
                                              per station, and the --strict tail command.
  metro session list [--json]                 List sessions.json bindings (read-only).
  metro trains [list]                         List supervised trains (running, pid, fail count).
  metro trains restart <name>                 Kill + respawn a train (resets backoff).
  metro trains new <name>                     Scaffold ~/.metro/trains/<name>.ts from the example.
  metro send <line> <text> [--reply <id>] [--attach <path|url> ...] [--from <session|account>]
                                              Send a message. <text> is inline, '@file', or '-' (stdin).
                                              --from routes outbound via a sessions.json session id or a literal account.
  metro reply <line> <msgId> <text>           Reply to a message (sugar for send --reply).
  metro react <line> <msgId> <emoji>          Add an emoji reaction.
  metro unreact <line> <msgId> <emoji>        Remove an emoji reaction.
  metro edit <line> <msgId> <text>            Edit a previously-sent message.
  metro delete <line> <msgId>                 Delete a message.
  metro read <line> [--limit N] [--before <id>] [--since <ts>]
                                              Read recent messages for a line (live or daemon log).
  metro channel set-github <line> <url|->     Set/clear a channel's linked GitHub URL.
  metro channel set-labels <line> <a,b,c>     Set a channel's labels.
  metro channel meta <line> [--name N] [--description D] [--github U] [--labels a,b]
                                              Update channel name/description/appData.
  metro channel info <line>                   Print group info for a channel.
  metro group new <0xaddr…> [--name N] [--admin-only]
                                              Create a group (themed wrapper for xmtp newGroup).
  metro group close <line>                    Archive a group (remove members).
  metro group add | remove <line> <0xaddr…>   Add/remove group members.
  metro dm <0xaddress> [--account <id>]       Open (or reuse) a DM; prints its line.
  metro board [tail flags]                    Alias of \`metro tail\` (Metro-transit naming).
  metro schema [station] [--json]             Dump the verb registry (human table or JSON). Alias: verbs.
  metro verbs  [station]                       List all registered station/core verbs.
  metro call <train> <action> [args]          Low-level escape hatch: forward an action to a train.
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
  metro account list [<station>]              List configured accounts (id, eth address, key source).
  metro account address [<id>]               Print an account's fundable eth address.
  metro account import <station> <privkey> --id <name>
                                              Import a raw-key account (xmtp), written 0600.
                                              Needs \`metro trains restart <station>\` to take effect.
  metro webhook add <label> [--secret=…]      Register an HTTP receive endpoint (GitHub, Intercom, …).
  metro webhook list | remove <id>            List or remove webhook endpoints.
  metro tunnel setup <name> <hostname>        Configure a Cloudflare named tunnel.
  metro tunnel status                         Show current tunnel config.
  metro update                                Upgrade in place.
  metro --version | --help

Global flags:
  --json                                      Machine-readable output on any command (and on
                                              errors: {"ok":false,"error":…,"code":…}).
                                              Themed verbs (channel/group/dm) wrap success in a
                                              uniform envelope: {"ok":true,"command":…,"result":…}.
  --quiet                                     (themed verbs) print only the result id.

Trains: place \`<name>.ts\` files in ~/.metro/trains/. See \`@metro-labs/metro/examples\`.
Lines: metro://<station>/<path>. Multi-line args: pipe on stdin where supported.
Exit codes: 0 success · 1 usage · 2 config · 3 upstream · 4 daemon not running · 7 rate-limited
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

/** `metro session list` (read-only). Only `list` is supported in this layer — no */
/** mutation commands, so live routing can't change. */
async function cmdSession(p: string[], f: Flags): Promise<void> {
  const sub = p[0] ?? 'list';
  if (sub !== 'list') { process.stderr.write(`unknown 'metro session ${sub}' — only 'list' is supported\n`); process.exit(1); }
  await cmdSessions(p.slice(1), f);
}

const COMMANDS: Record<string, (positional: string[], flags: Flags) => Promise<void>> = {
  setup: cmdSetup, doctor: cmdDoctor, lines: cmdLines,
  whoami: cmdWhoami, session: cmdSession,
  call: cmdCall, trains: cmdTrains,
  send: cmdSend, reply: cmdReply, react: cmdReact, unreact: cmdUnreact,
  edit: cmdEdit, delete: cmdDelete, read: cmdRead,
  webhook: cmdWebhook, tunnel: cmdTunnel,
  history: cmdHistory, tail: cmdTail,
  claim: cmdClaim, release: cmdRelease, claims: cmdClaims,
  account: cmdAccount,
  update: cmdUpdate,
  // Themed porcelain verbs (migration step 5): first-class noun-verb commands,
  // thin wrappers over the existing xmtp actions. Additive — `metro call` stays.
  channel: cmdChannel, group: cmdGroup, dm: cmdDm,
  // Metro-transit naming alias: `board` reads the same feed as `tail`.
  board: cmdTail,
  schema: cmdSchema, verbs: cmdSchema,
};

async function main(): Promise<void> {
  const cmd = process.argv[2];
  if (cmd === '--version' || cmd === '-v') return void process.stdout.write(`${pkg.version}\n`);
  if (cmd === '--help' || cmd === '-h') return void process.stdout.write(USAGE);
  if (!cmd) {
    /** Single-instance: a healthy daemon already owns the dispatcher socket. */
    /** A second `metro` must NOT start a competing dispatcher (two daemons */
    /** thrashing the socket+trains). Attach the caller to the EXISTING daemon. */
    if (anotherDispatcherRunning()) {
      /** Codex host → run the standalone Codex bridge so its CLI receives its */
      /** own (filtered) feed without a second dispatcher. */
      if (process.env.METRO_CODEX_RC) {
        log.info({}, 'dispatcher already running; attaching Codex bridge to it (no second daemon)');
        const { runCodexBridge } = await import('../codex-rc/bridge.js');
        await runCodexBridge(process.env.METRO_CODEX_RC);
        return;
      }
      /** Otherwise (e.g. Claude) drop into tail mode — claim-aware, own feed. */
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
    const command = (err as ExitErr).command;
    if (isJson(flags)) {
      // Themed verbs carry their `command` tag → uniform {ok,command,error,code}
      // envelope. Legacy commands keep the original {ok,error,code} shape so
      // existing scripts parsing them are unaffected.
      writeJson(command
        ? { ok: false, command, error: errMsg(err), code: code ?? 1 }
        : { ok: false, error: errMsg(err), code: code ?? 1 });
    } else process.stderr.write(`error: ${errMsg(err)}\n`);
    process.exit(typeof code === 'number' ? code : 1);
  }
}

await main();
