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

import { useEffect, useState } from 'react';
import { getCachedRows, hydrateCachedRows, type CachedRow } from './channelsCache';
import { convOfLine, groupMemberEthAddresses, lineOfConv } from './xmtp';

export interface CommonChannel {
  convId: string;
  title: string;
  avatarUri: string | null;
  /** First other member's address — stamp fallback when there's no group image. */
  avatarAddress: string | null;
  memberCount: number;
}

/** Returns `{ channels, loading }`. `channels` is the resolved common-group set
 *  (empty until resolution finishes). `loading` is true while we're still
 *  walking the candidate groups. */
export function useCommonChannels(peerAddress: string | null, enabled: boolean): {
  channels: CommonChannel[];
  loading: boolean;
} {
  const [channels, setChannels] = useState<CommonChannel[]>([]);
  const [loading, setLoading] = useState(enabled);

  useEffect(() => {
    if (!enabled || !peerAddress) { setChannels([]); setLoading(false); return; }
    const peer = peerAddress.toLowerCase();
    let alive = true;
    setLoading(true);
    setChannels([]);

    void (async (): Promise<void> => {
      await hydrateCachedRows().catch(() => undefined);
      const rows = getCachedRows() ?? [];
      /** Group rows only: DMs carry a non-null peerAddress in the cache. */
      const groups = rows.filter((r): r is CachedRow & { peerAddress: null } =>
        r.peerAddress == null);

      const found: CommonChannel[] = [];
      for (const row of groups) {
        if (!alive) return;
        try {
          const conv = await convOfLine(lineOfConv(row.convId));
          if (!conv) continue;
          const members = await groupMemberEthAddresses(conv);
          if (!members.some(a => a.toLowerCase() === peer)) continue;
          found.push({
            convId: row.convId,
            title: typeof row.title === 'string' && row.title.trim()
              ? row.title.trim() : 'Group',
            avatarUri: typeof row.avatarUri === 'string' ? row.avatarUri : null,
            avatarAddress: members[0] ?? null,
            /** members excludes self → +1 for the local user. */
            memberCount: members.length + 1,
          });
          /** Surface incrementally so rows appear as they resolve. */
          if (alive) setChannels([...found]);
        } catch { /* skip groups we can't resolve */ }
      }
      if (alive) { setChannels([...found]); setLoading(false); }
    })();

    return () => { alive = false; };
  }, [peerAddress, enabled]);

  return { channels, loading };
}
