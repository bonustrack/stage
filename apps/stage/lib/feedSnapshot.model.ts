import type { HistoryEntry } from '@stage-labs/client/types';
import { base64ToBytes, bytesToBase64 } from '@stage-labs/client/text/base64';
import { reactionTarget } from './feedOrder.model';

const SNAPSHOT_MESSAGES = 20;
export const SNAPSHOT_LINES = 40;
export const INLINE_DATA_LIMIT = 64_000;

interface SnapshotLine {
  line: string;
  at: number;
  entries: HistoryEntry[];
}

export interface FeedSnapshot {
  self: string | null;
  lines: SnapshotLine[];
}

export const EMPTY_SNAPSHOT: FeedSnapshot = { self: null, lines: [] };

const BYTES_TAG = '$bytes';
const BIGINT_TAG = '$bigint';

function bulky(attachment: unknown): boolean {
  const data = (attachment as { dataB64?: unknown } | null)?.dataB64;
  return typeof data === 'string' && data.length > INLINE_DATA_LIMIT;
}

function withoutBulkyData(entry: HistoryEntry): HistoryEntry {
  const payload = entry.payload as { attachments?: unknown } | undefined;
  const attachments = payload?.attachments;
  if (!Array.isArray(attachments) || !attachments.some(bulky)) return entry;
  const slim: unknown[] = attachments.map((a: unknown) => (bulky(a) ? { ...(a as object), dataB64: undefined } : a));
  return { ...entry, payload: { ...payload, attachments: slim } };
}

export function snapshotEntries(slice: readonly HistoryEntry[], messages = SNAPSHOT_MESSAGES): HistoryEntry[] {
  const out: HistoryEntry[] = [];
  let kept = 0;
  for (const entry of slice) {
    if (entry.pending === true) continue;
    if (reactionTarget(entry) === undefined) {
      if (kept === messages) break;
      kept += 1;
    }
    out.push(withoutBulkyData(entry));
  }
  return out;
}

export function withLine(snapshot: FeedSnapshot, line: string, entries: HistoryEntry[], at: number): FeedSnapshot {
  const others = snapshot.lines.filter(l => l.line !== line);
  const lines = entries.length === 0 ? others : [{ line, at, entries }, ...others];
  return { ...snapshot, lines: lines.slice(0, SNAPSHOT_LINES) };
}

export function withSelf(snapshot: FeedSnapshot, self: string): FeedSnapshot {
  return snapshot.self === self ? snapshot : { ...snapshot, self };
}

export function lineEntries(snapshot: FeedSnapshot, line: string): HistoryEntry[] | null {
  return snapshot.lines.find(l => l.line === line)?.entries ?? null;
}

function encodeValue(_key: string, value: unknown): unknown {
  if (value instanceof Uint8Array) return { [BYTES_TAG]: bytesToBase64(value) };
  if (typeof value === 'bigint') return { [BIGINT_TAG]: value.toString() };
  return value;
}

function tagOf(value: object, tag: string): string | null {
  const keys = Object.keys(value);
  const tagged = (value as Record<string, unknown>)[tag];
  return keys.length === 1 && typeof tagged === 'string' ? tagged : null;
}

function decodeValue(_key: string, value: unknown): unknown {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return value;
  const bytes = tagOf(value, BYTES_TAG);
  if (bytes !== null) return base64ToBytes(bytes);
  const big = tagOf(value, BIGINT_TAG);
  return big === null ? value : BigInt(big);
}

export function encodeSnapshot(snapshot: FeedSnapshot): string {
  return JSON.stringify(snapshot, encodeValue);
}

function isEntry(value: unknown): value is HistoryEntry {
  if (typeof value !== 'object' || value === null) return false;
  const { id, ts, line } = value as Partial<HistoryEntry>;
  return typeof id === 'string' && typeof ts === 'string' && typeof line === 'string';
}

function isLine(value: unknown): value is SnapshotLine {
  if (typeof value !== 'object' || value === null) return false;
  const { line, at, entries } = value as Partial<SnapshotLine>;
  return typeof line === 'string' && typeof at === 'number' && Array.isArray(entries) && entries.every(isEntry);
}

export function decodeSnapshot(text: string): FeedSnapshot | null {
  try {
    const parsed = JSON.parse(text, decodeValue) as Partial<FeedSnapshot> | null;
    if (typeof parsed !== 'object' || parsed === null || !Array.isArray(parsed.lines)) return null;
    const self = typeof parsed.self === 'string' ? parsed.self : null;
    return { self, lines: parsed.lines.filter(isLine).slice(0, SNAPSHOT_LINES) };
  } catch {
    return null;
  }
}
