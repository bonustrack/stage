/** Inline channel card rendered inside a message bubble when the body contains a
 *  `metro://xmtp/<convId>` channel link. Shows the target conversation's avatar +
 *  name and, on tap, opens that conversation. Metadata resolves through
 *  `useConvMeta` (DM peer / group name + image); when the user isn't a member of
 *  the target conv `useConvMeta` returns EMPTY, so we fall back to a generic
 *  "Open channel" label keyed on the short convId — the tap still navigates to
 *  `/xmtp/[convId]` (which attempts a sync on arrival). */

import { router } from 'expo-router';
import { Text } from '@metro-labs/kit/text';
import { Avatar } from './Avatar';
import { MediaCard } from './MediaCard';
import { Row, Col } from './layout';
import { useConvMeta } from '../lib/useConvMeta';
import { usePeerProfiles, getPeerName, getPeerAvatar, getPeerAvatarCb } from '../lib/peerProfiles';
import { shortAddress } from '../lib/xmtp';

export function ChannelCard({ convId, dark }: { convId: string; dark: boolean }): React.ReactElement {
  const meta = useConvMeta(convId);
  usePeerProfiles([meta.peerAddr]);
  const fg = dark ? '#e8e9ea' : '#1a1a1a';
  const sub = dark ? '#9aa0a6' : '#65676b';

  const isGroup = meta.isGroup;
  const peer = meta.peerAddr;
  const peerName = getPeerName(peer);
  const title = isGroup
    ? (meta.groupName || 'Channel')
    : (peerName || (peer ? shortAddress(peer) : `Channel ${convId.slice(0, 6)}…`));
  const subtitle = isGroup
    ? (meta.memberAddrs.length ? `${meta.memberAddrs.length} members` : 'Channel')
    : (peer ? 'Direct message' : 'Open channel');

  const avatarUri = isGroup ? (meta.groupImage || null) : (getPeerAvatar(peer) || null);
  const avatarAddress = isGroup ? null : peer;

  const open = (): void => {
    router.push({ pathname: '/xmtp/[convId]', params: { convId } });
  };

  return (
    <MediaCard dark={dark} onPress={open}>
      <Row align="center" gap={10} p={10}>
        <Avatar
          size="md"
          square={isGroup}
          imageUri={avatarUri}
          address={avatarAddress}
          cacheBuster={getPeerAvatarCb(peer)}
        />
        <Col style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={1} style={{ color: fg, fontSize: 16, fontFamily: 'Calibre-Semibold' }}>
            {title}
          </Text>
          <Text numberOfLines={1} style={{ color: sub, fontSize: 13, fontFamily: 'Calibre-Medium' }}>
            {subtitle}
          </Text>
        </Col>
      </Row>
    </MediaCard>
  );
}
