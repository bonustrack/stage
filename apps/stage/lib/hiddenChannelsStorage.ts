import { hiddenChannelsSchema, type HiddenChannels } from '@stage-labs/client/xmtp/readState';
import { appStorage } from '../platform/storage';

export const HIDDEN_CHANNELS_KEY = 'channels.hidden.';

export function parseHiddenChannels(raw: string): HiddenChannels | undefined {
  try {
    const parsed = hiddenChannelsSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : undefined;
  } catch { return undefined; }
}

export async function visibleCachedRows<T extends { convId: string; peerAddress?: unknown }>(accountId: string, rows: T[]): Promise<T[]> {
  const raw = await appStorage.get(HIDDEN_CHANNELS_KEY + accountId);
  const hidden = raw === null ? {} : parseHiddenChannels(raw) ?? {};
  return rows.filter(row => row.peerAddress != null || !hidden[row.convId]?.hidden);
}
