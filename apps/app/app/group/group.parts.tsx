/** Group-detail sub-components — member row + add-member / overflow modals.
 *  Extracted from group/[convId] for lint line-budget. Rendering identical. */

import { Pressable } from '@metro-labs/kit/pressable';
import { fontSize } from '@metro-labs/kit/tokens';
import { Input } from '@metro-labs/kit/input';
import { Text } from '@metro-labs/kit/text';
import { Box, Col } from '../../components/layout';
import { shortAddress } from '../../modules/messaging';
import { Icon } from '@metro-labs/kit/icon';
import { Button } from '@metro-labs/kit/button';
import { Avatar } from '../../components/Avatar';
import { AppModal } from '../../components/AppModal';
import { DANGER, usePalette } from '../../lib/theme';

interface Pal { fg: string; head: string; sub: string; border: string; rowBg: string; inputBg: string; }

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
        size="md"
        style={{ backgroundColor: border }}
/>
      <Col minWidth={0} flex={1}>
        <Text weight="semibold" size="md" color={head} numberOfLines={1}>
          {name || shortAddress(item)}{isSelf ? ' (you)' : ''}
        </Text>
        {name ? (
          <Text size="xs" color={sub} style={{ marginTop: 2 }} numberOfLines={1}>
            {shortAddress(item)}
          </Text>
        ) : null}
      </Col>
      {role && role !== 'member' ? (
        <Box radius="full" background={role === 'owner'
            ? (dark ? 'rgba(45,212,191,0.18)' : 'rgba(13,148,136,0.12)')
            : border} padding={{ x: 8, y: 2 }}>
          <Text size="3xs" color={role === 'owner' ? (dark ? '#2dd4bf' : '#0d9488') : sub}>{role === 'owner' ? 'Owner' : 'Admin'}</Text>
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
          <Icon name="trash" size={18} color={DANGER}/>
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
  const { fg, sub, border, inputBg } = p;
  const { primary, bg } = usePalette();
  return (
    <AppModal visible={visible} onClose={onClose}>
      <Box>
        <Input
          value={addDraft}
          onChangeText={setAddDraft}
          placeholder="0x… Ethereum address"
          placeholderTextColor={sub}
          autoFocus
          dark={dark}
          inputProps={{ autoCorrect: false, autoCapitalize: 'none' }}
          style={{
            color: fg, backgroundColor: inputBg,
            borderWidth: 1, borderColor: border, borderRadius: 10,
            paddingHorizontal: 12, paddingVertical: 10, fontSize: fontSize('md'), marginBottom: 10,
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
      <Box gap={4}>
        <Pressable
          onPress={onLeave}
          disabled={leaving}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, opacity: leaving ? 0.5 : 1 }}
>
          <Icon name="arrowLeft" size={20} color={DANGER}/>
          <Text size="md" color={DANGER}>
            {leaving ? 'Leaving…' : 'Leave group'}
          </Text>
        </Pressable>
      </Box>
    </AppModal>
  );
}
