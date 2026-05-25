/** Group detail view — opened by tapping the conversation header title. Lists
 *  members (avatar + short address; tap → user profile), shows the group name
 *  inline-editable. DMs don't get this view (they have no group metadata). */

import { useEffect, useState } from 'react';
import {
  Alert, FlatList, Image, Pressable, Text, TextInput, View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  convOfLine, lineOfConv, memberInboxToAddressMap, stampBoxAvatarUrl, shortAddress,
} from '../../lib/xmtp';
import { PublicIdentity } from '@xmtp/react-native-sdk';
import { readProfile } from '../../lib/profile';
import type { SnapshotProfile } from '../../../_shared/profile/snapshot';
import { useEffectiveColorScheme } from '../../lib/theme';
import { HeroIcon } from '../../components/HeroIcon';

export default function GroupDetail(): React.ReactElement {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const dark = useEffectiveColorScheme() === 'dark';
  const fg = dark ? '#e8ecf2' : '#1a1f29';
  const sub = dark ? '#8a94a6' : '#5a6477';
  const bg = dark ? '#000000' : '#ffffff';
  const border = dark ? '#262c38' : '#e3e7ef';
  const rowBg = dark ? '#161a22' : '#fafbfd';

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
  /** Add-member input + busy flag. The Add row sits above the member list. */
  const [addDraft, setAddDraft] = useState('');
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (!convId) return;
    let cancelled = false;
    void (async (): Promise<void> => {
      const conv = await convOfLine(line);
      if (cancelled || !conv) return;
      const [n, addrMap] = await Promise.all([
        (conv as unknown as { name?: () => Promise<string> }).name?.() ?? Promise.resolve(''),
        memberInboxToAddressMap(conv),
      ]);
      if (cancelled) return;
      setName(n ?? '');
      setDraft(n ?? '');
      const addrs = Object.values(addrMap).sort((a, b) => a.localeCompare(b));
      setMembers(addrs);
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
      const group = conv as unknown as { addMembersByIdentity?: (ids: PublicIdentity[]) => Promise<unknown> };
      if (!group.addMembersByIdentity) throw new Error('Not a group conversation');
      await group.addMembersByIdentity([new PublicIdentity(addr, 'ETHEREUM')]);
      setAddDraft('');
      /** Re-fetch the member list so the new row shows up immediately. */
      const fullMap = await memberInboxToAddressMap(conv);
      setMembers(Object.values(fullMap).sort((a, b) => a.localeCompare(b)));
    } catch (e) {
      Alert.alert('Add member failed', (e as Error).message ?? 'Unknown error');
    } finally { setAdding(false); }
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

      <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16 }}>
        <Text style={{ color: sub, fontSize: 11, fontFamily: 'Calibre-Medium' }}>GROUP NAME</Text>
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
            <Text style={{ color: fg, fontSize: 20, fontFamily: 'Calibre-Semibold' }}>
              {name && name.trim() ? name : 'Untitled group'}
            </Text>
            <Text style={{ color: sub, fontSize: 12, marginTop: 4, fontFamily: 'Calibre-Medium' }}>Tap to rename</Text>
          </Pressable>
        )}
      </View>

      <Text style={{ color: sub, fontSize: 11, paddingHorizontal: 16, paddingBottom: 6, fontFamily: 'Calibre-Medium' }}>
        MEMBERS ({members.length})
      </Text>
      <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingBottom: 12 }}>
        <TextInput
          value={addDraft}
          onChangeText={setAddDraft}
          placeholder="0x… Ethereum address"
          placeholderTextColor={sub}
          autoCorrect={false}
          autoCapitalize="none"
          style={{
            flex: 1, color: fg, backgroundColor: rowBg,
            borderWidth: 1, borderColor: border, borderRadius: 10,
            paddingHorizontal: 10, paddingVertical: 8, fontSize: 13,
          }}
        />
        <Pressable
          onPress={() => { void addMember(); }}
          disabled={adding || !addDraft.trim()}
          style={({ pressed }) => ({
            paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999,
            backgroundColor: dark ? '#ffffff' : '#000000',
            opacity: pressed ? 0.85 : (adding || !addDraft.trim()) ? 0.5 : 1,
            alignSelf: 'center',
          })}
        >
          <Text style={{ color: dark ? '#000000' : '#ffffff', fontSize: 13, fontFamily: 'Calibre-Medium' }}>
            {adding ? 'Adding…' : 'Add'}
          </Text>
        </Pressable>
      </View>
      <FlatList
        data={members}
        keyExtractor={addr => addr.toLowerCase()}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push({ pathname: '/user/[address]', params: { address: item } })}
            style={({ pressed }) => ({
              backgroundColor: pressed ? border : rowBg,
              flexDirection: 'row', alignItems: 'center', gap: 12,
              paddingHorizontal: 14, paddingVertical: 12,
              borderBottomWidth: 1, borderBottomColor: border,
            })}
          >
            <Image
              source={{ uri: stampBoxAvatarUrl(item) }}
              style={{ width: 32, height: 32, borderRadius: 999, backgroundColor: '#1a1f29' }}
            />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ color: fg, fontSize: 15, fontFamily: 'Calibre-Semibold' }} numberOfLines={1}>
                {memberNames[item] || shortAddress(item)}
              </Text>
              {memberNames[item] ? (
                <Text style={{ color: sub, fontSize: 12, marginTop: 2, fontFamily: 'Calibre-Medium' }} numberOfLines={1}>
                  {shortAddress(item)}
                </Text>
              ) : null}
            </View>
          </Pressable>
        )}
      />
    </View>
  );
}
