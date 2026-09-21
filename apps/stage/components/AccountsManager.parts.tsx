
import { Pressable } from '@stage-labs/kit/react-native/pressable';
import { Dialog } from '@stage-labs/kit/react-native/dialog';
import { useWebTabRail } from '../lib/webLayout';
import { sheetPlacement } from './AppModal.model';

const SHEET_BOTTOM_PAD = 28;
import { Box, Col, Row } from './layout';
import { Text } from '@stage-labs/kit/react-native/text';
import { Caption } from '@stage-labs/kit/react-native/caption';
import { Image } from '@stage-labs/kit/react-native/image';
import { ListView, ListViewItem } from '@stage-labs/kit/react-native/list-view';
import { useKitScheme } from '@stage-labs/kit/react-native/theme-context';
import { getPeerName } from '../lib/peerProfiles';
import { shortAddress } from '../modules/messaging';
import { type AccountRecord } from '../lib/accounts';
import { peerAvatarUrl } from '../lib/peerProfiles';
import { TYPE_LABEL } from './AccountsManager.helpers';
import { DANGER } from '../lib/theme';

export function AccountRow({ rec, onPress, onLongPress, topBorder, trailing, border }: {
  rec: AccountRecord; onPress: () => void; onLongPress: () => void;
  topBorder: boolean; trailing: React.ReactNode;
  border: string;
}): React.ReactElement {
  const dark = useKitScheme() === 'dark';
  const name = getPeerName(rec.address) ?? rec.label ?? shortAddress(rec.address);
  const address = `${shortAddress(rec.address)} · ${TYPE_LABEL[rec.type]}`;
  return (
    <Pressable
      onLongPress={onLongPress}
      delayLongPress={300}
      style={{ borderTopWidth: topBorder ? 1 : 0, borderTopColor: border }}
>
      <Row align="center">
        <Box flex={1}>
          <ListView dark={dark}>
            <ListViewItem align="center" gap={12} dark={dark} onPress={onPress}>
              <Row align="center" gap={12} flex={1}>
                <Image src={peerAvatarUrl(rec.address, 40)} size={40} radius="full" />
                <Col gap={2} flex={1}>
                  <Text value={name} weight="semibold" truncate />
                  <Caption value={address} color="secondary" truncate />
                </Col>
              </Row>
            </ListViewItem>
          </ListView>
        </Box>
        {trailing}
      </Row>
    </Pressable>
  );
}

export function SheetModal({ visible, onClose, children, bg, border }: {
  visible: boolean; onClose: () => void; children: React.ReactNode;
  bg: string; border: string;
}): React.ReactElement {
  const place = sheetPlacement(useWebTabRail(), SHEET_BOTTOM_PAD);
  return (
    <Dialog
      open={visible}
      onClose={onClose}
      side={place.side}
      animationType={place.side === 'bottom' ? 'slide' : 'none'}
      backdropColor="rgba(0,0,0,0.45)"
      panelBackground={bg}
      panelRadius={18}
      panelWidth={place.panelWidth}
      panelMaxWidth={place.panelMaxWidth}
      panelPadding={{ x: 16, top: 16, bottom: place.bottomPad }}
      panelBorderColor={place.side === 'bottom' ? border : undefined}
      safeAreaBottom={place.safeAreaBottom}
      handle={place.handle}
      handleColor={border}
    >
      {children}
    </Dialog>
  );
}

export function SheetRow({ label, desc, onPress, head, danger, dark }: {
  label: string; desc?: string; onPress: () => void;
  head: string; danger?: boolean; dark: boolean;
}): React.ReactElement {
  const labelColor = danger ? DANGER : head;
  return (
    <ListViewItem dark={dark} onPress={onPress}>
      <Col flex={1}>
        <Text weight="semibold" size="md" color={labelColor}>{label}</Text>
        {desc ? <Text size="xs" role="secondary" style={{ marginTop: 2 }}>{desc}</Text> : null}
      </Col>
    </ListViewItem>
  );
}
