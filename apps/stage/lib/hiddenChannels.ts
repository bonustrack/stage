import { mergeHiddenChannels, type HiddenChannels } from '@stage-labs/client/xmtp/readState';
import { createValueStore } from './persistedStore';
import { makeListeners } from './storeCore';
import type { XmtpConsent } from './xmtp.types';
import { HIDDEN_CHANNELS_KEY, parseHiddenChannels } from './hiddenChannelsStorage';

const prefs = createValueStore<HiddenChannels>({
  key: HIDDEN_CHANNELS_KEY, default: {}, deserialize: parseHiddenChannels, serialize: JSON.stringify, perAccount: true, durable: true,
});
const localChanges = makeListeners<string>();

export const onHiddenChannelsChanged = localChanges.subscribe;
export const subscribeHiddenChannels = prefs.subscribe;
export const useHiddenChannels = prefs.use;
export const loadHiddenChannels = prefs.loadFor;

export function isChannelHidden(convId: string | null | undefined): boolean {
  return convId != null && prefs.get()[convId]?.hidden === true;
}

export function channelConsent(convId: string, consent: XmtpConsent | null): XmtpConsent | null {
  const state = prefs.get()[convId];
  return state === undefined ? consent : state.hidden ? 'denied' : 'allowed';
}

export async function setChannelHidden(accountId: string, convId: string, hidden: boolean): Promise<void> {
  await prefs.updateFor(accountId, (current) => mergeHiddenChannels(current, {
    [convId]: { hidden, at: Math.max(Date.now(), (current[convId]?.at ?? 0) + 1) },
  }));
  localChanges.notify(accountId);
}

export function applyRemoteHiddenChannels(accountId: string, incoming: HiddenChannels): Promise<void> {
  return prefs.updateFor(accountId, (current) => {
    const next = mergeHiddenChannels(current, incoming);
    return JSON.stringify(next) === JSON.stringify(current) ? current : next;
  });
}
