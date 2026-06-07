/** Row + helpers for the Home contact-search results (HomeScreen.contacts).
 *  Split out to keep the line cap. Ported from the former search.helpers. */

import { Pressable } from 'react-native';
import { Text } from '@metro-labs/kit/text';
import { Box } from '../layout';
import { Spinner } from '../Spinner';
import { Avatar } from '../Avatar';
import { shortAddress } from '../../lib/xmtp';
import { getPeerAvatarCb } from '../../lib/peerProfiles';
import { getCachedRows } from '../../lib/channelsCache';

/** Cheap pre-flight — accept any `*.eth` (single or multi-label) as resolvable. */
export function looksLikeEns(s: string): boolean {
  return /^[a-z0-9-]+(\.[a-z0-9-]+)*\.eth$/i.test(s.trim());
}

/** Existing DM peers (address-keyed) pulled from the cached channels list. */
export function getExistingPeers(): { address: string; convId: string }[] {
  const rows = getCachedRows() ?? [];
  const seen = new Set<string>();
  const peers: { address: string; convId: string }[] = [];
  for (const r of rows) {
    const a = (r as { peerAddress?: string | null; convId?: string }).peerAddress;
    const cid = (r as { peerAddress?: string | null; convId?: string }).convId;
    if (!a || !cid) continue;
    const k = a.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    peers.push({ address: a, convId: cid });
  }
  return peers;
}

interface RowColors { fg: string; head: string; sub: string; border: string }

/** One tappable contact row — resolved result OR existing contact. `trailing`
 *  is the right-side affordance (chat icon for a start-a-chat result). */
export function ContactRow({
  address, title, opening, trailing, onPress, c,
}: {
  address: string;
  title: string;
  opening: boolean;
  trailing?: React.ReactNode;
  onPress: () => void;
  c: RowColors;
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
