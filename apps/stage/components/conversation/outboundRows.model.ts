import type { HistoryEntry } from '@stage-labs/client/types';
import { hasAttachments } from './feed-helpers';

export function matchConfirmed(
  optimistic: HistoryEntry[], liveBubbles: HistoryEntry[],
  myUri: string, confirmedIds: Map<string, string>,
): Map<string, string> {
  const confirmed = new Map<string, string>();
  if (!optimistic.length) return confirmed;
  const used = new Set<string>();
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
      e.from === myUri && !used.has(e.id)
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
