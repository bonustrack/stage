
import { Text } from '@stage-labs/kit/react-native/text';
import { Caption } from '@stage-labs/kit/react-native/caption';
import { Image } from '@stage-labs/kit/react-native/image';
import { ListViewItem } from '@stage-labs/kit/react-native/list-view';
import { Box, Col, Row } from '../layout';
import { shortAddress } from '../../modules/messaging';
import { Icon } from '@stage-labs/kit/react-native/icon';
import { Button } from '@stage-labs/kit/react-native/button';
import { MEMBER_OWNER_BG, MEMBER_OWNER_FG } from '../../lib/uiColors';
import { memberRowModel, type GroupMemberRole, type MemberRowBadge } from './group.parts.model';
import { stampAvatarUrl } from '@stage-labs/kit/avatar';
import { AppModal } from '../AppModal';
import { AnchoredMenu } from '../AnchoredMenu';
import { MenuList, MenuRow } from '../MenuRows';
import type { MenuPoint } from '../AnchoredMenu.model';
import { FormField } from '../FormField';
import { DANGER, useEffectiveColorScheme, usePalette } from '../../lib/theme';

interface Pal { fg: string; head: string; sub: string; border: string; rowBg: string; inputBg: string; }

function MemberBadge({ badge, border, sub, dark }: {
  badge: MemberRowBadge; border: string; sub: string; dark: boolean;
}): React.ReactElement {
  const scheme = dark ? 'dark' : 'light';
  const owner = badge.role === 'owner';
  return (
    <Box
      direction="row"
      align="center"
      padding={{ x: 8, y: 2 }}
      radius="full"
      background={owner ? MEMBER_OWNER_BG[scheme] : border}
    >
      <Text
        value={badge.label}
        size="3xs"
        weight="medium"
        color={owner ? MEMBER_OWNER_FG[scheme] : sub}
      />
    </Box>
  );
}

export function MemberRow({
  item, isSelf, isRemovingThis, role, name, dark, p, onPress, onRemove,
}: {
  item: string; isSelf: boolean; isRemovingThis: boolean;
  role: GroupMemberRole; name: string | null | undefined;
  dark: boolean; p: Pal; onPress: () => void; onRemove: () => void;
}): React.ReactElement {
  const { sub, border } = p;
  const model = memberRowModel({ shortAddress: shortAddress(item), name, isSelf, role });
  return (
    <Box style={{ opacity: isRemovingThis ? 0.5 : 1 }}>
      <ListViewItem
        align="center"
        gap={12}
        dark={dark}
        padding={{ paddingTop: 14, paddingRight: 14, paddingBottom: 14, paddingLeft: 14 }}
        border={{ bottom: { width: 1, color: border } }}
        pressedBackground={border}
        onPress={() => {
          if (!isRemovingThis) onPress();
        }}
      >
        <Row align="center" gap={12} flex={1}>
          <Image src={stampAvatarUrl(item, 40)} size={40} radius="full" background={border} />
          <Col gap={2} flex={1}>
            <Text value={model.displayName} weight="semibold" truncate />
            {model.addressLine === undefined ? null : (
              <Caption value={model.addressLine} color="secondary" truncate />
            )}
          </Col>
          {model.badge === undefined ? null : (
            <MemberBadge badge={model.badge} border={border} sub={sub} dark={dark} />
          )}
          {isSelf ? null : (
            <Button
              color="primary"
              variant="ghost"
              uniform
              size="xs"
              radius={999}
              dark={dark}
              tintFg={DANGER}
              tintPressedBg={dark ? '#3a1820' : '#fbe3e8'}
              iconStart={<Icon name="trash" size={18} color={DANGER} dark={dark} />}
              onPress={() => {
                if (!isRemovingThis) onRemove();
              }}
            />
          )}
        </Row>
      </ListViewItem>
    </Box>
  );
}

export function AddMemberModal({
  visible, onClose, addDraft, setAddDraft, adding, onAdd, dark,
}: {
  visible: boolean; onClose: () => void;
  addDraft: string; setAddDraft: (s: string) => void; adding: boolean; onAdd: () => void;
  dark: boolean;
}): React.ReactElement {
  const { primary, bg } = usePalette();
  return (
    <AppModal visible={visible} onClose={onClose}>
      <Box>
        <Box margin={{ bottom: 10 }}>
          <FormField label="Address" placeholder="0x… Ethereum address" value={addDraft} onChangeText={setAddDraft}
            inputProps={{ autoFocus: true, autoCapitalize: 'none', autoCorrect: false }} />
        </Box>
        <Button
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
  visible, onClose, anchor, leaving, onLeave,
}: {
  visible: boolean; onClose: () => void; anchor?: MenuPoint | null;
  leaving: boolean; onLeave: () => void;
}): React.ReactElement {
  const dark = useEffectiveColorScheme() === 'dark';
  return (
    <AnchoredMenu visible={visible} onClose={onClose} anchor={anchor}>
      <MenuList dark={dark}>
        <MenuRow icon="arrowLeft" label={leaving ? 'Leaving…' : 'Leave group'} danger dark={dark}
          onPress={() => { if (!leaving) onLeave(); }} />
      </MenuList>
    </AnchoredMenu>
  );
}
