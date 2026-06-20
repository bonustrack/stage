/** @file Group-detail members section: the MEMBERS header with add button and the gesture-aware member FlatList. */

import { Pressable } from '@stage-labs/kit/pressable';
import { Text } from '@stage-labs/kit/text';
import { Icon } from '@stage-labs/kit/icon';
/** RNGH gesture-aware FlatList so vertical scroll composes with the native-stack edge swipe-back under GestureDetectorProvider (see xmtp/[convId] for rationale). */
import { FlatList } from 'react-native-gesture-handler';
import { Row } from '../../components/layout';
import { MemberRow } from './group.parts';

interface Pal { fg: string; head: string; sub: string; border: string; rowBg: string; inputBg: string; }

/** Header row above the member list: count label + add-member button. */
function MembersHeader({ count, fg, sub, border, onAdd }: {
  count: number; fg: string; sub: string; border: string; onAdd: () => void;
}): React.ReactElement {
  return (
    <Row padding={{ x: 16, bottom: 8 }} align="center" justify="between">
      <Text size="xs" color={sub}>
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
        <Icon name="users" size={16} color={fg}/>
        <Icon name="plus" size={14} color={fg}/>
      </Pressable>
    </Row>
  );
}

/** MEMBERS header + scrollable member list with per-row navigation and removal. */
export function GroupMembersList({
  members, memberNames, memberRoles, selfAddress, removing, dark, p,
  onAdd, onOpenMember, onRemoveMember,
}: {
  members: string[];
  memberNames: Record<string, string | null | undefined>;
  memberRoles: Record<string, 'owner' | 'admin' | 'member' | undefined>;
  selfAddress: string; removing: string | null; dark: boolean; p: Pal;
  onAdd: () => void; onOpenMember: (addr: string) => void; onRemoveMember: (addr: string) => void;
}): React.ReactElement {
  return (
    <>
      <MembersHeader count={members.length} fg={p.fg} sub={p.sub} border={p.border} onAdd={onAdd}/>
      <FlatList
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
            p={p}
            onPress={() => { onOpenMember(item); }}
            onRemove={() => { onRemoveMember(item); }}
/>
        )}
/>
    </>
  );
}
