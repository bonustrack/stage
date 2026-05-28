/** Group detail view — opened by tapping the conversation header title. Lists
 *  members (avatar + short address; tap → user profile), shows the group name
 *  inline-editable. DMs don't get this view (they have no group metadata). */

import { useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, FlatList, Image, Modal, Pressable, Text, TextInput, View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  convOfLine, getCachedXmtpClient, getOrCreateXmtpClient, lineOfConv,
  memberInboxToAddressMap, stampBoxAvatarUrl, shortAddress,
} from '../../lib/xmtp';
import { PublicIdentity } from '@xmtp/react-native-sdk';
import { readProfile, uploadAvatar } from '../../lib/profile';
import { avatarRenderUrl, type SnapshotProfile } from '@metro-labs/client/profile/snapshot';
import { useEffectiveColorScheme } from '../../lib/theme';
import { HeroIcon } from '../../components/HeroIcon';
import { ImageViewer } from '../../components/ImageViewer';

export default function GroupDetail(): React.ReactElement {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const dark = useEffectiveColorScheme() === 'dark';
  const fg = dark ? '#9f9fa3' : '#57606a';
  const head = dark ? '#ffffff' : '#000000';
  const sub = dark ? '#7a7a7e' : '#8a929d';
  const bg = dark ? '#0e0f10' : '#ffffff';
  const border = dark ? '#282a2d' : '#e4e4e5';
  const rowBg = dark ? '#282a2d' : '#e4e4e5';

  const { convId } = useLocalSearchParams<{ convId: string }>();
  const line = lineOfConv(convId ?? '');

  const [name, setName] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  /** `members` = [eth address]; sorted alphabetically so the order is stable
   *  across re-fetches. Includes the local user. */
  const [members, setMembers] = useState<string[]>([]);
  /** Snapshot profile name per address — fetched after the member list lands.
   *  null = no profile / no name. */
  const [memberNames, setMemberNames] = useState<Record<string, string | null>>({});
  /** Role per member address: super-admin → owner, admin → admin, else member. */
  const [memberRoles, setMemberRoles] = useState<Record<string, 'owner' | 'admin' | 'member'>>({});
  /** Add-member input + busy flag. The Add row sits above the member list. */
  const [addDraft, setAddDraft] = useState('');
  const [adding, setAdding] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  /** Lower-cased local wallet address — used to suppress the remove button
   *  on the local user's own row. */
  const [selfAddress, setSelfAddress] = useState<string>('');
  /** Per-address removal busy flag. Disables the row + the remove button
   *  while the XMTP call is in flight. */
  const [removing, setRemoving] = useState<string | null>(null);
  /** Group image URL (raw — could be ipfs://). Stored as the XMTP
   *  `group_image_url_square` field; rendered via `avatarRenderUrl`. */
  const [imageUrl, setImageUrl] = useState<string>('');
  const [uploadingImage, setUploadingImage] = useState(false);
  /** Group description — inline-editable like the group name. */
  const [description, setDescription] = useState<string>('');
  const [descriptionDraft, setDescriptionDraft] = useState('');
  const [editingDescription, setEditingDescription] = useState(false);
  const [savingDescription, setSavingDescription] = useState(false);
  /** When set, the fullscreen ImageViewer shows the group image. */
  const [viewerOpen, setViewerOpen] = useState(false);

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
      const conv = await convOfLine(line);
      if (cancelled || !conv) return;
      const group = conv as unknown as {
        name?: () => Promise<string>;
        imageUrl?: () => Promise<string>;
        description?: () => Promise<string>;
        listSuperAdmins?: () => Promise<string[]>;
        listAdmins?: () => Promise<string[]>;
      };
      const [n, img, desc, addrMap, supers, admins] = await Promise.all([
        group.name?.() ?? Promise.resolve(''),
        group.imageUrl?.().catch(() => '') ?? Promise.resolve(''),
        group.description?.().catch(() => '') ?? Promise.resolve(''),
        memberInboxToAddressMap(conv),
        group.listSuperAdmins?.().catch(() => [] as string[]) ?? Promise.resolve([] as string[]),
        group.listAdmins?.().catch(() => [] as string[]) ?? Promise.resolve([] as string[]),
      ]);
      if (cancelled) return;
      setName(n ?? '');
      setDraft(n ?? '');
      setImageUrl(img ?? '');
      setDescription(desc ?? '');
      setDescriptionDraft(desc ?? '');
      const addrs = Object.values(addrMap).sort((a, b) => a.localeCompare(b));
      setMembers(addrs);
      /** Map each member (by inbox id) to a role; super-admin = Owner. */
      const superSet = new Set(supers.map(s => s.toLowerCase()));
      const adminSet = new Set(admins.map(a => a.toLowerCase()));
      const roles: Record<string, 'owner' | 'admin' | 'member'> = {};
      for (const [inboxId, addr] of Object.entries(addrMap)) {
        const iid = inboxId.toLowerCase();
        roles[addr] = superSet.has(iid) ? 'owner' : adminSet.has(iid) ? 'admin' : 'member';
      }
      setMemberRoles(roles);
      /** Fetch Snapshot profile names in parallel — each row falls back to the
       *  address when the lookup misses, so this is a pure enrichment. */
      const profiles = await Promise.all(
        addrs.map(a => readProfile(a).catch(() => null as SnapshotProfile | null)),
      );
      if (cancelled) return;
      const next: Record<string, string | null> = {};
      for (let i = 0; i < addrs.length; i++) {
        next[addrs[i]!] = profiles[i]?.name?.trim() || null;
      }
      setMemberNames(next);
    })();
    return (): void => { cancelled = true; };
  }, [convId, line]);

  const addMember = async (): Promise<void> => {
    const addr = addDraft.trim();
    if (!/^0x[0-9a-fA-F]{40}$/.test(addr) || adding) {
      Alert.alert('Add member', 'Enter a valid 0x… Ethereum address.');
      return;
    }
    setAdding(true);
    try {
      const conv = await convOfLine(line);
      if (!conv) throw new Error('Conversation not found');
      const group = conv as unknown as { addMembersByIdentity?: (ids: PublicIdentity[]) => Promise<unknown> };
      if (!group.addMembersByIdentity) throw new Error('Not a group conversation');
      await group.addMembersByIdentity([new PublicIdentity(addr, 'ETHEREUM')]);
      setAddDraft('');
      setAddOpen(false);
      /** Re-fetch the member list so the new row shows up immediately. */
      const fullMap = await memberInboxToAddressMap(conv);
      setMembers(Object.values(fullMap).sort((a, b) => a.localeCompare(b)));
    } catch (e) {
      Alert.alert('Add member failed', (e as Error).message ?? 'Unknown error');
    } finally { setAdding(false); }
  };

  const removeMember = (addr: string): void => {
    Alert.alert(
      'Remove member',
      `Remove ${shortAddress(addr)} from this group? They'll lose access to past + future messages.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove', style: 'destructive', onPress: () => {
            void (async (): Promise<void> => {
              setRemoving(addr.toLowerCase());
              try {
                const conv = await convOfLine(line);
                /** XMTP V3 groups expose `removeMembersByIdentity` —
                 *  callable only by group admins/super-admins. Surface
                 *  the raw error (often "not authorised") so the user
                 *  can act on it. */
                const group = conv as unknown as {
                  removeMembersByIdentity?: (ids: PublicIdentity[]) => Promise<unknown>;
                };
                if (!group.removeMembersByIdentity) throw new Error('Not a group conversation');
                await group.removeMembersByIdentity([new PublicIdentity(addr, 'ETHEREUM')]);
                /** Re-fetch the member list so the row disappears immediately. */
                const fullMap = await memberInboxToAddressMap(conv!);
                setMembers(Object.values(fullMap).sort((a, b) => a.localeCompare(b)));
              } catch (e) {
                Alert.alert('Remove member failed', (e as Error).message ?? 'Unknown error');
              } finally { setRemoving(null); }
            })();
          },
        },
      ],
    );
  };

  const pickImage = async (): Promise<void> => {
    if (uploadingImage) return;
    const r = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images', quality: 0.85, allowsMultipleSelection: false,
    });
    if (r.canceled || !r.assets?.length) return;
    const a = r.assets[0]!;
    setUploadingImage(true);
    try {
      const url = await uploadAvatar(a.uri, a.mimeType ?? 'image/jpeg', a.fileName ?? 'group-avatar');
      const conv = await convOfLine(line);
      if (!conv) throw new Error('Conversation not found');
      const group = conv as unknown as { updateImageUrl?: (u: string) => Promise<void> };
      if (!group.updateImageUrl) throw new Error('Not a group conversation');
      await group.updateImageUrl(url);
      setImageUrl(url);
    } catch (e) {
      Alert.alert('Image upload failed', (e as Error).message ?? 'Unknown error');
    } finally { setUploadingImage(false); }
  };

  const saveDescription = async (): Promise<void> => {
    const next = descriptionDraft.trim();
    if (savingDescription) return;
    setSavingDescription(true);
    try {
      const conv = await convOfLine(line);
      if (!conv) throw new Error('Conversation not found');
      const group = conv as unknown as { updateDescription?: (d: string) => Promise<void> };
      if (!group.updateDescription) throw new Error('Not a group conversation');
      await group.updateDescription(next);
      setDescription(next);
      setEditingDescription(false);
    } catch (e) {
      Alert.alert('Description update failed', (e as Error).message ?? 'Unknown error');
    } finally { setSavingDescription(false); }
  };

  const saveName = async (): Promise<void> => {
    const next = draft.trim();
    if (!next || saving) return;
    setSaving(true);
    try {
      const conv = await convOfLine(line);
      const group = conv as unknown as { updateName?: (n: string) => Promise<void> };
      await group.updateName?.(next);
      setName(next);
      setEditing(false);
    } catch (e) {
      Alert.alert('Rename failed', (e as Error).message ?? 'Unknown error');
    } finally { setSaving(false); }
  };

  return (
    <View style={{ flex: 1, backgroundColor: bg }}>
      <View style={{
        height: 44 + insets.top, paddingTop: insets.top, paddingHorizontal: 14,
        flexDirection: 'row', alignItems: 'center',
      }}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={{ padding: 6 }}>
          <HeroIcon name="arrowLeft" size={22} color={fg} />
        </Pressable>
      </View>

      <View style={{ alignItems: 'center', paddingTop: 4, paddingBottom: 16 }}>
        <Pressable
          onPress={() => { if (imageUrl) setViewerOpen(true); else void pickImage(); }}
          onLongPress={() => { void pickImage(); }}
          disabled={uploadingImage}
          hitSlop={8}
        >
          {imageUrl ? (
            <Image
              source={{ uri: avatarRenderUrl('', imageUrl, 240) }}
              style={{ width: 96, height: 96, borderRadius: 48, backgroundColor: rowBg, opacity: uploadingImage ? 0.5 : 1 }}
            />
          ) : (
            <View style={{
              width: 96, height: 96, borderRadius: 48, backgroundColor: rowBg,
              borderWidth: 1, borderColor: border,
              alignItems: 'center', justifyContent: 'center',
              opacity: uploadingImage ? 0.5 : 1,
            }}>
              <Text style={{ color: sub, fontSize: 28 }}>＋</Text>
            </View>
          )}
          {uploadingImage ? (
            <View style={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center' }}>
              <ActivityIndicator color={fg} />
            </View>
          ) : null}
        </Pressable>
        <Text style={{ color: sub, fontSize: 13, marginTop: 6, fontFamily: 'Calibre-Medium' }}>
          {uploadingImage ? 'Uploading…' : imageUrl ? 'Tap to view · hold to change' : 'Tap to add image'}
        </Text>
      </View>

      <View style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
        <Text style={{ color: sub, fontSize: 13, fontFamily: 'Calibre-Medium' }}>GROUP NAME</Text>
        {editing ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 }}>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder="Group name"
              placeholderTextColor={sub}
              autoFocus
              style={{
                flex: 1, color: fg, backgroundColor: rowBg,
                borderWidth: 1, borderColor: border, borderRadius: 10,
                paddingHorizontal: 10, paddingVertical: 8, fontSize: 16,
              }}
            />
            <Pressable onPress={() => { void saveName(); }} disabled={saving || !draft.trim()}
              style={({ pressed }) => ({
                paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999,
                backgroundColor: dark ? '#ffffff' : '#000000',
                opacity: pressed ? 0.85 : (saving || !draft.trim()) ? 0.5 : 1,
              })}>
              <Text style={{ color: dark ? '#000000' : '#ffffff', fontSize: 13, fontFamily: 'Calibre-Medium' }}>
                {saving ? 'Saving…' : 'Save'}
              </Text>
            </Pressable>
          </View>
        ) : (
          <Pressable onPress={() => setEditing(true)} hitSlop={6} style={{ marginTop: 6 }}>
            <Text style={{ color: head, fontSize: 20, fontFamily: 'Calibre-Semibold' }}>
              {name && name.trim() ? name : 'Untitled group'}
            </Text>
            <Text style={{ color: sub, fontSize: 12, marginTop: 4, fontFamily: 'Calibre-Medium' }}>Tap to rename</Text>
          </Pressable>
        )}
      </View>

      <View style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
        <Text style={{ color: sub, fontSize: 13, fontFamily: 'Calibre-Medium' }}>DESCRIPTION</Text>
        {editingDescription ? (
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 6 }}>
            <TextInput
              value={descriptionDraft}
              onChangeText={setDescriptionDraft}
              placeholder="What is this group about?"
              placeholderTextColor={sub}
              multiline
              autoFocus
              style={{
                flex: 1, color: fg, backgroundColor: rowBg,
                borderWidth: 1, borderColor: border, borderRadius: 10,
                paddingHorizontal: 10, paddingVertical: 8, fontSize: 14,
                minHeight: 60, textAlignVertical: 'top',
              }}
            />
            <Pressable onPress={() => { void saveDescription(); }} disabled={savingDescription}
              style={({ pressed }) => ({
                paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999,
                backgroundColor: dark ? '#ffffff' : '#000000',
                opacity: pressed ? 0.85 : savingDescription ? 0.5 : 1,
              })}>
              <Text style={{ color: dark ? '#000000' : '#ffffff', fontSize: 13, fontFamily: 'Calibre-Medium' }}>
                {savingDescription ? 'Saving…' : 'Save'}
              </Text>
            </Pressable>
          </View>
        ) : (
          <Pressable onPress={() => setEditingDescription(true)} hitSlop={6} style={{ marginTop: 6 }}>
            <Text style={{ color: description.trim() ? fg : sub, fontSize: 14, fontFamily: 'Calibre-Medium' }}>
              {description.trim() || 'Tap to add a description'}
            </Text>
          </Pressable>
        )}
      </View>

      {/** MEMBERS header: label left, add-member button (avatar + plus) top-right
       *   → opens a modal to add by address (no inline input). */}
      <View style={{
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
          <HeroIcon name="users" size={16} color={fg} />
          <HeroIcon name="plus" size={14} color={fg} />
        </Pressable>
      </View>
      <FlatList
        data={members}
        keyExtractor={addr => addr.toLowerCase()}
        renderItem={({ item }) => {
          const isSelf = item.toLowerCase() === selfAddress;
          const isRemovingThis = removing === item.toLowerCase();
          return (
            <Pressable
              onPress={() => router.push({ pathname: '/user/[address]', params: { address: item } })}
              disabled={isRemovingThis}
              style={({ pressed }) => ({
                backgroundColor: pressed ? border : 'transparent',
                flexDirection: 'row', alignItems: 'center', gap: 12,
                paddingHorizontal: 14, paddingVertical: 14,
                borderBottomWidth: 1, borderBottomColor: border,
                opacity: isRemovingThis ? 0.5 : 1,
              })}
            >
              <Image
                source={{ uri: stampBoxAvatarUrl(item) }}
                style={{ width: 32, height: 32, borderRadius: 999, backgroundColor: border }}
              />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ color: head, fontSize: 15, fontFamily: 'Calibre-Semibold' }} numberOfLines={1}>
                  {memberNames[item] || shortAddress(item)}{isSelf ? ' (you)' : ''}
                </Text>
                {memberNames[item] ? (
                  <Text style={{ color: sub, fontSize: 12, marginTop: 2, fontFamily: 'Calibre-Medium' }} numberOfLines={1}>
                    {shortAddress(item)}
                  </Text>
                ) : null}
              </View>
              {memberRoles[item] && memberRoles[item] !== 'member' ? (
                <View style={{
                  paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999,
                  backgroundColor: memberRoles[item] === 'owner'
                    ? (dark ? 'rgba(45,212,191,0.18)' : 'rgba(13,148,136,0.12)')
                    : (dark ? '#282a2d' : '#e4e4e5'),
                }}>
                  <Text style={{
                    fontSize: 11, fontFamily: 'Calibre-Medium',
                    color: memberRoles[item] === 'owner' ? (dark ? '#2dd4bf' : '#0d9488') : sub,
                  }}>{memberRoles[item] === 'owner' ? 'Owner' : 'Admin'}</Text>
                </View>
              ) : null}
              {isSelf ? null : (
                <Pressable
                  onPress={() => removeMember(item)}
                  disabled={isRemovingThis}
                  hitSlop={10}
                  style={({ pressed }) => ({
                    padding: 6, borderRadius: 999,
                    backgroundColor: pressed ? (dark ? '#3a1820' : '#fbe3e8') : 'transparent',
                  })}
                >
                  <HeroIcon name="trash" size={18} color={dark ? '#ff6b80' : '#b91c1c'} />
                </Pressable>
              )}
            </Pressable>
          );
        }}
      />

      {/* Add-member modal — opened by the + button in the MEMBERS header. */}
      <Modal visible={addOpen} transparent animationType="slide" onRequestClose={() => setAddOpen(false)}>
        <Pressable onPress={() => setAddOpen(false)} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }}>
          <Pressable onPress={(e) => e.stopPropagation()} style={{
            backgroundColor: dark ? '#1a1b1d' : '#ffffff',
            borderTopLeftRadius: 18, borderTopRightRadius: 18,
            padding: 16, paddingBottom: 28 + insets.bottom, borderTopWidth: 1, borderColor: border,
          }}>
            <View style={{ alignSelf: 'center', width: 36, height: 4, borderRadius: 2, backgroundColor: border, marginBottom: 12 }} />
            <Text style={{ color: head, fontSize: 20, fontFamily: 'Calibre-Semibold', marginBottom: 12 }}>Add member</Text>
            <TextInput
              value={addDraft}
              onChangeText={setAddDraft}
              placeholder="0x… Ethereum address"
              placeholderTextColor={sub}
              autoCorrect={false}
              autoCapitalize="none"
              autoFocus
              style={{
                color: fg, backgroundColor: rowBg,
                borderWidth: 1, borderColor: border, borderRadius: 10,
                paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, marginBottom: 10,
              }}
            />
            <Pressable
              onPress={() => { void addMember(); }}
              disabled={adding || !addDraft.trim()}
              style={({ pressed }) => ({
                paddingVertical: 12, borderRadius: 999, alignItems: 'center',
                backgroundColor: dark ? '#ffffff' : '#000000',
                opacity: pressed ? 0.85 : (adding || !addDraft.trim()) ? 0.5 : 1,
              })}
            >
              <Text style={{ color: dark ? '#000000' : '#ffffff', fontSize: 15, fontFamily: 'Calibre-Semibold' }}>
                {adding ? 'Adding…' : 'Add member'}
              </Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <ImageViewer
        uri={imageUrl ? avatarRenderUrl('', imageUrl, 1024) : ''}
        visible={viewerOpen}
        onClose={() => setViewerOpen(false)}
      />
    </View>
  );
}
