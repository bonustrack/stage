/** Train stdin/stdout protocol: line buffering + JSON envelope handling + file discovery. */

import { readdirSync, statSync } from 'node:fs';
import { join, parse as parsePath } from 'node:path';
import { errMsg, log } from '../log.js';

export const STDOUT_LINE_MAX = 4 * 1024 * 1024; // 4 MiB safeguard per line

/** Train stdout event line (snake_case wire); dispatcher translates to camelCase HistoryEntry. */
export type TrainEvent = {
  station?: string; kind?: string; line?: string; line_name?: string;
  from?: string; from_name?: string; to?: string;
  message_id?: string; reply_to?: string; is_private?: boolean;
  text?: string; emoji?: string; payload?: unknown; ts?: string; id?: string;
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
