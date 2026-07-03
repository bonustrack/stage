
import { Pressable } from '@stage-labs/kit/react-native/pressable';
import { Dialog } from '@stage-labs/kit/react-native/dialog';
import { Box, Col, Row } from './layout';
import { Text } from '@stage-labs/kit/react-native/text';
import { ListViewItem } from '@stage-labs/kit/react-native/list-view';
import { ViewHost } from '@stage-labs/kit/react-native/view-host';
import type { PayloadHandlers } from '@stage-labs/kit/kit';
import { accountRow, listRoot, ACCOUNT_PRESS } from '@stage-labs/views';
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
  const node = listRoot(
    accountRow({
      accountId: rec.address,
      avatarUri: stampAvatarUrl(rec.address, 40),
      name: getPeerName(rec.address) ?? rec.label ?? shortAddress(rec.address),
      address: `${shortAddress(rec.address)} · ${TYPE_LABEL[rec.type]}`,
    }),
  );
  const actions: PayloadHandlers = { [ACCOUNT_PRESS]: () => { onPress(); } };
  return (
    <Pressable
      onLongPress={onLongPress}
      delayLongPress={300}
      style={{ borderTopWidth: topBorder ? 1 : 0, borderTopColor: border }}
>
      <Row align="center">
        <Box flex={1}>
          <ViewHost node={node} actions={actions} />
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
  return (
    <Dialog
      open={visible}
      onClose={onClose}
      side="bottom"
      animationType="slide"
      backdropColor="rgba(0,0,0,0.45)"
      panelBackground={bg}
      panelRadius={18}
      panelPadding={{ x: 16, top: 16, bottom: 28 }}
      panelBorderColor={border}
      safeAreaBottom
      handle
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
