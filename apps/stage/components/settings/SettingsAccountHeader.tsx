import { useState } from 'react';
import { Icon } from '@stage-labs/kit/react-native/icon';
import { Pressable } from '@stage-labs/kit/react-native/pressable';
import { Text } from '@stage-labs/kit/react-native/text';
import { Avatar } from '../Avatar';
import { Col, Row } from '../layout';
import { MenuSheet } from '../MenuSheet';
import { menuPointBelow } from '../AnchoredMenu';
import type { MenuPoint } from '../AnchoredMenu.model';
import { usePalette } from '../../lib/theme';
import { getPeerName, usePeerProfiles } from '../../lib/peerProfiles';
import { shortAddress, useActiveAccountRecord } from '../../modules/messaging';
import { HEADER_AVATAR_SIZE, accountDisplayName } from './SettingsAccountHeader.model';

export function SettingsAccountHeader(): React.ReactElement | null {
  const { text } = usePalette();
  const rec = useActiveAccountRecord();
  const address = rec?.address ?? null;
  usePeerProfiles([address]);
  const [anchor, setAnchor] = useState<MenuPoint | null>(null);
  if (rec === null || address === null) return null;
  const short = shortAddress(address);
  const name = accountDisplayName(getPeerName(address), rec.label, short);
  return (
    <Col align="center" gap={16} padding={{ top: 8, bottom: 24 }}>
      <Avatar address={address} size={HEADER_AVATAR_SIZE} />
      <Pressable accessibilityLabel="Switch account" onPress={(e) => { setAnchor(menuPointBelow(e)); }} hitSlop={8}>
        <Col align="center" gap={2}>
          <Row align="center" gap={6}>
            <Text size="6xl" weight="semibold" numberOfLines={1}>{name}</Text>
            <Icon name="chevronDown" size={20} color={text} />
          </Row>
          {name === short ? null : <Text size="sm" color={text}>{short}</Text>}
        </Col>
      </Pressable>
      <MenuSheet visible={anchor !== null} anchor={anchor} onClose={() => { setAnchor(null); }} />
    </Col>
  );
}
