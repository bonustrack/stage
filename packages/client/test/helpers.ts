import type { HistoryEntry } from '../src/types';
import { NO_TAGS, type AppDataGroup } from '../src/xmtp/channelMeta';
import type { ChannelRow } from '../src/xmtp/channelsCache';

export function entry(id: string, fields: Partial<HistoryEntry> = {}): HistoryEntry {
  return { id, ts: '2026-09-30T00:00:00.000Z', station: 'xmtp', line: 'stage://xmtp/c', from: 'u', to: 'c', ...fields };
}

export function storedEntry(id: string, fields: object): HistoryEntry {
  const read: HistoryEntry = JSON.parse(JSON.stringify({ ...entry(id), ...fields }));
  return read;
}

export function fakeFetch(respond: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>): typeof fetch {
  return Object.assign(respond, { preconnect: globalThis.fetch.preconnect });
}

export function channelRow(convId: string, fields: Partial<ChannelRow> = {}): ChannelRow {
  return {
    ...NO_TAGS,
    convId,
    title: '',
    peerAddress: null,
    avatarUri: null,
    avatarAddress: null,
    inboxToAddr: {},
    selfInboxId: 'me',
    lastTs: null,
    lastBubbleTs: null,
    lastPreview: '',
    lastSenderAddress: null,
    lastFromSelf: false,
    unreadCount: 0,
    lastReadNs: 0,
    markedUnread: false,
    ...fields,
  };
}

export function appDataGroup(initial = '{}'): { group: AppDataGroup; raw: () => string; writes: () => number } {
  let raw = initial;
  let writes = 0;
  return {
    group: {
      appData: () => Promise.resolve(raw),
      updateAppData: (value) => {
        raw = value;
        writes += 1;
        return Promise.resolve();
      },
    },
    raw: () => raw,
    writes: () => writes,
  };
}
