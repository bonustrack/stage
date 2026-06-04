/** Group-detail sub-components — member row + add-member / overflow modals.
 *  Extracted from group/[convId] for lint line-budget. Rendering identical. */

import { Pressable, TextInput } from 'react-native';
import { Text } from '@metro-labs/kit/text';
import { Box } from '../../components/layout';
import { shortAddress } from '../../lib/xmtp';
import { getPeerAvatar, getPeerAvatarCb } from '../../lib/peerProfiles';
import { Icon } from '@metro-labs/kit/icon';
import { Button } from '@metro-labs/kit/button';
import { Avatar } from '../../components/Avatar';
import { AppModal } from '../../components/AppModal';
import { DANGER, usePalette } from '../../lib/theme';

interface Pal { fg: string; head: string; sub: string; border: string; rowBg: string; }

export function MemberRow({
  item, isSelf, isRemovingThis, role, name, dark, p, onPress, onRemove,
}: {
  item: string; isSelf: boolean; isRemovingThis: boolean;
  role: 'owner' | 'admin' | 'member' | undefined; name: string | null | undefined;
  dark: boolean; p: Pal; onPress: () => void; onRemove: () => void;
}): React.ReactElement {
  const { head, sub, border } = p;
  return (
    <Pressable
      onPress={onPress}
      disabled={isRemovingThis}
      style={({ pressed }) => ({
        backgroundColor: pressed ? border : 'transparent',
        flexDirection: 'row', alignItems: 'center', gap: 12,
        paddingHorizontal: 14, paddingVertical: 14,
        borderBottomWidth: 1, borderBottomColor: border,
        opacity: isRemovingThis ? 0.5 : 1,
      })}
    >
      <Avatar
        address={item}
        imageUri={getPeerAvatar(item)}
        cacheBuster={getPeerAvatarCb(item)}
        size="md"
        style={{ backgroundColor: border }}
      />
      <Box style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ color: head, fontSize: 15, fontFamily: 'Calibre-Semibold' }} numberOfLines={1}>
          {name || shortAddress(item)}{isSelf ? ' (you)' : ''}
        </Text>
        {name ? (
          <Text style={{ color: sub, fontSize: 12, marginTop: 2, fontFamily: 'Calibre-Medium' }} numberOfLines={1}>
            {shortAddress(item)}
          </Text>
        ) : null}
      </Box>
      {role && role !== 'member' ? (
        <Box style={{
          paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999,
          backgroundColor: role === 'owner'
            ? (dark ? 'rgba(45,212,191,0.18)' : 'rgba(13,148,136,0.12)')
            : border, // #282a2d / #e4e4e5
        }}>
          <Text style={{
            fontSize: 11, fontFamily: 'Calibre-Medium',
            color: role === 'owner' ? (dark ? '#2dd4bf' : '#0d9488') : sub,
          }}>{role === 'owner' ? 'Owner' : 'Admin'}</Text>
        </Box>
      ) : null}
      {isSelf ? null : (
        <Pressable
          onPress={onRemove}
          disabled={isRemovingThis}
          hitSlop={10}
          style={({ pressed }) => ({
            padding: 6, borderRadius: 999,
            backgroundColor: pressed ? (dark ? '#3a1820' : '#fbe3e8') : 'transparent',
          })}
        >
          <Icon name="trash" size={18} color={DANGER} />
        </Pressable>
      )}
    </Pressable>
  );
}

export function AddMemberModal({
  visible, onClose, addDraft, setAddDraft, adding, onAdd, dark, p,
}: {
  visible: boolean; onClose: () => void;
  addDraft: string; setAddDraft: (s: string) => void; adding: boolean; onAdd: () => void;
  dark: boolean; p: Pal;
}): React.ReactElement {
  const { fg, sub, border, rowBg } = p;
  const { primary, bg } = usePalette();
  return (
    <AppModal visible={visible} onClose={onClose}>
      <Box>
        <TextInput
          value={addDraft}
          onChangeText={setAddDraft}
          placeholder="0x… Ethereum address"
          placeholderTextColor={sub}
          autoCorrect={false}
          autoCapitalize="none"
          autoFocus
          style={{
            color: fg, backgroundColor: rowBg,
            borderWidth: 1, borderColor: border, borderRadius: 10,
            paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, marginBottom: 10,
          }}
        />
        <Button
          variant="primary"
          size="md"
          fullWidth
          dark={dark}
          disabled={adding || !addDraft.trim()}
          onPress={onAdd}
          tintBg={primary}
          tintFg={bg}
          label={adding ? 'Adding…' : 'Add member'}
        />
      </Box>
    </AppModal>
  );
}

export function OverflowModal({
  visible, onClose, leaving, onLeave,
}: {
  visible: boolean; onClose: () => void; leaving: boolean; onLeave: () => void;
}): React.ReactElement {
  return (
    <AppModal visible={visible} onClose={onClose}>
      <Box style={{ gap: 4 }}>
        <Pressable
          onPress={onLeave}
          disabled={leaving}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, opacity: leaving ? 0.5 : 1 }}
        >
          <Icon name="arrowLeft" size={20} color={DANGER} />
          <Text style={{ color: DANGER, fontSize: 16, fontFamily: 'Calibre-Medium' }}>
            {leaving ? 'Leaving…' : 'Leave group'}
          </Text>
        </Pressable>
      </Box>
    </AppModal>
  );
}
