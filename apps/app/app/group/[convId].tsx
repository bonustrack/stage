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
    })();
    return (): void => { cancelled = true; };
  }, [convId, line]);

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
        <Text style={{ color: sub, fontSize: 11 }}>GROUP NAME</Text>
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
                backgroundColor: '#ffffff',
                opacity: pressed ? 0.85 : (saving || !draft.trim()) ? 0.5 : 1,
              })}>
              <Text style={{ color: '#000000', fontSize: 13, fontFamily: 'Calibre-Medium' }}>
                {saving ? 'Saving…' : 'Save'}
              </Text>
            </Pressable>
          </View>
        ) : (
          <Pressable onPress={() => setEditing(true)} hitSlop={6} style={{ marginTop: 6 }}>
            <Text style={{ color: fg, fontSize: 20, fontFamily: 'Calibre-Semibold' }}>
              {name && name.trim() ? name : 'Untitled group'}
            </Text>
            <Text style={{ color: sub, fontSize: 12, marginTop: 4 }}>Tap to rename</Text>
          </Pressable>
        )}
      </View>

      <Text style={{ color: sub, fontSize: 11, paddingHorizontal: 16, paddingBottom: 6 }}>
        MEMBERS ({members.length})
      </Text>
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
              style={{ width: 24, height: 24, borderRadius: 999, backgroundColor: '#1a1f29' }}
            />
            <Text style={{ color: fg, fontSize: 14, flex: 1 }} numberOfLines={1}>
              {item}
            </Text>
            <Text style={{ color: sub, fontSize: 12 }}>{shortAddress(item)}</Text>
          </Pressable>
        )}
      />
    </View>
  );
}
