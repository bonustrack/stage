import { z } from 'zod';
import { defineSyncKind } from './kind';
import type { ChannelRow } from '../channelsCache';

export type ClearedChats = Record<string, number>;

export const hiddenChannelsSchema = z.record(z.string().min(1), z.object({ hidden: z.boolean(), at: z.number().nonnegative() }));
export type HiddenChannels = z.infer<typeof hiddenChannelsSchema>;

const clearStateSchema = z.object({
  cleared: z.record(z.string().min(1), z.number().nonnegative()),
  hidden: hiddenChannelsSchema.optional().catch(undefined),
});

export type ClearStateContent = z.infer<typeof clearStateSchema>;

export interface ClearReplay {
  cleared: ClearedChats | null;
  hidden: HiddenChannels | null;
}

export function mergeHiddenChannels(local: HiddenChannels, incoming: HiddenChannels): HiddenChannels {
  const merged = { ...local };
  for (const [id, state] of Object.entries(incoming)) {
    const previous = merged[id];
    if (!previous || state.at > previous.at || (state.at === previous.at && state.hidden)) merged[id] = state;
  }
  return merged;
}

export function isHiddenChannel(hidden: HiddenChannels, convId: string | null | undefined): boolean {
  return convId != null && hidden[convId]?.hidden === true;
}

export function hiddenConsent<C>(state: { hidden: boolean } | undefined, consent: C): C | 'denied' | 'allowed' {
  if (state === undefined) return consent;
  return state.hidden ? 'denied' : 'allowed';
}

export function mergeClearedChats(local: ClearedChats, incoming: ClearedChats): ClearedChats {
  const merged: ClearedChats = {};
  for (const [peer, at] of [...Object.entries(local), ...Object.entries(incoming)]) {
    const key = peer.toLowerCase();
    merged[key] = Math.max(merged[key] ?? 0, at);
  }
  return merged;
}

export function isChatCleared(cleared: ClearedChats, peerAddress: string | null | undefined, lastTsMs: number | null): boolean {
  if (!peerAddress) return false;
  const clearedAt = cleared[peerAddress.toLowerCase()];
  return clearedAt !== undefined && (lastTsMs ?? 0) <= clearedAt;
}

export type ClearableRow = Pick<ChannelRow, 'peerAddress' | 'lastTs'> & Partial<Pick<ChannelRow, 'lastBubbleTs'>>;

export function isRowCleared(cleared: ClearedChats, row: ClearableRow): boolean {
  return isChatCleared(cleared, row.peerAddress, row.lastBubbleTs === undefined ? row.lastTs : row.lastBubbleTs);
}

function clearedUpTo(cleared: ClearedChats, maxAt: number): ClearedChats {
  return Object.fromEntries(Object.entries(cleared).filter(([, at]) => at <= maxAt));
}

function hiddenUpTo(hidden: HiddenChannels, maxAt: number): HiddenChannels {
  return Object.fromEntries(Object.entries(hidden).filter(([, state]) => state.at <= maxAt));
}

function mergedVisibility(states: readonly ClearStateContent[], maxAt: number): ClearReplay {
  let cleared: ClearedChats | null = null;
  let hidden: HiddenChannels | null = null;
  for (const state of states) {
    cleared = mergeClearedChats(cleared ?? {}, clearedUpTo(state.cleared, maxAt));
    if (state.hidden !== undefined) hidden = mergeHiddenChannels(hidden ?? {}, hiddenUpTo(state.hidden, maxAt));
  }
  return { cleared, hidden };
}

export const CLEAR_SYNC = defineSyncKind({
  typeId: 'clearState',
  schema: clearStateSchema,
  fallback: 'Stage deleted chats',
  replay: mergedVisibility,
});
