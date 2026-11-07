import { hiddenChannelsSchema, isHiddenChannel, mergeHiddenChannels, type HiddenChannels } from '@stage-labs/client/xmtp/sync/clear';
import { createValueStore } from '../persistedStore';
import { keepUnlessChanged, makeListeners } from '../storeCore';
import { nextStamp } from '../syncedSettings.model';

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
    mergeHiddenChannels(current, { [convId]: { hidden, at: nextStamp(current[convId]?.at, Date.now()) } }),
  );
  localChanges.notify(accountId);
}

export function applyRemoteHiddenChannels(accountId: string, incoming: HiddenChannels): Promise<void> {
  return prefs.updateFor(accountId, (current) => keepUnlessChanged(current, mergeHiddenChannels(current, incoming)));
}

export function isChatHidden(hidden: HiddenChannels, convId: string, isChannel: boolean): boolean {
  return isChannel && isHiddenChannel(hidden, convId);
}

export function isRowHidden(row: { convId: string; peerAddress?: unknown }, hidden: HiddenChannels = prefs.get()): boolean {
  return isChatHidden(hidden, row.convId, row.peerAddress == null);
}

export async function visibleCachedRows<T extends { convId: string; peerAddress?: unknown }>(accountId: string, rows: T[]): Promise<T[]> {
  const hidden = await loadHiddenChannels(accountId);
  return rows.filter((row) => !isRowHidden(row, hidden));
}
