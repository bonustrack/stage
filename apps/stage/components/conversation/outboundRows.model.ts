import type { HistoryEntry } from '@stage-labs/client/types';
import { attachmentsPreview } from '@stage-labs/client/xmtp/humanize';
import { hasAttachments } from './feed-helpers';
import { uploadedAttachmentKey } from '../../lib/localAttachmentCache.core';
import type { UploadedAttachment } from '../../lib/xmtp.types';

function matchesUpload(entry: HistoryEntry, keys: readonly string[]): boolean {
  const attachments = (entry.payload as { attachments?: { remote?: UploadedAttachment }[] } | undefined)?.attachments;
  return keys.length > 0 && attachments?.length === keys.length
    && attachments.every((attachment, i) => attachment.remote !== undefined && uploadedAttachmentKey(attachment.remote) === keys[i]);
}

function matchesPending(pending: HistoryEntry, live: HistoryEntry, myUri: string, keys?: readonly string[]): boolean {
  if (live.from !== myUri || live.line !== pending.line) return false;
  if (hasAttachments(pending)) return keys !== undefined && matchesUpload(live, keys);
  const elapsed = new Date(live.ts).getTime() - new Date(pending.ts).getTime();
  return elapsed >= -1_000 && elapsed < 30_000 && live.text === pending.text;
}

export function matchConfirmed(
  optimistic: HistoryEntry[], liveBubbles: HistoryEntry[],
  myUri: string, confirmedIds: Map<string, string>,
  uploaded: ReadonlyMap<string, readonly string[]> = new Map(),
): Map<string, string> {
  const confirmed = new Map<string, string>();
  if (!optimistic.length) return confirmed;
  const used = new Set<string>();
  const claimed = new Set(confirmedIds.values());
  const ordered = [...optimistic].sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime());
  for (const o of ordered) {
    const realId = confirmedIds.get(o.id);
    const match = liveBubbles.find(e => !used.has(e.id) && (realId
      ? e.id === realId
      : !claimed.has(e.id) && matchesPending(o, e, myUri, uploaded.get(o.id))));
    if (match) { used.add(match.id); confirmed.set(o.id, match.id); }
  }
  return confirmed;
}

export function mergeConfirmed(prev: Map<string, string>, confirmed: Map<string, string>): Map<string, string> {
  let next: Map<string, string> | null = null;
  for (const [localId, liveId] of confirmed) {
    if (prev.get(localId) === liveId) continue;
    next ??= new Map(prev);
    next.set(localId, liveId);
  }
  return next ?? prev;
}

export interface OutboundState {
  optimistic: HistoryEntry[];
  confirmedIds: Map<string, string>;
  sent?: ReadonlySet<string>;
  rowKeys?: Map<string, string>;
}

function stableRowKeys(state: OutboundState, confirmed: Map<string, string>, pending: HistoryEntry[]): Map<string, string> {
  const keys = new Map(state.rowKeys);
  const used = new Set([...keys].filter(([id]) => !id.startsWith('tmp_')).map(([, key]) => key));
  const available = new Set([...state.optimistic.map(o => o.id), ...keys.values()].filter(key => !used.has(key)));
  const assign = (id: string, preferred: string): string => {
    const key = used.has(preferred) ? available.values().next().value ?? id : preferred;
    keys.set(id, key);
    used.add(key);
    available.delete(key);
    return key;
  };
  for (const [localId, liveId] of confirmed) {
    const key = keys.get(liveId) ?? assign(liveId, keys.get(localId) ?? localId);
    keys.set(localId, key);
  }
  for (const entry of pending) assign(entry.id, keys.get(entry.id) ?? entry.id);
  return keys;
}

export interface OutboundView {
  confirmed: Map<string, string>;
  pending: HistoryEntry[];
  localIdOf: Map<string, string>;
}

export function outboundView(
  state: OutboundState, liveBubbles: HistoryEntry[], myUri: string,
  uploaded?: ReadonlyMap<string, readonly string[]>,
): OutboundView {
  const confirmed = matchConfirmed(state.optimistic, liveBubbles, myUri, state.confirmedIds, uploaded);
  const pending = confirmed.size ? state.optimistic.filter(o => !confirmed.has(o.id)) : state.optimistic;
  return { confirmed, pending, localIdOf: stableRowKeys(state, confirmed, pending) };
}

export function pendingFromMe(pending: HistoryEntry[], myUri: string): HistoryEntry[] {
  return pending.some(e => e.from !== myUri) ? pending.map(e => (e.from === myUri ? e : { ...e, from: myUri })) : pending;
}

export function settleOutbound(state: OutboundState, view: OutboundView): OutboundState {
  const optimistic = state.optimistic.filter(o => !view.confirmed.has(o.id) || !state.sent?.has(o.id));
  const confirmedIds = mergeConfirmed(state.confirmedIds, view.confirmed);
  const rowKeys = mergeConfirmed(state.rowKeys ?? new Map<string, string>(), view.localIdOf);
  if (optimistic.length === state.optimistic.length && confirmedIds === state.confirmedIds && rowKeys === state.rowKeys) return state;
  return { ...state, optimistic, confirmedIds, rowKeys };
}

export function recordSent(state: OutboundState, localId: string, sentId?: string): OutboundState {
  if (!sentId) return { ...state, optimistic: state.optimistic.filter(o => o.id !== localId) };
  if (state.sent?.has(localId) && state.confirmedIds.get(localId) === sentId) return state;
  const confirmedIds = new Map([...state.confirmedIds].filter(([id, liveId]) => id === localId || liveId !== sentId));
  confirmedIds.set(localId, sentId);
  return { ...state, confirmedIds, sent: new Set(state.sent).add(localId) };
}

export function optimisticRowPreview(text: string, attachments: readonly { mime?: string; name?: string }[]): string {
  return text.trim() || attachmentsPreview(attachments.map(a => ({ mimeType: a.mime, filename: a.name })));
}
