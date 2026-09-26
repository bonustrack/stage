import { useState } from 'react';
import { Glyph } from '@stage-labs/kit/react-native/glyph';
import { ListViewItem } from '@stage-labs/kit/react-native/list-view';
import { Pressable } from '@stage-labs/kit/react-native/pressable';
import { Text } from '@stage-labs/kit/react-native/text';
import { useKitScheme } from '@stage-labs/kit/react-native/theme-context';
import { Avatar } from '../Avatar';
import { Col, Row } from '../layout';
import { MenuSheet } from '../MenuSheet';
import { menuPointBelow } from '../AnchoredMenu';
import type { MenuPoint } from '../AnchoredMenu.model';
import { usePalette } from '../../lib/theme';
import { getPeerName, usePeerProfiles } from '../../lib/peerProfiles';
import { shortAddress, useActiveAccountRecord } from '../../modules/messaging';
import { SettingsGroupCard } from './SettingsPage';
import { HEADER_AVATAR_SIZE, accountDisplayName, accountSubtitle } from './SettingsAccountHeader.model';
import { IconChevronGrabberVertical } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconChevronGrabberVertical';

const CARD_PADDING = { paddingTop: 14, paddingRight: 8, paddingBottom: 14, paddingLeft: 14 };

export function SettingsAccountHeader({ onOpenProfile }: { onOpenProfile: () => void }): React.ReactElement | null {
  const { text, border } = usePalette();
  const dark = useKitScheme() === 'dark';
  const rec = useActiveAccountRecord();
  const address = rec?.address ?? null;
  usePeerProfiles([address]);
  const [anchor, setAnchor] = useState<MenuPoint | null>(null);
  if (rec === null || address === null) return null;
  const short = shortAddress(address);
  const name = accountDisplayName(getPeerName(address), rec.label, short);
  return (
    <SettingsGroupCard>
      <Row align="center">
        <Col flex={1}>
          <ListViewItem
            dark={dark}
            gap={14}
            onPress={onOpenProfile}
            pressedBackground={border}
            padding={CARD_PADDING}
          >
            <Avatar address={address} size={HEADER_AVATAR_SIZE} />
            <Col flex={1} gap={2}>
              <Text size="2xl" weight="semibold" color="link" truncate>{name}</Text>
              <Text size="sm" color="secondary" truncate>{accountSubtitle(name, short)}</Text>
            </Col>
          </ListViewItem>
        </Col>
        <Pressable
          accessibilityLabel="Switch account"
          hitSlop={8}
          pressedOpacity={0.6}
          onPress={(e) => { setAnchor(menuPointBelow(e)); }}
          style={{ padding: 10, marginRight: 8 }}
        >
          <Glyph icon={IconChevronGrabberVertical} size={20} color={text} />
        </Pressable>
      </Row>
      <MenuSheet visible={anchor !== null} anchor={anchor} onClose={() => { setAnchor(null); }} />
    </SettingsGroupCard>
  );
}
