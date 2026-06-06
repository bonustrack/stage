/** Resolve the GROUP channels that BOTH the local user and a viewed peer are
 *  members of — powers the "Common channels" section on a peer's profile.
 *
 *  Strategy (kept cheap so it never blocks the profile render):
 *    1. Seed the candidate group list from the persisted channels cache
 *       (`getCachedRows`) — group rows are the ones with `peerAddress == null`.
 *       The cache already carries the group's title + uploaded avatar, so the
 *       only per-group network work is resolving the member address list.
 *    2. For each candidate group, fetch the conversation and resolve its member
 *       eth addresses lazily (`groupMemberEthAddresses`, which excludes self).
 *       If the viewed peer is among them, it's a common channel.
 *
 *  All resolution runs async after mount; the consumer shows nothing until at
 *  least the cache is hydrated and resolution settles. */

import { useQuery } from '@tanstack/react-query';
import { getCachedRows, hydrateCachedRows, getActiveAccountIdSync, type CachedRow } from './channelsCache';
import { convOfLine, groupMemberEthAddresses, lineOfConv } from './xmtp';
import { channelStampSeed } from '@metro-labs/kit/avatar';
import { getAccountEpoch } from './accountEpoch';
import { MemoryStore } from './cache';
import { loadArchivedIds } from './archived';

/** Member-set cache keyed by `${convId}:${accountEpoch}` (#7). Resolving a
 *  group's member eth addresses is the only per-group network work in the common-
 *  channels walk; caching it per account makes repeat profile opens (and
 *  cross-account switches back) free. Cleared implicitly on account switch by the
 *  epoch suffix changing — stale entries just go unread. */
const memberSetCache = new MemoryStore<string, string[]>();

export interface CommonChannel {
  convId: string;
  title: string;
  avatarUri: string | null;
  /** The CHANNEL's own stamp seed (channelStampSeed(convId)) — stamp fallback
   *  when there's no group image. Mirrors the channels tab so a profile's channel
   *  cards render the CHANNEL avatar, not a member's (or the viewed peer's). */
  avatarAddress: string | null;
  memberCount: number;
  /** Homepage-parity fields, pulled from the SAME persisted channels cache the
   *  channels tab writes (`channelsCache`, keyed by convId). Undefined/0 when the
   *  cache has no entry for this group yet (no extra network calls — falls back
   *  to the member-count subtitle). */
  lastTs: number | null;
  lastPreview: string;
  /** Latest sender's eth address (for the "Name: …" preview prefix). */
  lastSenderAddress: string | null;
  lastFromSelf: boolean;
  unreadCount: number;
  markedUnread: boolean;
}

/** Returns `{ channels, loading }`. `channels` is the resolved common-group set
 *  (empty until resolution finishes). `loading` is true while we're still
 *  walking the candidate groups. */
/** Resolve a group's member eth set, cache-first (#7, keyed by convId+epoch). */
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

async function resolveCommonChannels(peerAddress: string): Promise<CommonChannel[]> {
  const peer = peerAddress.toLowerCase();
  await hydrateCachedRows().catch(() => undefined);
  /** Reuse the SAME archived predicate the channels feed uses (lib/archived):
   *  device-only archived set. Hide archived channels here too so the profile
   *  Channels tab matches the home list (no archived rows). */
  const archived = await loadArchivedIds().catch(() => new Set<string>());
  const rows = getCachedRows() ?? [];
  /** Group rows only (DMs carry a non-null peerAddress), minus archived ones. */
  const groups = rows.filter((r): r is CachedRow & { peerAddress: null } =>
    r.peerAddress == null && !archived.has(r.convId));
  /** #7: walk all candidate groups' member sets IN PARALLEL (was serial). */
  const resolved = await Promise.all(groups.map(async (row) => {
    try {
      const members = await memberSetOf(row.convId);
      if (!members.some(a => a.toLowerCase() === peer)) return null;
      /** Reuse the SAME cached row the channels tab summarised — it carries the
       *  preview/unread/timestamp/marked-unread the homepage renders. `row` IS
       *  that cached row, so just read the fields off it (no extra fetch). */
      return {
        convId: row.convId,
        title: typeof row.title === 'string' && row.title.trim()
          ? row.title.trim() : 'Group',
        avatarUri: typeof row.avatarUri === 'string' ? row.avatarUri : null,
        /** Mirror HomeScreen.helpers (avatarAddress): when there's no uploaded
         *  group image, seed the stamp from the channel's own id so the row shows
         *  the CHANNEL avatar — never a member's / the viewed peer's stamp. */
        avatarAddress: (typeof row.avatarUri === 'string' && row.avatarUri)
          ? null : channelStampSeed(row.convId),
        /** members excludes self → +1 for the local user. */
        memberCount: members.length + 1,
        lastTs: typeof row.lastTs === 'number' ? row.lastTs : null,
        lastPreview: typeof row.lastPreview === 'string' ? row.lastPreview : '',
        lastSenderAddress: typeof row.lastSenderAddress === 'string' ? row.lastSenderAddress : null,
        lastFromSelf: row.lastFromSelf === true,
        unreadCount: typeof row.unreadCount === 'number' ? row.unreadCount : 0,
        markedUnread: row.markedUnread === true,
      } as CommonChannel;
    } catch { return null; }
  }));
  return resolved.filter((c): c is CommonChannel => c !== null);
}

export function useCommonChannels(peerAddress: string | null, enabled: boolean): {
  channels: CommonChannel[];
  loading: boolean;
} {
  /** TanStack Query keyed by the ACTIVE ACCOUNT ID (stable per account, unlike
   *  the monotonic account epoch) so switching to another account and BACK
   *  re-hits this account's cached common-channels instead of re-walking. */
  const { data, isLoading } = useQuery({
    queryKey: ['commonChannels', getActiveAccountIdSync(), peerAddress?.toLowerCase() ?? ''],
    queryFn: () => resolveCommonChannels(peerAddress as string),
    enabled: enabled && !!peerAddress,
    staleTime: 5 * 60_000,
  });
  return { channels: data ?? [], loading: (enabled && !!peerAddress) ? isLoading : false };
}
