/** Group detail view — opened by tapping the conversation header title. Lists
 *  members (avatar + short address; tap → user profile), shows the group name
 *  inline-editable. DMs don't get this view (they have no group metadata). */

import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Pressable } from 'react-native';
import { Text } from '@metro-labs/kit/text';
/** RNGH gesture-aware FlatList so vertical scroll composes with the native-stack
 *  edge swipe-back under GestureDetectorProvider (see xmtp/[convId] for rationale). */
import { FlatList } from 'react-native-gesture-handler';
import { Box } from '../../components/layout';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getCachedXmtpClient, getOrCreateXmtpClient, lineOfConv } from '../../lib/xmtp';
import { avatarRenderUrl } from '@metro-labs/client/profile/snapshot';
import { usePeerProfiles } from '../../lib/peerProfiles';
import { useEffectiveColorScheme, usePalette } from '../../lib/theme';
import { Icon } from '@metro-labs/kit/icon';
import { ImageViewer } from '../../components/ImageViewer';
import { MemberRow, AddMemberModal, OverflowModal } from './group.parts';
import { GroupImageEditor, GroupNameEditor, GroupDescriptionEditor } from './group.editor';
import { loadGroupDetail } from './group.helpers';
import { useGroupActions } from './group.actions';

export default function GroupDetail(): React.ReactElement {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const dark = useEffectiveColorScheme() === 'dark';
  const { fg, head, sub, bg, border, rowBg } = usePalette();
  const pal = { fg, head, sub, border, rowBg };

  const { convId } = useLocalSearchParams<{ convId: string }>();
  const line = lineOfConv(convId ?? '');
  const queryClient = useQueryClient();
  /** Invalidate the cached conversation metadata so the chat-view topnav (which
   *  reads `useConvMeta`, a 5-min-stale TanStack query) picks up a renamed group
   *  / new group image / description without an app reload. */
  const invalidateConvMeta = (): void => {
    if (convId) void queryClient.invalidateQueries({ queryKey: ['convMeta', convId] });
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

  /** Snapshot profile name per address. null = no profile / no name. */
  const [memberNames, setMemberNames] = useState<Record<string, string | null>>({});
  /** Role per member address: super-admin → owner, admin → admin, else member. */
  const [memberRoles, setMemberRoles] = useState<Record<string, 'owner' | 'admin' | 'member'>>({});
  const [addOpen, setAddOpen] = useState(false);
  /** Lower-cased local wallet address — used to suppress the remove button
   *  on the local user's own row. */
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

  useEffect(() => {
    if (!convId) return;
    let cancelled = false;
    void (async (): Promise<void> => {
      const d = await loadGroupDetail(line);
      if (cancelled || !d) return;
      a.setName(d.name);
      a.setDraft(d.name);
      a.setImageUrl(d.imageUrl);
      a.setDescription(d.description);
      a.setDescriptionDraft(d.description);
      a.setMembers(d.members);
      setMemberRoles(d.roles);
      /** Fetch Snapshot profile names — each row falls back to the address when
       *  the lookup misses, so this is a pure enrichment. */
      const { readProfile } = await import('../../lib/profile');
      const profiles = await Promise.all(d.members.map(a => readProfile(a).catch(() => null)));
      if (cancelled) return;
      const next: Record<string, string | null> = {};
      for (let i = 0; i < d.members.length; i++) next[d.members[i]!] = profiles[i]?.name?.trim() || null;
      setMemberNames(next);
    })();
    return (): void => { cancelled = true; };
  }, [convId, line]);

  return (
    <Box style={{ flex: 1, backgroundColor: bg }}>
      <Box style={{
        height: 44 + insets.top, paddingTop: insets.top, paddingHorizontal: 14,
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={{ padding: 6 }}>
          <Icon name="arrowLeft" size={22} color={fg} />
        </Pressable>
        <Pressable onPress={() => setOverflowOpen(true)} hitSlop={10} style={{ padding: 6 }}>
          <Icon name="dotsHorizontal" size={22} color={fg} />
        </Pressable>
      </Box>

      <GroupImageEditor
        imageUrl={imageUrl} uploadingImage={uploadingImage}
        fg={fg} sub={sub} border={border} rowBg={rowBg}
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

      {/** MEMBERS header: label left, add-member button (avatar + plus) top-right
       *   → opens a modal to add by address (no inline input). */}
      <Box style={{
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 16, paddingBottom: 8,
      }}>
        <Text style={{ color: sub, fontSize: 13, fontFamily: 'Calibre-Medium' }}>
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
          <Icon name="users" size={16} color={fg} />
          <Icon name="plus" size={14} color={fg} />
        </Pressable>
      </Box>
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
        dark={dark} sub={sub}
      />

      <ImageViewer
        uri={imageUrl ? avatarRenderUrl('', imageUrl, 1024) : ''}
        visible={viewerOpen}
        onClose={() => setViewerOpen(false)}
      />
    </Box>
  );
}
