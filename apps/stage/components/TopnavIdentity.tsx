
import { useState } from 'react';

import { Image } from '@stage-labs/kit/react-native/image';
import { Pressable } from '@stage-labs/kit/react-native/pressable';
import { Text } from '@stage-labs/kit/react-native/text';
import { Row, Col } from './layout';
import { MenuSheet } from './MenuSheet';
import { menuPointBelow } from './AnchoredMenu';
import type { MenuPoint } from './AnchoredMenu.model';
import { usePalette } from '../lib/theme';
import { usePeerProfiles, getPeerName, peerAvatarUrl } from '../lib/peerProfiles';
import { shortAddress, useActiveAccountRecord } from '../modules/messaging';

export function TopnavIdentity(): React.ReactElement {
  const { border } = usePalette();
  const [menuAnchor, setMenuAnchor] = useState<MenuPoint | null>(null);
  const myAddress = useActiveAccountRecord()?.address ?? null;

  usePeerProfiles([myAddress]);
  const myName = myAddress ? (getPeerName(myAddress) ?? shortAddress(myAddress)) : '';

  return (
    <>
      <Pressable onPress={(e) => { setMenuAnchor(menuPointBelow(e)); }} hitSlop={8}>
        <Row align="center" gap={8}>
          {myAddress ? (
            <Image src={peerAvatarUrl(myAddress, 28)} size={28} radius="full" background={border} />
          ) : (
            <Col size={28} radius="full" background={border} />
          )}
          {myName !== '' ? (
            <Row maxWidth={200}>
              <Text value={myName} size="4xl" weight="semibold" color="link" truncate />
            </Row>
          ) : null}
        </Row>
      </Pressable>
      <MenuSheet visible={menuAnchor !== null} anchor={menuAnchor} onClose={() => { setMenuAnchor(null); }} />
    </>
  );
}
