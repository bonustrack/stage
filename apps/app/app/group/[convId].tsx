/** Group detail view — opened by tapping the conversation header title. Lists
 *  members, shows the inline-editable group name, labels + GitHub link. */

import { useEffect, useState } from 'react';

import { useQueryClient } from '@tanstack/react-query';
import { Pressable } from '@metro-labs/kit/pressable';
import { Text } from '@metro-labs/kit/text';
/** RNGH gesture-aware FlatList so vertical scroll composes with the native-stack
 *  edge swipe-back under GestureDetectorProvider (see xmtp/[convId] for rationale). */
import { FlatList } from 'react-native-gesture-handler';
import { Row, Col } from '../../components/layout';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getCachedXmtpClient, getOrCreateXmtpClient, lineOfConv } from '../../modules/messaging';
import { avatarRenderUrl } from '@stage-labs/client/profile/snapshot';
import { usePeerProfiles } from '../../lib/peerProfiles';
import { useEffectiveColorScheme, usePalette } from '../../lib/theme';
import { Icon } from '@metro-labs/kit/icon';
import { ImageViewer } from '../../components/ImageViewer';
import { MemberRow, AddMemberModal, OverflowModal } from './group.parts';
import { GroupProfileHeader, GroupNameEditor, GroupDescriptionEditor } from './group.editor';
import { messagingKeys } from '../../modules/messaging';
import { useGroupDetail } from './group.detail';
import { GroupLabelsSection } from './group.labels';
import { GroupGithubSection } from './group.github';
import { useGroupActions } from './group.actions';

export default function GroupDetail(): React.ReactElement {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const dark = useEffectiveColorScheme() === 'dark';
  const { text: fg, link: head, bg, border, inputBg } = usePalette();
  const sub = fg, rowBg = border;
  const pal = { fg, head, sub, border, rowBg, inputBg };

  const { convId } = useLocalSearchParams<{ convId: string }>();
  const line = lineOfConv(convId ?? '');
  const queryClient = useQueryClient();
  /** Invalidate cached conv metadata so the chat-view topnav (and this screen,
   *  which also reads useConvMeta) picks up rename / new image / description
   *  without a reload. Keyed via the shared messaging key factory. */
  const invalidateConvMeta = (): void => {
    if (convId) void queryClient.invalidateQueries({ queryKey: messagingKeys.convMeta(convId) });
  };

  const a = useGroupActions(line, invalidateConvMeta);
  const {
    name, draft, setDraft, editing, setEditing, saving, saveName,
    description, descriptionDraft, setDescriptionDraft,
    editingDescription, setEditingDescription, savingDescription, saveDescription,
    members, addDraft, setAddDraft, adding, addMember,
    removing, removeMember, imageUrl, uploadingImage, pickImage,
    leaving, leaveGroup,
  } = a;

  /** Shared metadata seeding (convMeta query, deduped) + group-only roles/names,
   *  extracted to a hook for the line cap. */
  const { memberNames, memberRoles } = useGroupDetail(convId, a);
  const [addOpen, setAddOpen] = useState(false);
  /** Lower-cased local wallet address — suppresses the remove button on self. */
  const [selfAddress, setSelfAddress] = useState<string>('');
  /** When set, the fullscreen ImageViewer shows the group image. */
  const [viewerOpen, setViewerOpen] = useState(false);
  /** Overflow (3-dot) menu in the group-info topnav. */
  const [overflowOpen, setOverflowOpen] = useState(false);

  /** Resolve each member's Snapshot profile so the rows pick up custom avatars. */
  const profilesVersion = usePeerProfiles(members);

  useEffect(() => {
    const c = getCachedXmtpClient();
    if (c) { setSelfAddress(c.publicIdentity.identifier.toLowerCase()); return; }
    void getOrCreateXmtpClient('production').then(client => {
      setSelfAddress(client.publicIdentity.identifier.toLowerCase());
    }).catch(() => undefined);
  }, []);

  return (
    <Col surface="surface" flex={1}>
      {/* Floating topnav over the cover banner — mirrors ProfileScreen `route`. */}
      <Row height={44 + insets.top} padding={{ x: 14, top: insets.top }} align="center" justify="between" style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 2 }}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={{ padding: 6 }}>
          <Icon name="arrowLeft" size={22} color={fg}/>
        </Pressable>
        <Pressable onPress={() => setOverflowOpen(true)} hitSlop={10} style={{ padding: 6 }}>
          <Icon name="dotsHorizontal" size={22} color={fg}/>
        </Pressable>
      </Row>

      <GroupProfileHeader
        insetTop={insets.top} imageUrl={imageUrl} channelId={convId ?? ''} uploadingImage={uploadingImage}
        fg={fg} sub={sub} bg={bg} rowBg={rowBg}
        onTap={() => { if (imageUrl) setViewerOpen(true); else void pickImage(); }}
        onPick={() => { void pickImage(); }}
/>

      <GroupNameEditor
        name={name} draft={draft} setDraft={setDraft}
        editing={editing} setEditing={setEditing} saving={saving}
        onSave={() => { void saveName(); }} dark={dark} p={pal}
/>

      <GroupDescriptionEditor
        description={description} descriptionDraft={descriptionDraft} setDescriptionDraft={setDescriptionDraft}
        editing={editingDescription} setEditing={setEditingDescription} saving={savingDescription}
        onSave={() => { void saveDescription(); }} dark={dark} p={pal}
/>

      <GroupLabelsSection line={line} p={pal}/>
      <GroupGithubSection line={line} p={pal}/>
      {/** MEMBERS header: label + add-member button → opens add-by-address modal. */}
      <Row padding={{ x: 16, bottom: 8 }} align="center" justify="between">
        <Text size="xs" color={sub}>
          MEMBERS ({members.length})
        </Text>
        <Pressable
          onPress={() => { setAddDraft(''); setAddOpen(true); }}
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
      <FlatList
        data={members}
        extraData={profilesVersion}
        keyExtractor={addr => addr.toLowerCase()}
        renderItem={({ item }) => (
          <MemberRow
            item={item}
            isSelf={item.toLowerCase() === selfAddress}
            isRemovingThis={removing === item.toLowerCase()}
            role={memberRoles[item]}
            name={memberNames[item]}
            dark={dark}
            p={pal}
            onPress={() => router.push({ pathname: '/user/[address]', params: { address: item } })}
            onRemove={() => removeMember(item)}
/>
        )}
/>

      <AddMemberModal
        visible={addOpen}
        onClose={() => setAddOpen(false)}
        addDraft={addDraft} setAddDraft={setAddDraft} adding={adding}
        onAdd={() => { void addMember(() => setAddOpen(false)); }}
        dark={dark} p={pal}
/>
      <OverflowModal
        visible={overflowOpen}
        onClose={() => setOverflowOpen(false)}
        leaving={leaving} onLeave={() => leaveGroup(() => setOverflowOpen(false))}
/>
      <ImageViewer
        uri={imageUrl ? avatarRenderUrl('', imageUrl, 1024) : ''}
        visible={viewerOpen}
        onClose={() => setViewerOpen(false)}
/>
    </Col>
  );
}
