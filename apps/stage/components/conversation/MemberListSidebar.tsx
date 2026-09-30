import { useMemo, useState } from 'react';
import { Button } from '@stage-labs/kit/react-native/button';
import { useRouter } from 'expo-router';
import { Pressable } from '@stage-labs/kit/react-native/pressable';
import { Text } from '@stage-labs/kit/react-native/text';
import { Glyph } from '@stage-labs/kit/react-native/glyph';
import { DROPDOWN_MENU } from '@stage-labs/kit/react-native/menu';
import { Box, Row, VirtualList, PAGE_GUTTER } from '../layout';
import { Avatar } from '../Avatar';
import { CountTag } from '../CountTag';
import { Eyebrow } from '../Eyebrow';
import { HoverTooltip } from '../HoverTooltip';
import { useSelfAddress } from '../ProfileScreen.parts';
import { assignedEntries, memberListEntries, type MemberAdminMark, type MemberListEntry } from './MemberListSidebar.model';
import { useChannelRoles, useChannelEditRights } from '../channel/channel.detail';
import { AssigneesEditor } from '../channel/AssigneesEditor';
import { useConvMeta, shortAddress } from '../../modules/messaging';
import { getPeerName, usePeerProfiles } from '../../lib/peerProfiles';
import { profileLinkOf } from '../../lib/links';
import { useEffectiveColorScheme, usePalette, withAlpha } from '../../lib/theme';
import { IconCrown } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconCrown';
import { IconShield } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconShield';

const ROW_HEIGHT = 44;
const ROW_INSET = 8;
const ADMIN_ICONS = { superAdmin: IconCrown, admin: IconShield } as const;

function AdminMark({ mark, color }: { mark: MemberAdminMark; color: string }): React.ReactElement {
  return (
    <HoverTooltip label={mark.label}>
      <Row accessible accessibilityRole="image" accessibilityLabel={mark.label}>
        <Glyph icon={ADMIN_ICONS[mark.role]} size={16} color={color}/>
      </Row>
    </HoverTooltip>
  );
}

function MemberListRow({ entry, onPress }: { entry: MemberListEntry; onPress: () => void }): React.ReactElement {
  const { link, border, sub } = usePalette();
  return (
    <Box padding={{ x: ROW_INSET }}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={entry.admin === undefined ? entry.name : `${entry.name}, ${entry.admin.label}`}
        style={({ pressed }) => ({
          flexDirection: 'row', alignItems: 'center', gap: 12, height: ROW_HEIGHT,
          paddingHorizontal: PAGE_GUTTER - ROW_INSET, borderRadius: 8,
          backgroundColor: pressed ? withAlpha(link, DROPDOWN_MENU.pressedAlpha) : 'transparent',
        })}
>
        <Avatar address={entry.address} size="md" style={{ backgroundColor: border }}/>
        <Row align="center" gap={6} flex={1}>
          <Text size="lg" weight="medium" numberOfLines={1} style={{ flexShrink: 1 }}>{entry.name}</Text>
          {entry.admin === undefined ? null : <AdminMark mark={entry.admin} color={sub}/>}
        </Row>
      </Pressable>
    </Box>
  );
}

function useMemberEntries(convId: string): { entries: MemberListEntry[]; assigned: string[]; assignedReady: boolean } {
  const { memberAddrs, inboxToAddr, assigned, assignedReady } = useConvMeta(convId);
  const roles = useChannelRoles(convId, inboxToAddr);
  const self = useSelfAddress();
  const addresses = useMemo(() => (self ? [self, ...memberAddrs] : memberAddrs), [self, memberAddrs]);
  const profiles = usePeerProfiles(addresses);
  const entries = useMemo(
    () => memberListEntries(addresses, getPeerName, shortAddress, roles),
    [addresses, profiles, roles],
  );
  return { entries, assigned, assignedReady };
}

function MemberHeader({ title, count, children }: { title: string; count?: number; children?: React.ReactNode }): React.ReactElement {
  return (
    <Row align="center" gap={8} padding={{ x: PAGE_GUTTER, top: PAGE_GUTTER, bottom: 8 }}>
      <Eyebrow>{title}</Eyebrow>
      {count === undefined ? null : <CountTag count={count}/>}
      <Box flex={1}/>
      {children}
    </Row>
  );
}

function AssigneesSection({ convId, entries, assigned, assignedReady }: {
  convId: string; entries: MemberListEntry[]; assigned: string[]; assignedReady: boolean;
}): React.ReactElement {
  const router = useRouter();
  const dark = useEffectiveColorScheme() === 'dark';
  const rights = useChannelEditRights(convId);
  const [editing, setEditing] = useState(false);
  const selected = assignedEntries(entries, assigned);
  return (
    <>
      <MemberHeader title="Assignees" count={assignedReady ? selected.length : undefined}>
        {assignedReady && rights.appData ? <Button label="Edit" accessibilityLabel="Edit assignees" size="xs" color="secondary" variant="ghost" dark={dark}
          onPress={() => { setEditing(true); }}/> : null}
      </MemberHeader>
      {assignedReady && selected.length === 0 ? <Box padding={{ x: PAGE_GUTTER, bottom: 8 }}><Text size="md" color="secondary">No assignees.</Text></Box> : null}
      {selected.map(entry => <MemberListRow key={entry.address} entry={entry} onPress={() => { router.push(profileLinkOf(entry.address)); }}/>) }
      {editing && assignedReady && rights.appData ? <AssigneesEditor convId={convId} entries={entries} assigned={assigned}
        onClose={() => { setEditing(false); }}/> : null}
    </>
  );
}

export function ChannelAssignees({ convId }: { convId: string }): React.ReactElement {
  return <AssigneesSection convId={convId} {...useMemberEntries(convId)}/>;
}

export function MemberListSidebar({ convId }: { convId: string }): React.ReactElement {
  const router = useRouter();
  const { entries, assigned, assignedReady } = useMemberEntries(convId);
  return (
    <VirtualList
      scroll="self"
      data={entries}
      extraData={assigned}
      keyExtractor={(entry) => entry.address.toLowerCase()}
      contentContainerStyle={{ paddingBottom: PAGE_GUTTER }}
      ListHeaderComponent={<>
        <AssigneesSection convId={convId} entries={entries} assigned={assigned} assignedReady={assignedReady}/>
        <MemberHeader title="Members" count={entries.length}/>
      </>}
      renderItem={({ item }) => (
        <MemberListRow entry={item} onPress={() => { router.push(profileLinkOf(item.address)); }}/>
      )}
    />
  );
}
