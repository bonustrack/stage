/** Per-request notification rows for the Notifications page.
 *
 *  Each pending message request (consent 'unknown' conv, from useRequestPreviews)
 *  renders as a single notification entry: "New message request from <name>",
 *  with an avatar and an unread dot when it hasn't been seen yet. Tapping a row
 *  opens the existing /xmtp/requests review flow. Read-state lives in
 *  lib/notifReadState (the page marks all visible rows read on open). */

import { useEffect, useState } from 'react';
import { fontSize } from '@metro-labs/kit/tokens';
import { Pressable } from '@metro-labs/kit/pressable';
import { Text } from '@metro-labs/kit/text';
import { Avatar } from '../Avatar';
import { Box, Col, Row } from '../layout';
import { usePalette, useBlockRadius } from '../../lib/theme';
import { usePeerProfiles, getPeerAvatarCb, getPeerName } from '../../lib/peerProfiles';
import { shortAddress } from '../../modules/messaging';
import { loadNotifReadState, subscribeNotifReadState } from '../../lib/notifReadState';
import type { RequestPreview } from './useRequestPreviews';

function labelFor(p: RequestPreview): string {
  if (p.isGroup) return 'New group message request';
  const name = getPeerName(p.avatarAddress) ?? (p.avatarAddress ? shortAddress(p.avatarAddress) : 'someone');
  return `New message request from ${name}`;
}

export function NotificationsList({
  previews,
  onPress,
}: {
  previews: RequestPreview[];
  onPress: () => void;
}): React.ReactElement | null {
  const { link: head, text: sub, border, bg } = usePalette();
  const blockRadius = useBlockRadius();
  usePeerProfiles(previews.map(p => p.avatarAddress));
  // Re-render labels/dots when read-state or resolved names change.
  const [, force] = useState(0);
  useEffect(() => {
    void loadNotifReadState().then(() => force(n => n + 1));
    return subscribeNotifReadState(() => force(n => n + 1));
  }, []);

  if (previews.length === 0) return null;

  return (
    <Col gap={8}>
      {previews.map(p => (
        <Pressable
          key={p.convId}
          onPress={onPress}
          style={({ pressed }) => ({
            backgroundColor: pressed ? border : 'transparent',
            borderRadius: blockRadius,
            borderWidth: 1,
            borderColor: border,
          })}
        >
          <Row align="center" gap={12} px={12} py={12}>
            <Avatar
              imageUri={p.avatarUri}
              address={!p.avatarUri ? p.avatarAddress : null}
              size={40}
              square={p.isGroup}
              cacheBuster={p.avatarAddress ? getPeerAvatarCb(p.avatarAddress) : undefined}
              style={{ backgroundColor: border }}
            />
            <Col flex={1} style={{ minWidth: 0 }}>
              <Text style={{ color: head, fontSize: fontSize('md'), fontFamily: 'Calibre-Semibold' }} numberOfLines={1}>
                {labelFor(p)}
              </Text>
              <Text style={{ color: sub, fontSize: fontSize('sm'), fontFamily: 'Calibre-Medium' }} numberOfLines={1}>
                Tap to review the request
              </Text>
            </Col>
            <Box style={{ width: 9, height: 9, borderRadius: 999, backgroundColor: head, borderWidth: 2, borderColor: bg }} />
          </Row>
        </Pressable>
      ))}
    </Col>
  );
}
