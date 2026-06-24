
import { Modal } from 'react-native';

import { Pressable } from '@stage-labs/kit/react-native/pressable';
import { Box, Col, Row } from './layout';
import { Text } from '@stage-labs/kit/react-native/text';
import { ListViewItem } from '@stage-labs/kit/react-native/list-view';
import { ChatKitRenderer } from '@stage-labs/kit/react-native/chatkit-renderer';
import type { WidgetActionRegistry, WidgetRoot } from '@stage-labs/kit/chatkit';
import { accountRow, ACCOUNT_PRESS } from '@stage-labs/views';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getPeerName } from '../lib/peerProfiles';
import { shortAddress } from '../modules/messaging';
import { type AccountRecord } from '../lib/accounts';
import { stampAvatarUrl } from '@stage-labs/kit/avatar';
import { TYPE_LABEL } from './AccountsManager.helpers';
import { DANGER } from '../lib/theme';

export function AccountRow({ rec, onPress, onLongPress, topBorder, trailing, border }: {
  rec: AccountRecord; onPress: () => void; onLongPress: () => void;
  topBorder: boolean; trailing: React.ReactNode;
  border: string;
}): React.ReactElement {
  const node: WidgetRoot = {
    type: 'ListView',
    children: [
      accountRow({
        accountId: rec.address,
        avatarUri: stampAvatarUrl(rec.address, 40),
        name: getPeerName(rec.address) ?? rec.label ?? shortAddress(rec.address),
        address: `${shortAddress(rec.address)} · ${TYPE_LABEL[rec.type]}`,
      }),
    ],
  };
  const registry: WidgetActionRegistry = { [ACCOUNT_PRESS]: () => { onPress(); } };
  return (
    <Pressable
      onLongPress={onLongPress}
      delayLongPress={300}
      style={{ borderTopWidth: topBorder ? 1 : 0, borderTopColor: border }}
>
      <Row align="center">
        <Box flex={1}>
          <ChatKitRenderer node={node} registry={registry} />
        </Box>
        {trailing}
      </Row>
    </Pressable>
  );
}

export function SheetModal({ visible, onClose, children, bg, border }: {
  visible: boolean; onClose: () => void; children: React.ReactNode;
  bg: string; border: string; title?: string; head?: string;
}): React.ReactElement {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }}>
        <Pressable onPress={(e) => { e.stopPropagation(); }} style={{ backgroundColor: bg, borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 16, paddingBottom: 28 + insets.bottom, borderTopWidth: 1, borderColor: border }}>
          <Box width={36} height={4} radius="2xs" background={border} margin={{ bottom: 12 }} style={{ alignSelf: 'center' }}/>
          {children}
        </Pressable>
      </Pressable>
    </Modal>
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
