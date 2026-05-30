/** "Common channels" section on a peer's profile (see ProfileScreen.tsx).
 *  Lists the GROUP conversations the local user and the viewed peer are BOTH
 *  members of, each tappable → that group's conversation. Only mounted for
 *  OTHER users; resolution runs async via `useCommonChannels` so it never
 *  blocks the profile render. Renders nothing until at least one common
 *  channel resolves (or shows a small loader while still walking groups).
 *
 *  Each row reuses the shared `ChannelRow` as flat full-width rows so this
 *  section reads identically to the channels-tab list (no surrounding card,
 *  no chevron). Common channels have no last-message/unread context, so the
 *  preview slot shows the member count and the unread badge is omitted. */

import { ActivityIndicator, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ChannelRow } from './ChannelRow';
import { getPeerAvatarCb } from '../lib/peerProfiles';
import { useCommonChannels } from '../lib/useCommonChannels';
import type { ProfileColors } from './ProfileScreen.parts';

export function CommonChannels({ peerAddress, enabled, c }: {
  peerAddress: string | null;
  enabled: boolean;
  c: ProfileColors;
}): React.ReactElement | null {
  const router = useRouter();
  const { channels, loading } = useCommonChannels(peerAddress, enabled);

  /** Nothing to show, and finished resolving → render nothing at all. */
  if (channels.length === 0 && !loading) return null;

  return (
    <View style={{ marginTop: 20 }}>
      <View style={{
        flexDirection: 'row', alignItems: 'center', gap: 8,
        marginHorizontal: 20, marginBottom: 6,
      }}>
        <Text style={{ color: c.sub, fontSize: 11, fontFamily: 'Calibre-Medium' }}>
          COMMON CHANNELS
        </Text>
        {loading ? <ActivityIndicator size="small" color={c.sub} /> : null}
      </View>

      {/* Flat full-width rows — same look as the channels tab (index.tsx):
          default ChannelRow padding/background, no surrounding card, no
          chevron. Common channels have no preview/unread context, so we pass
          the member count as the subtitle and omit those props. */}
      {channels.map(ch => (
        <ChannelRow
          key={ch.convId}
          title={ch.title}
          avatarUri={ch.avatarUri}
          avatarAddress={ch.avatarUri ? null : ch.avatarAddress}
          cacheBuster={ch.avatarAddress ? getPeerAvatarCb(ch.avatarAddress) : undefined}
          square
          subtitle={`${ch.memberCount} member${ch.memberCount === 1 ? '' : 's'}`}
          onPress={() => router.push({ pathname: '/xmtp/[convId]', params: { convId: ch.convId } })}
        />
      ))}
    </View>
  );
}
