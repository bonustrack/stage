/** Snapshot butler/support agent: subscribes to every messenger channel it's a member of,
 *  decides whether/when to reply, and composes a reply grounded in docs.snapshot.org.
 *
 *  v1 reply policy:
 *  - Solo channel (member set has ≤ 2 entries — me + 1 user): reply immediately.
 *  - Multi-party channel (≥ 3 entries): wait `AGENT_REPLY_DELAY_S` (default 600)
 *    for a human reply; only respond if none lands. Once a human DOES respond, stay
 *    silent on this thread until the user pings again.
 *
 *  LLM call: see TODO at the bottom — generates a stub response in this PR. */

import { drainTail, followTail, historySize, type TailOpts } from '../broker/history-stream.js';
import { hasMembership, readMembers } from '../broker/members.js';
import type { HistoryEntry } from '../history.js';
import { asLine } from '../lines.js';
import { errMsg, log } from '../log.js';
import { retrieve } from './snapshot-docs.js';

const AGENT_URI = asLine('metro://agent/snapshot');
const REPLY_DELAY_S = Number(process.env.AGENT_REPLY_DELAY_S ?? '600');
const MESSENGER_CHANNEL_PREFIX = 'metro://messenger/channel/';

interface PendingReply {
  /** scheduled-at timestamp; if a human replies before this, cancel. */
  fireAt: number;
  timer: ReturnType<typeof setTimeout>;
}

/** Per-channel: id of the message we're waiting on, so a human reply to it cancels us. */
const pending = new Map<string, PendingReply & { sourceMsgId: string }>();

/** Hit the daemon's /api/messenger/send as the agent. Admin token (METRO_MONITOR_TOKEN) only
 *  for now — when channels-aware auth is fully wired, the agent will use a JWT instead. */
async function sendReply(daemonUrl: string, token: string, line: string, text: string, replyTo?: string): Promise<void> {
  await fetch(`${daemonUrl.replace(/\/$/, '')}/api/messenger/send`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, as: 'agent', line, ...(replyTo ? { replyTo } : {}) }),
  });
}

/** Compose a docs-grounded reply for `userText`. Stub LLM call — see TODO. */
function composeReply(userText: string): string {
  const chunks = retrieve(userText, 3);
  if (chunks.length === 0) {
    return 'I don\'t have docs that cover this — flagging for the team.';
  }
  /** TODO(#29-followup): replace the stub with an actual Anthropic API call that injects the
   *  retrieved chunks as grounding context. For this PR we surface the top match's title +
   *  URL so the user gets *something* useful while the LLM wiring lands. */
  const top = chunks[0];
  return `Based on the Snapshot docs: **${top.title}** — ${top.url}\n\n(Auto-reply stub; full LLM-grounded answer coming in a follow-up.)`;
}

function isSoloChannel(line: string): boolean {
  const members = readMembers();
  const m = members[line];
  if (!m) return false;
  /** Solo = me + 1 user. >2 = multi-party. */
  return m.members.length <= 2;
}

function isAgent(uri: string): boolean { return uri === AGENT_URI; }

function handleInbound(entry: HistoryEntry, daemonUrl: string, token: string): void {
  /** Skip our own bubbles + reactions + transcripts. */
  if (isAgent(entry.from)) {
    /** Cancel any pending reply on this channel — we already responded. */
    const p = pending.get(entry.line);
    if (p) { clearTimeout(p.timer); pending.delete(entry.line); }
    return;
  }
  const p = entry.payload as { reactTo?: string; transcribeFor?: string } | undefined;
  if (p?.reactTo || p?.transcribeFor) return;
  /** Only react to messages on channel-prefixed lines (i.e. multi-party channels, not the
   *  legacy `metro://messenger/owner` line). */
  if (!entry.line.startsWith(MESSENGER_CHANNEL_PREFIX)) return;
  if (!hasMembership(entry.line)) return;

  /** A human (non-agent) reply on a channel where we have a pending reply → cancel. */
  const existing = pending.get(entry.line);
  if (existing && existing.sourceMsgId !== entry.id) {
    /** This new entry replaces the trigger. If it's from a non-agent human, cancel us. */
    clearTimeout(existing.timer);
    pending.delete(entry.line);
  }

  const userText = entry.text ?? '';
  if (!userText.trim()) return;

  const delayMs = isSoloChannel(entry.line) ? 0 : REPLY_DELAY_S * 1_000;
  const fire = (): void => {
    pending.delete(entry.line);
    const text = composeReply(userText);
    void sendReply(daemonUrl, token, entry.line, text, entry.id)
      .catch(err => log.warn({ err: errMsg(err), line: entry.line }, 'snapshot-agent: reply send failed'));
  };
  if (delayMs === 0) { fire(); return; }
  pending.set(entry.line, {
    sourceMsgId: entry.id,
    fireAt: Date.now() + delayMs,
    timer: setTimeout(fire, delayMs),
  });
}

/** Entry point: long-lived process subscribed to all messenger channels.
 *  Requires `METRO_MONITOR_TOKEN` in env for outbound sends. */
export async function runSnapshotAgent(): Promise<void> {
  const token = process.env.METRO_MONITOR_TOKEN;
  const daemonUrl = process.env.METRO_DAEMON_URL ?? 'http://127.0.0.1:8420';
  if (!token) { log.error({}, 'snapshot-agent: METRO_MONITOR_TOKEN required'); process.exit(2); }

  const opts: TailOpts = {
    mode: 'all', self: null,
    stationFilter: 'messenger',
    /** Skip our own outbound echoes so we don't trip on a reply we just sent. */
    excludeFrom: [AGENT_URI],
  };
  log.info({ daemonUrl, replyDelayS: REPLY_DELAY_S }, 'snapshot-agent: starting');
  let offset = historySize();
  offset = drainTail(offset, opts, e => { handleInbound(e, daemonUrl, token); });
  const stop = followTail(offset, opts, e => { handleInbound(e, daemonUrl, token); }, 500);
  await new Promise<void>(resolve => {
    const finish = (): void => { stop(); resolve(); };
    process.on('SIGINT', finish); process.on('SIGTERM', finish);
  });
}
