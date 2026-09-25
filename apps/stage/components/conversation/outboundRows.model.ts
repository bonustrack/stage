import type { HistoryEntry } from '@stage-labs/client/types';
import { hasAttachments } from './feed-helpers';

export function matchConfirmed(
  optimistic: HistoryEntry[], liveBubbles: HistoryEntry[],
  myUri: string, confirmedIds: Map<string, string>,
): Map<string, string> {
  const confirmed = new Map<string, string>();
  if (!optimistic.length) return confirmed;
  const used = new Set<string>();
  const claimed = new Set(confirmedIds.values());
  const ordered = [...optimistic].sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime());
  for (const o of ordered) {
    const realId = confirmedIds.get(o.id);
    if (realId) {
      const byId = liveBubbles.find(e => e.id === realId && !used.has(e.id));
      if (byId) { used.add(byId.id); confirmed.set(o.id, byId.id); continue; }
    }
    if (hasAttachments(o)) continue;
    const oTs = new Date(o.ts).getTime();
    const match = liveBubbles.find(e =>
      e.from === myUri && !used.has(e.id) && !claimed.has(e.id)
      && new Date(e.ts).getTime() >= oTs - 1_000
      && new Date(e.ts).getTime() - oTs < 30_000
      && e.text === o.text);
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

export function outboundView(state: OutboundState, liveBubbles: HistoryEntry[], myUri: string): OutboundView {
  const confirmed = matchConfirmed(state.optimistic, liveBubbles, myUri, state.confirmedIds);
  return {
    confirmed,
    pending: confirmed.size ? state.optimistic.filter(o => !confirmed.has(o.id)) : state.optimistic,
    localIdOf: localIdsByLiveId(state.confirmedIds, confirmed),
  };
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
