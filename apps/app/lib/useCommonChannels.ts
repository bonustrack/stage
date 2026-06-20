
import { useQuery } from '@tanstack/react-query';
import { getCachedRows, hydrateCachedRows, getActiveAccountIdSync, type CachedRow } from './channelsCache';
import { convOfLine, groupMemberEthAddresses, lineOfConv } from './xmtp';
import { channelStampSeed } from '@stage-labs/kit/avatar';
import { getAccountEpoch } from './accountEpoch';
import { MemoryStore } from './cache';
import { loadArchivedIds } from './archived';

const memberSetCache = new MemoryStore<string, string[]>();

export interface CommonChannel {
  convId: string;
  title: string;
  avatarUri: string | null;
  avatarAddress: string | null;
  memberCount: number;
  lastTs: number | null;
  lastPreview: string;
  lastSenderAddress: string | null;
  lastFromSelf: boolean;
  unreadCount: number;
  markedUnread: boolean;
}

async function memberSetOf(convId: string): Promise<string[]> {
  const key = `${convId}:${getAccountEpoch()}`;
  const cached = memberSetCache.get(key);
  if (cached) return cached;
  const conv = await convOfLine(lineOfConv(convId));
  if (!conv) return [];
  const members = await groupMemberEthAddresses(conv);
  memberSetCache.set(key, members);
  return members;
}

function commonChannelFromRow(row: CachedRow, members: string[]): CommonChannel {
  return {
    convId: row.convId,
    title: typeof row.title === 'string' && row.title.trim()
      ? row.title.trim() : 'Group',
    avatarUri: typeof row.avatarUri === 'string' ? row.avatarUri : null,
    avatarAddress: (typeof row.avatarUri === 'string' && row.avatarUri)
      ? null : channelStampSeed(row.convId),
    memberCount: members.length + 1,
    lastTs: typeof row.lastTs === 'number' ? row.lastTs : null,
    lastPreview: typeof row.lastPreview === 'string' ? row.lastPreview : '',
    lastSenderAddress: typeof row.lastSenderAddress === 'string' ? row.lastSenderAddress : null,
    lastFromSelf: row.lastFromSelf === true,
    unreadCount: typeof row.unreadCount === 'number' ? row.unreadCount : 0,
    markedUnread: row.markedUnread === true,
  };
}

async function resolveGroupRow(row: CachedRow, peer: string): Promise<CommonChannel | null> {
  try {
    const members = await memberSetOf(row.convId);
    if (!members.some(a => a.toLowerCase() === peer)) return null;
    return commonChannelFromRow(row, members);
  } catch { return null; }
}

async function resolveCommonChannels(peerAddress: string): Promise<CommonChannel[]> {
  const peer = peerAddress.toLowerCase();
  await hydrateCachedRows().catch(() => undefined);
  const archived = await loadArchivedIds().catch(() => new Set<string>());
  const rows = getCachedRows() ?? [];
  const groups = rows.filter((r): r is CachedRow & { peerAddress: null } =>
    r.peerAddress == null && !archived.has(r.convId));
  const resolved = await Promise.all(groups.map((row) => resolveGroupRow(row, peer)));
  return resolved.filter((c): c is CommonChannel => c !== null);
}

export function useCommonChannels(peerAddress: string | null, enabled: boolean): {
  channels: CommonChannel[];
  loading: boolean;
} {
  const { data, isLoading } = useQuery({
    queryKey: ['commonChannels', getActiveAccountIdSync(), peerAddress?.toLowerCase() ?? ''],
    queryFn: () => resolveCommonChannels(peerAddress ?? ''),
    enabled: enabled && !!peerAddress,
    staleTime: 5 * 60_000,
  });
  return { channels: data ?? [], loading: (enabled && !!peerAddress) ? isLoading : false };
}
