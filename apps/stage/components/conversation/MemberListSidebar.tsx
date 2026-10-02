import { useMemo } from 'react';
import { useRouter } from 'expo-router';
import { Pressable } from '@stage-labs/kit/react-native/pressable';
import { Text } from '@stage-labs/kit/react-native/text';
import { Glyph } from '@stage-labs/kit/react-native/glyph';
import { DROPDOWN_MENU } from '@stage-labs/kit/react-native/menu';
import { Box, Row, VirtualList, PAGE_GUTTER } from '../layout';
import { Avatar } from '../Avatar';
import { HoverTooltip } from '../HoverTooltip';
import { useSelfAddress } from '../ProfileScreen.parts';
import { assignedEntries, memberChanges, memberEditsText, memberListEntries, type MemberAdminMark, type MemberListEntry } from './MemberListSidebar.model';
import { confirmMemberRemoval, useChannelRoles, useChannelEditRights, useConvMetaPatch } from '../channel/channel.detail';
import { ChannelCategory, ChannelLabels, useLiveChannelLabels } from '../channel/channel.labels';
import { SectionNote, SidebarSection } from './SidebarSection';
import { applyListEdits, hasListEdits, type ListEdits } from './SidebarSection.model';
import { AssigneePicker, MembersPicker } from './MemberListSidebar.pickers';
import {
  addGroupMembers, invalidateConvMeta, removeGroupMembers, shortAddress, updateGroupAssigned, useConvMeta,
} from '../../modules/messaging';
import { capabilities } from '../../lib/capabilities';
import { getPeerName, usePeerProfiles } from '../../lib/peerProfiles';
import { profileLinkOf } from '../../lib/links';
import { usePalette, withAlpha } from '../../lib/theme';
import { IconCrown } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconCrown';
import { IconShield } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconShield';
import { IconGroup1 } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconGroup1';
import { IconPeopleAdded } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconPeopleAdded';

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
          <Text size="xs" weight="medium" numberOfLines={1} style={{ flexShrink: 1 }}>{entry.name}</Text>
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

function errorLine(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message.split('\n')[0] ?? fallback : fallback;
}

function AssigneesSection({ convId, entries, assigned, assignedReady }: {
  convId: string; entries: MemberListEntry[]; assigned: string[]; assignedReady: boolean;
}): React.ReactElement {
  const router = useRouter();
  const rights = useChannelEditRights(convId);
  const patchMeta = useConvMetaPatch(convId);
  const selected = assignedEntries(entries, assigned);
  const commit = (edits: ListEdits): void => {
    void updateGroupAssigned(convId, applyListEdits(assigned, edits))
      .then(written => { patchMeta({ assigned: written }); })
      .catch((err: unknown) => {
        invalidateConvMeta(convId);
        capabilities.toast(errorLine(err, 'Could not save assignees.'));
      });
  };
  return (
    <SidebarSection title="Assignees" icon={IconPeopleAdded} count={assignedReady ? selected.length : undefined} editLabel="Edit assignees"
      canEdit={assignedReady && rights.appData} current={assigned} onCommit={commit}
      renderPicker={(draft) => <AssigneePicker {...draft} entries={entries}/>}>
      {assignedReady && selected.length === 0 ? <SectionNote text="No assignees."/> : null}
      {selected.map(entry => <MemberListRow key={entry.address} entry={entry} onPress={() => { router.push(profileLinkOf(entry.address)); }}/>) }
    </SidebarSection>
  );
}

async function applyMemberEdits(convId: string, entries: MemberListEntry[], wanted: ListEdits): Promise<void> {
  const changes = memberChanges(entries.map(entry => entry.address), wanted);
  const names = changes.removed.map(address => entries.find(entry => entry.address.toLowerCase() === address.toLowerCase())?.name ?? shortAddress(address));
  const confirmed = changes.removed.length === 0 || await confirmMemberRemoval(names);
  const edits = confirmed ? changes : { added: changes.added, removed: [] };
  if (!hasListEdits(edits)) return;
  try {
    if (edits.removed.length > 0) await removeGroupMembers(convId, edits.removed);
    if (edits.added.length > 0) await addGroupMembers(convId, edits.added);
    capabilities.toast(memberEditsText(edits));
  } catch (err) {
    capabilities.toast(errorLine(err, 'Could not update members.'));
  } finally {
    invalidateConvMeta(convId);
  }
}

function MembersSection({ convId, entries, count = entries.length }: {
  convId: string; entries: MemberListEntry[]; count?: number;
}): React.ReactElement {
  const rights = useChannelEditRights(convId);
  const self = useSelfAddress();
  const memberRights = { add: rights.addMembers, remove: rights.removeMembers };
  return (
    <SidebarSection title="Members" icon={IconGroup1} count={count} editLabel="Edit members"
      canEdit={memberRights.add || memberRights.remove} current={entries.map(entry => entry.address.toLowerCase())}
      onCommit={(edits) => { void applyMemberEdits(convId, entries, edits); }}
      renderPicker={(draft) => <MembersPicker {...draft} entries={entries} self={self} rights={memberRights}/>}/>
  );
}

export function ChannelAssignees({ convId }: { convId: string }): React.ReactElement {
  return <AssigneesSection convId={convId} {...useMemberEntries(convId)}/>;
}

export function ChannelMembersSection({ convId, count }: { convId: string; count: number }): React.ReactElement {
  return <MembersSection convId={convId} entries={useMemberEntries(convId).entries} count={count}/>;
}

export function MemberListSidebar({ convId }: { convId: string }): React.ReactElement {
  const router = useRouter();
  const { entries, assigned, assignedReady } = useMemberEntries(convId);
  const labels = useLiveChannelLabels(convId);
  return (
    <VirtualList
      scroll="self"
      data={entries}
      extraData={assigned}
      keyExtractor={(entry) => entry.address.toLowerCase()}
      contentContainerStyle={{ paddingBottom: PAGE_GUTTER }}
      ListHeaderComponent={<MembersSection convId={convId} entries={entries}/>}
      ListFooterComponent={<>
        <AssigneesSection convId={convId} entries={entries} assigned={assigned} assignedReady={assignedReady}/>
        <ChannelLabels convId={convId} labels={labels}/>
        <ChannelCategory convId={convId}/>
      </>}
      renderItem={({ item }) => (
        <MemberListRow entry={item} onPress={() => { router.push(profileLinkOf(item.address)); }}/>
      )}
    />
  );
}
