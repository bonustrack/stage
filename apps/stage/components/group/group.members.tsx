
import { Pressable } from '@stage-labs/kit/react-native/pressable';
import { Text } from '@stage-labs/kit/react-native/text';
import { Glyph } from '@stage-labs/kit/react-native/glyph';
import { Row, VirtualList, PAGE_GUTTER } from '../layout';
import { MemberRow } from './group.parts';
import { usePalette } from '../../lib/theme';
import { IconGroup1 } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconGroup1';
import { IconPlusLarge } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconPlusLarge';

function MembersHeader({ count, onAdd }: { count: number; onAdd: () => void }): React.ReactElement {
  const { text: fg, border } = usePalette();
  return (
    <Row padding={{ x: PAGE_GUTTER, bottom: 8 }} align="center" justify="between">
      <Text size="xs" role="secondary">
        MEMBERS ({count})
      </Text>
      <Pressable
        onPress={onAdd}
        hitSlop={8}
        style={({ pressed }) => ({
          flexDirection: 'row', alignItems: 'center', gap: 5,
          paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999,
          borderWidth: 1, borderColor: border,
          backgroundColor: pressed ? border : 'transparent',
        })}
>
        <Glyph icon={IconGroup1} size={16} color={fg}/>
        <Glyph icon={IconPlusLarge} size={14} color={fg}/>
      </Pressable>
    </Row>
  );
}

export function GroupMembersList({
  members, memberNames, memberRoles, selfAddress, removing, dark,
  onAdd, onOpenMember, onRemoveMember,
}: {
  members: string[];
  memberNames: Record<string, string | null | undefined>;
  memberRoles: Record<string, 'owner' | 'admin' | 'member' | undefined>;
  selfAddress: string; removing: string | null; dark: boolean;
  onAdd: () => void; onOpenMember: (addr: string) => void; onRemoveMember: (addr: string) => void;
}): React.ReactElement {
  return (
    <>
      <MembersHeader count={members.length} onAdd={onAdd}/>
      <VirtualList
        data={members}
        extraData={memberNames}
        keyExtractor={addr => addr.toLowerCase()}
        renderItem={({ item }) => (
          <MemberRow
            item={item}
            isSelf={item.toLowerCase() === selfAddress}
            isRemovingThis={removing === item.toLowerCase()}
            role={memberRoles[item]}
            name={memberNames[item]}
            dark={dark}
            onPress={() => { onOpenMember(item); }}
            onRemove={() => { onRemoveMember(item); }}
/>
        )}
/>
    </>
  );
}
