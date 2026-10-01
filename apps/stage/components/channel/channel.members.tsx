import { VirtualList } from '../layout';
import { MemberRow } from './channel.parts';

export function ChannelMembersList({
  members, memberNames, memberRoles, selfAddress, removing, dark, footer,
  onOpenMember, onRemoveMember,
}: {
  members: string[];
  memberNames: Record<string, string | null | undefined>;
  memberRoles: Record<string, 'owner' | 'admin' | 'member' | undefined>;
  selfAddress: string; removing: string | null; dark: boolean;
  footer?: React.ReactElement; onOpenMember: (addr: string) => void; onRemoveMember: (addr: string) => void;
}): React.ReactElement {
  return (
    <VirtualList
      data={members}
      extraData={memberNames}
      keyExtractor={addr => addr.toLowerCase()}
      ListFooterComponent={footer}
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
  );
}
