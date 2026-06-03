/** AccountsManager sub-components — account row + the bottom-sheet modal/button.
 *  Extracted for lint line-budget. Rendering identical. */

import { Image, Modal, Pressable } from 'react-native';
import { Box } from './layout';
import { Text } from '@metro-labs/kit/text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getPeerName } from '../lib/peerProfiles';
import { stampBoxAvatarUrl, shortAddress } from '../lib/xmtp';
import { type AccountRecord } from '../lib/accounts';
import { TYPE_LABEL } from './AccountsManager.helpers';

/** Single account row — avatar, name + short address/type, and a trailing slot
 *  (chevron on the active/collapsed row, ⋯ manage affordance on the others). */
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
      <Image
        source={{ uri: stampBoxAvatarUrl(rec.address, 28) }}
        style={{ width: 28, height: 28, borderRadius: 999, backgroundColor: border }}
      />
      <Box style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={1} style={{ color: head, fontSize: 16, fontFamily: 'Calibre-Semibold' }}>
          {getPeerName(rec.address) ?? rec.label ?? shortAddress(rec.address)}
        </Text>
        <Text numberOfLines={1} style={{ color: sub, fontSize: 13, fontFamily: 'Calibre-Medium', marginTop: 1 }}>
          {shortAddress(rec.address)} · {TYPE_LABEL[rec.type]}
        </Text>
      </Box>
      {trailing}
    </Pressable>
  );
}

/** Bottom-sheet style modal — dim backdrop, rounded card pinned to the bottom. */
export function SheetModal({ visible, onClose, children, bg, border, title, head }: {
  visible: boolean; onClose: () => void; children: React.ReactNode;
  bg: string; border: string; title?: string; head: string;
}): React.ReactElement {
  /** Pad the sheet past the Android nav bar so its last row isn't overlapped
   *  / cut off by the system navigation buttons. */
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }}>
        <Pressable onPress={(e) => e.stopPropagation()} style={{ backgroundColor: bg, borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 16, paddingBottom: 28 + insets.bottom, borderTopWidth: 1, borderColor: border }}>
          <Box style={{ alignSelf: 'center', width: 36, height: 4, borderRadius: 2, backgroundColor: border, marginBottom: 12 }} />
          {title ? (
            <Text style={{ color: head, fontSize: 20, fontFamily: 'Calibre-Semibold', marginBottom: 12 }}>{title}</Text>
          ) : null}
          {children}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export function SheetButton({ label, desc, onPress, head, sub, border, danger, dark }: {
  label: string; desc?: string; onPress: () => void;
  head: string; sub: string; border: string; danger?: boolean; dark?: boolean;
}): React.ReactElement {
  const labelColor = danger ? (dark ? '#ff6b80' : '#b91c1c') : head;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        paddingHorizontal: 14, paddingVertical: 12, borderRadius: 12, marginTop: 8,
        borderWidth: 1, borderColor: border,
        backgroundColor: pressed ? border : 'transparent',
      })}
    >
      <Text style={{ color: labelColor, fontSize: 16, fontFamily: 'Calibre-Semibold' }}>{label}</Text>
      {desc ? <Text style={{ color: sub, fontSize: 13, fontFamily: 'Calibre-Medium', marginTop: 2 }}>{desc}</Text> : null}
    </Pressable>
  );
}
