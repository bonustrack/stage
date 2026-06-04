/** Pending message-requests card for the Notifications tab.
 *
 *  Surfaces the same pending ('unknown' consent) convs as the channels-tab
 *  topnav counter, but as a tappable card: a count + a horizontally STACKED
 *  pile of the requesters' avatars (overlapping circles, newest on the left).
 *  Tapping opens the existing `/xmtp/requests` flow. Renders nothing when there
 *  are no pending requests. Avatars use the shared Avatar component (stamp.fyi
 *  identicons for DMs / channel-seeded groups, uploaded image when present). */

import { Pressable } from 'react-native';
import { Text } from '@metro-labs/kit/text';
import { Icon } from '@metro-labs/kit/icon';
import { Avatar } from '../Avatar';
import { Box, Col, Row } from '../layout';
import { usePalette, useBlockRadius } from '../../lib/theme';
import { usePeerProfiles, getPeerAvatarCb } from '../../lib/peerProfiles';
import type { RequestPreviews } from './useRequestPreviews';

/** Max avatars rendered in the pile before we stop (count still shows the real
 *  total). Keeps the stack from overflowing the card on a big backlog. */
const MAX_PILE = 4;
const AVATAR_PX = 36;
/** Negative left margin → each avatar overlaps the previous one. */
const OVERLAP = -12;

export function RequestsCard({
  data,
  onPress,
}: {
  data: RequestPreviews;
  onPress: () => void;
}): React.ReactElement | null {
  const { link: head, text: sub, border, bg } = usePalette();
  const blockRadius = useBlockRadius();
  const rowBg = border;
  const { count, previews } = data;
  // Resolve peer profiles so the cache-buster lands once an avatar is known.
  usePeerProfiles(previews.map(p => p.avatarAddress));

  if (count === 0) return null;

  const pile = previews.slice(0, MAX_PILE);
  const label = count === 1 ? '1 message request' : `${count} message requests`;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        backgroundColor: pressed ? border : rowBg,
        borderRadius: blockRadius,
        borderWidth: 1,
        borderColor: border,
      })}
    >
      <Row align="center" gap={12} px={14} py={14}>
        <Row align="center" style={{ flexShrink: 0 }}>
          {pile.map((p, i) => (
            <Box
              key={p.convId}
              style={{
                marginLeft: i === 0 ? 0 : OVERLAP,
                borderRadius: 999,
                borderWidth: 2,
                borderColor: bg,
                zIndex: MAX_PILE - i,
              }}
            >
              <Avatar
                imageUri={p.avatarUri}
                address={!p.avatarUri ? p.avatarAddress : null}
                size={AVATAR_PX}
                square={p.isGroup}
                cacheBuster={p.avatarAddress ? getPeerAvatarCb(p.avatarAddress) : undefined}
                style={{ backgroundColor: border }}
              />
            </Box>
          ))}
        </Row>
        <Col flex={1} style={{ minWidth: 0 }}>
          <Text style={{ color: head, fontSize: 16, fontFamily: 'Calibre-Semibold' }} numberOfLines={1}>
            {label}
          </Text>
          <Text style={{ color: sub, fontSize: 14, fontFamily: 'Calibre-Medium' }} numberOfLines={1}>
            Tap to review who wants to message you
          </Text>
        </Col>
        <Icon name="chevronRight" size={18} color={sub} />
      </Row>
    </Pressable>
  );
}
