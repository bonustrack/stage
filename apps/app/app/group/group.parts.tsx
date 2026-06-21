
import { Pressable } from '@stage-labs/kit/react-native/pressable';
import { fontSize } from '@stage-labs/kit/tokens';
import { Input } from '@stage-labs/kit/react-native/input';
import { Text } from '@stage-labs/kit/react-native/text';
import { Box, Col } from '../../components/layout';
import { shortAddress } from '../../modules/messaging';
import { Icon } from '@stage-labs/kit/react-native/icon';
import { Button } from '@stage-labs/kit/react-native/button';
import { Avatar } from '../../components/Avatar';
import { AppModal } from '../../components/AppModal';
import { DANGER, usePalette } from '../../lib/theme';

interface Pal { fg: string; head: string; sub: string; border: string; rowBg: string; inputBg: string; }

type MemberRole = 'owner' | 'admin' | 'member' | undefined;

function MemberRoleBadge({ role, sub, border, dark }: {
  role: MemberRole; sub: string; border: string; dark: boolean;
}): React.ReactElement | null {
  if (!role || role === 'member') return null;
  const isOwner = role === 'owner';
  const background = isOwner ? (dark ? 'rgba(45,212,191,0.18)' : 'rgba(13,148,136,0.12)') : border;
  const color = isOwner ? (dark ? '#2dd4bf' : '#0d9488') : sub;
  return (
    <Box radius="full" background={background} padding={{ x: 8, y: 2 }}>
      <Text size="3xs" color={color}>{isOwner ? 'Owner' : 'Admin'}</Text>
    </Box>
  );
}

function MemberRemoveButton({ isSelf, isRemovingThis, dark, onRemove }: {
  isSelf: boolean; isRemovingThis: boolean; dark: boolean; onRemove: () => void;
}): React.ReactElement | null {
  if (isSelf) return null;
  return (
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
  );
}

export function MemberRow({
  item, isSelf, isRemovingThis, role, name, dark, p, onPress, onRemove,
}: {
  item: string; isSelf: boolean; isRemovingThis: boolean;
  role: MemberRole; name: string | null | undefined;
  dark: boolean; p: Pal; onPress: () => void; onRemove: () => void;
}): React.ReactElement {
  const { head, sub, border } = p;
  const displayName = name == null || name === '' ? shortAddress(item) : name;
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
          {displayName}{isSelf ? ' (you)' : ''}
        </Text>
        {name ? (
          <Text size="xs" color={sub} style={{ marginTop: 2 }} numberOfLines={1}>
            {shortAddress(item)}
          </Text>
        ) : null}
      </Col>
      <MemberRoleBadge role={role} sub={sub} border={border} dark={dark}/>
      <MemberRemoveButton isSelf={isSelf} isRemovingThis={isRemovingThis} dark={dark} onRemove={onRemove}/>
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
