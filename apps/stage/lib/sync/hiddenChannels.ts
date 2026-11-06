import { hiddenChannelsSchema, isHiddenChannel, mergeHiddenChannels, type HiddenChannels } from '@stage-labs/client/xmtp/sync/clear';
import { createValueStore } from '../persistedStore';
import { makeListeners } from '../storeCore';

const prefs = createValueStore<HiddenChannels>({
  key: 'channels.hidden.',
  default: {},
  schema: hiddenChannelsSchema,
  perAccount: true,
  durable: true,
});
const localChanges = makeListeners<string>();

export const onHiddenChannelsChanged = localChanges.subscribe;
export const subscribeHiddenChannels = prefs.subscribe;
export const useHiddenChannels = prefs.use;
export const loadHiddenChannels = prefs.loadFor;
export const hiddenChannelsNow = prefs.get;

export function isChannelHidden(convId: string | null | undefined): boolean {
  return isHiddenChannel(prefs.get(), convId);
}

export async function setChannelHidden(accountId: string, convId: string, hidden: boolean): Promise<void> {
  await prefs.updateFor(accountId, (current) =>
    mergeHiddenChannels(current, { [convId]: { hidden, at: Math.max(Date.now(), (current[convId]?.at ?? 0) + 1) } }),
  );
  localChanges.notify(accountId);
}

export function applyRemoteHiddenChannels(accountId: string, incoming: HiddenChannels): Promise<void> {
  return prefs.updateFor(accountId, (current) => {
    const next = mergeHiddenChannels(current, incoming);
    return JSON.stringify(next) === JSON.stringify(current) ? current : next;
  });
}

export async function visibleCachedRows<T extends { convId: string; peerAddress?: unknown }>(accountId: string, rows: T[]): Promise<T[]> {
  const hidden = await loadHiddenChannels(accountId);
  return rows.filter((row) => row.peerAddress != null || !isHiddenChannel(hidden, row.convId));
}
