/** Train stdin/stdout protocol: line buffering + JSON envelope + outbound call bookkeeping. */

import { readdirSync, statSync } from 'node:fs';
import { join, parse as parsePath } from 'node:path';
import { errMsg, log } from '../log.js';
import type { WireEvent } from '../history-types.js';

export const CALL_TIMEOUT_MS = 60_000;

export type Pending = {
  resolve: (r: TrainCallResponse) => void; reject: (err: Error) => void;
  timer: ReturnType<typeof setTimeout>;
};
export type CallTarget = {
  name: string; pending: Map<string, Pending>;
  proc: { stdin?: unknown } & Record<string, unknown> | null;
};

export const STDOUT_LINE_MAX = 4 * 1024 * 1024; // 4 MiB safeguard per line

/** Train stdout event line (snake_case wire); dispatcher translates to camelCase HistoryEntry. */
export type TrainEvent = {
  station?: string; line?: string; line_name?: string;
  from?: string; from_name?: string; to?: string;
  message_id?: string; reply_to?: string; is_private?: boolean;
  text?: string; emoji?: string; payload?: unknown; ts?: string; id?: string;
  /** Canonical content-type discriminator (see {@link WireEvent}). When present, the */
  /** dispatcher carries it verbatim to `HistoryEntry.event`; additive (absent ⇒ */
  /** byte-identical). Trains keep the legacy text (e.g. `[react 👍]`) alongside it. */
  event?: WireEvent;
} & Record<string, unknown>;

export type TrainCallResponse = { result?: unknown; error?: string };

export type TrainMessage =
  | { op: 'response'; id: string; result?: unknown; error?: string }
  | { op: 'log'; text?: string }
  | { op: 'event'; event: TrainEvent }
  | { op: 'ignore' };

/** Classify a single parsed stdout line from a train. */
export function parseTrainLine(name: string, line: string): TrainMessage | null {
  let msg: { op?: string; id?: string; result?: unknown; error?: string; text?: string } & Record<string, unknown>;
  try { msg = JSON.parse(line); }
  catch (err) {
    log.warn({ name, err: errMsg(err), line: line.slice(0, 200) }, 'train: bad JSON');
    return null;
  }
  if (msg.op === 'response') {
    if (typeof msg.id !== 'string') return { op: 'ignore' };
    return { op: 'response', id: msg.id, result: msg.result, error: msg.error };
  }
  if (msg.op === 'log') return { op: 'log', text: msg.text };
  /** Anything without an `op` (or with `op:"event"`) is an inbound event. */
  /** Defensive shape check: every event needs `line` (string). Log + drop if missing. */
  if (typeof msg.line !== 'string') {
    log.warn({ name, line: line.slice(0, 200) }, 'train: event missing `line` (string) — dropped');
    return { op: 'ignore' };
  }
  return { op: 'event', event: msg as TrainEvent };
}

/** Consume complete `\n`-terminated lines from a rolling buffer; invoke `onLine` for each. */
/** Returns the leftover (incomplete) buffer to keep accumulating. */
export function drainLines(name: string, buf: string, onLine: (line: string) => void): string {
  if (buf.length > STDOUT_LINE_MAX && !buf.includes('\n')) {
    log.warn({ name, bytes: buf.length }, 'train: dropping oversized stdout line');
    return '';
  }
  let nl;
  while ((nl = buf.indexOf('\n')) !== -1) {
    const line = buf.slice(0, nl).trim();
    buf = buf.slice(nl + 1);
    if (!line) continue;
    onLine(line);
  }
  return buf;
}

export function encodeCall(id: string, action: string, args: unknown): string {
  return JSON.stringify({ op: 'call', id, action, args }) + '\n';
}

function isTrainFile(name: string): boolean {
  return /\.(ts|js|mjs)$/.test(name) && !name.startsWith('_') && !name.startsWith('.');
}

/** Discover trains under `dir`: regular files with allowed extensions, no `_` / `.` prefix. */
export function listTrainFiles(dir: string): { name: string; path: string }[] {
  return readdirSync(dir).filter(isTrainFile)
    .map(f => ({ name: parsePath(f).name, path: join(dir, f) }))
    .filter(t => { try { return statSync(t.path).isFile(); } catch { return false; } });
}

/* ──────────── outbound call bookkeeping (per-train pending map + timeout) ──────────── */

export function mintCallId(seq: number): string {
  return `req_${seq}_${Math.random().toString(36).slice(2, 8)}`;
}

/** Reject + clear all pending calls on a train (used on shutdown/exit). */
export function failAllPending(pending: Map<string, Pending>, reason: string): void {
  for (const p of pending.values()) {
    clearTimeout(p.timer);
    p.reject(new Error(reason));
  }
  pending.clear();
}

/** Dispatch `action` to a train's stdin and register a pending entry; returns the awaitable. */
export function sendCall(
  t: CallTarget, id: string, action: string, args: unknown,
): Promise<TrainCallResponse> {
  return new Promise<TrainCallResponse>((resolve, reject) => {
    const timer = setTimeout(() => {
      t.pending.delete(id);
      reject(new Error(`train '${t.name}' call '${action}' timed out after ${CALL_TIMEOUT_MS}ms`));
    }, CALL_TIMEOUT_MS);
    t.pending.set(id, { resolve, reject, timer });
    try {
      const stdin = (t.proc as { stdin?: { write: (s: string) => void; flush: () => void } } | null)?.stdin;
      if (!stdin || typeof stdin === 'number') throw new Error('stdin not piped');
      stdin.write(encodeCall(id, action, args));
      stdin.flush();
    } catch (err) {
      clearTimeout(timer);
      t.pending.delete(id);
      reject(new Error(`train '${t.name}' stdin write failed: ${errMsg(err)}`));
    }
  });
}
