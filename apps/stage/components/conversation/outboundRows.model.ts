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

export function localIdsByLiveId(...sources: Map<string, string>[]): Map<string, string> {
  const out = new Map<string, string>();
  for (const source of sources) for (const [localId, liveId] of source) out.set(liveId, localId);
  return out;
}

export interface OutboundState {
  optimistic: HistoryEntry[];
  confirmedIds: Map<string, string>;
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
  return {
    confirmed,
    pending: confirmed.size ? state.optimistic.filter(o => !confirmed.has(o.id)) : state.optimistic,
    localIdOf: localIdsByLiveId(state.confirmedIds, confirmed),
  };
}

export function pendingFromMe(pending: HistoryEntry[], myUri: string): HistoryEntry[] {
  return pending.some(e => e.from !== myUri) ? pending.map(e => (e.from === myUri ? e : { ...e, from: myUri })) : pending;
}

export function settleOutbound(state: OutboundState, confirmed: Map<string, string>): OutboundState {
  const optimistic = state.optimistic.filter(o => !confirmed.has(o.id));
  const confirmedIds = mergeConfirmed(state.confirmedIds, confirmed);
  if (optimistic.length === state.optimistic.length && confirmedIds === state.confirmedIds) return state;
  return { optimistic, confirmedIds };
}

export function recordSent(state: OutboundState, localId: string, sentId?: string): OutboundState {
  if (!sentId) return { ...state, optimistic: state.optimistic.filter(o => o.id !== localId) };
  const confirmedIds = mergeConfirmed(state.confirmedIds, new Map([[localId, sentId]]));
  return confirmedIds === state.confirmedIds ? state : { ...state, confirmedIds };
}

export function optimisticRowPreview(text: string, attachments: readonly { mime?: string; name?: string }[]): string {
  return text.trim() || attachmentsPreview(attachments.map(a => ({ mimeType: a.mime, filename: a.name })));
}
