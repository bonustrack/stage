/** Helpers + the result/contact row for the Search screen, split out to keep
 *  search.tsx under the line cap. Behaviour is identical to the inlined version. */

import { Pressable } from 'react-native';
import { Text } from '@metro-labs/kit/text';
import { Box } from '../components/layout';
import { Spinner } from '../components/Spinner';
import { Avatar } from '../components/Avatar';
import { shortAddress } from '../lib/xmtp';
import { getPeerAvatarCb } from '../lib/peerProfiles';
import { getCachedRows } from '../lib/channelsCache';

/** Cheap pre-flight — accept any *.eth (or longer multi-label) as ENS-resolvable. */
export function looksLikeEns(s: string): boolean {
  return /^[a-z0-9-]+(\.[a-z0-9-]+)+\.eth$|^[a-z0-9-]+\.eth$/i.test(s.trim());
}

/** Existing DM peers (address-keyed) pulled straight from the cached channels list. */
export function getExistingPeers(): { address: string; convId: string }[] {
  const rows = getCachedRows() ?? [];
  const seen = new Set<string>();
  const peers: { address: string; convId: string }[] = [];
  for (const r of rows) {
    const a = (r as { peerAddress?: string | null; convId?: string }).peerAddress;
    const c = (r as { peerAddress?: string | null; convId?: string }).convId;
    if (!a || !c) continue;
    const k = a.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    peers.push({ address: a, convId: c });
  }
  return peers;
}

export interface SearchRowColors { fg: string; head: string; sub: string; border: string }

/** One tappable address row — used for both the resolved result and existing
 *  contacts. `trailing` is the right-side affordance (chat icon / nothing). */
export function SearchRow({
  address, title, opening, trailing, onPress, c,
}: {
  address: string;
  title: string;
  /** Optional secondary line (short address); omitted when it'd duplicate title. */
  opening: boolean;
  trailing?: React.ReactNode;
  onPress: () => void;
  c: SearchRowColors;
}): React.ReactElement {
  const showSub = title !== shortAddress(address);
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        backgroundColor: pressed ? c.border : 'transparent',
        flexDirection: 'row', alignItems: 'center', gap: 12,
        paddingHorizontal: 14, paddingVertical: 14,
        borderBottomWidth: 1, borderBottomColor: c.border,
      })}
    >
      <Avatar
        address={address}
        size="md"
        cacheBuster={getPeerAvatarCb(address)}
        style={{ backgroundColor: c.border }}
      />
      <Box style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ color: c.head, fontSize: 16, fontFamily: 'Calibre-Semibold' }} numberOfLines={1}>
          {title}
        </Text>
        {showSub ? (
          <Text style={{ color: c.sub, fontSize: 13, fontFamily: 'Calibre-Medium', marginTop: 2 }} numberOfLines={1}>
            {shortAddress(address)}
          </Text>
        ) : null}
      </Box>
      {opening ? <Spinner size={20} color={c.head} /> : trailing}
    </Pressable>
  );
}
