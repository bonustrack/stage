
import { Modal } from 'react-native';

import { Pressable } from '@stage-labs/kit/pressable';
import { Box, Col } from './layout';
import { Avatar } from './Avatar';
import { Text } from '@stage-labs/kit/text';
import { ListViewItem } from '@stage-labs/kit/list-view';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getPeerName } from '../lib/peerProfiles';
import { shortAddress } from '../modules/messaging';
import { type AccountRecord } from '../lib/accounts';
import { TYPE_LABEL } from './AccountsManager.helpers';
import { DANGER } from '../lib/theme';

export function AccountRow({ rec, onPress, onLongPress, topBorder, trailing, head, sub, border }: {
  rec: AccountRecord; onPress: () => void; onLongPress: () => void;
  topBorder: boolean; trailing: React.ReactNode;
  head: string; sub: string; border: string;
}): React.ReactElement {
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={300}
      style={({ pressed }) => ({
        paddingHorizontal: 14, paddingVertical: 12,
        flexDirection: 'row', alignItems: 'center', gap: 12,
        borderTopWidth: topBorder ? 1 : 0, borderTopColor: border,
        backgroundColor: pressed ? border : 'transparent',
      })}
>
      <Avatar address={rec.address} size={28} style={{ backgroundColor: border }}/>
      <Col minWidth={0} flex={1}>
        <Text weight="semibold" size="md" numberOfLines={1} color={head}>
          {getPeerName(rec.address) ?? rec.label ?? shortAddress(rec.address)}
        </Text>
        <Text size="xs" numberOfLines={1} color={sub} style={{ marginTop: 1 }}>
          {shortAddress(rec.address)} · {TYPE_LABEL[rec.type]}
        </Text>
      </Col>
      {trailing}
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

export function SheetRow({ label, desc, onPress, head, sub, danger, dark }: {
  label: string; desc?: string; onPress: () => void;
  head: string; sub: string; danger?: boolean; dark: boolean;
}): React.ReactElement {
  const labelColor = danger ? DANGER : head;
  return (
    <ListViewItem dark={dark} onPress={onPress}>
      <Col flex={1}>
        <Text weight="semibold" size="md" color={labelColor}>{label}</Text>
        {desc ? <Text size="xs" color={sub} style={{ marginTop: 2 }}>{desc}</Text> : null}
      </Col>
    </ListViewItem>
  );
}
