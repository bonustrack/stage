
import { Pressable } from '@stage-labs/kit/react-native/pressable';
import { fontSize } from '@stage-labs/kit/tokens';
import { Input } from '@stage-labs/kit/react-native/input';
import { Text } from '@stage-labs/kit/react-native/text';
import { Box } from '../../components/layout';
import { shortAddress } from '../../modules/messaging';
import { Icon } from '@stage-labs/kit/react-native/icon';
import { Button } from '@stage-labs/kit/react-native/button';
import { KitRenderer } from '@stage-labs/kit/react-native/kit-renderer';
import type { WidgetActionRegistry, WidgetRoot } from '@stage-labs/kit/kit';
import { memberRow, MEMBER_PRESS, MEMBER_REMOVE } from '@stage-labs/views';
import { stampAvatarUrl } from '@stage-labs/kit/avatar';
import { AppModal } from '../../components/AppModal';
import { DANGER, usePalette } from '../../lib/theme';

interface Pal { fg: string; head: string; sub: string; border: string; rowBg: string; inputBg: string; }

type MemberRole = 'owner' | 'admin' | 'member' | undefined;

function memberBadgeRole(role: MemberRole): 'owner' | 'admin' | undefined {
  return role === 'owner' || role === 'admin' ? role : undefined;
}

export function MemberRow({
  item, isSelf, isRemovingThis, role, name, dark, p, onPress, onRemove,
}: {
  item: string; isSelf: boolean; isRemovingThis: boolean;
  role: MemberRole; name: string | null | undefined;
  dark: boolean; p: Pal; onPress: () => void; onRemove: () => void;
}): React.ReactElement {
  const { sub, border } = p;
  const displayName = name == null || name === '' ? shortAddress(item) : name;
  const node: WidgetRoot = {
    type: 'ListView',
    children: [
      memberRow({
        memberId: item,
        avatarUri: stampAvatarUrl(item, 40),
        name: `${displayName}${isSelf ? ' (you)' : ''}`,
        address: name ? shortAddress(item) : undefined,
        role: memberBadgeRole(role),
        removable: !isSelf,
        dark,
        borderColor: border,
        subColor: sub,
        dangerColor: DANGER,
        removePressedBg: dark ? '#3a1820' : '#fbe3e8',
      }),
    ],
  };
  const registry: WidgetActionRegistry = {
    [MEMBER_PRESS]: () => {
      if (!isRemovingThis) onPress();
    },
    [MEMBER_REMOVE]: () => {
      if (!isRemovingThis) onRemove();
    },
  };
  return (
    <Box style={{ opacity: isRemovingThis ? 0.5 : 1 }}>
      <KitRenderer node={node} registry={registry} />
    </Box>
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
