import type { HistoryEntry } from '../src/types';
import { NO_TAGS, type AppDataGroup } from '../src/xmtp/channelMeta';
import type { ChannelRow } from '../src/xmtp/channelsCache';
import { rowPreviewOf, stageCodecsFor } from '../src/xmtp/contentTypes';
import { syncCodecOf, type SyncContents, type SyncKind } from '../src/xmtp/sync/registry';

export function entry(id: string, fields: Partial<HistoryEntry> = {}): HistoryEntry {
  return { id, ts: '2026-09-30T00:00:00.000Z', station: 'xmtp', line: 'stage://xmtp/c', from: 'u', to: 'c', ...fields };
}

export function storedEntry(id: string, fields: object): HistoryEntry {
  const read: HistoryEntry = JSON.parse(JSON.stringify({ ...entry(id), ...fields }));
  return read;
}

export function previewOf(content: unknown, contentTypeId: string | undefined): string {
  return rowPreviewOf({ content, contentTypeId });
}

export function sharedStageCodecs(): ReturnType<typeof stageCodecsFor> {
  const web = stageCodecsFor('web');
  return stageCodecsFor('native').filter((codec) => web.includes(codec));
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

export function syncState<K extends SyncKind>(kind: K, content: unknown): SyncContents[K] | null {
  const parsed = syncCodecOf(kind).schema.safeParse(content);
  return parsed.success ? parsed.data : null;
}

export function deferred(): { promise: Promise<void>; release: () => void } {
  let release = (): void => undefined;
  const promise = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { promise, release };
}
