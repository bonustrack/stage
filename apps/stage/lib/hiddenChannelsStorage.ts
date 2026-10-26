import { hiddenChannelsSchema } from '@stage-labs/client/xmtp/readState';
import { appStorage } from '../platform/storage';
import { jsonWith } from './storeCore';

export const HIDDEN_CHANNELS_KEY = 'channels.hidden.';

export const parseHiddenChannels = jsonWith(hiddenChannelsSchema);

export async function visibleCachedRows<T extends { convId: string; peerAddress?: unknown }>(accountId: string, rows: T[]): Promise<T[]> {
  const raw = await appStorage.get(HIDDEN_CHANNELS_KEY + accountId);
  const hidden = raw === null ? {} : parseHiddenChannels(raw) ?? {};
  return rows.filter(row => row.peerAddress != null || !hidden[row.convId]?.hidden);
}
