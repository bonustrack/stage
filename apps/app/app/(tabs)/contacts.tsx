/** Contacts tab — distinct DM peers extracted from the local XMTP inbox.
 *  Tapping a row pushes into the existing DM with that peer. Same data source
 *  as the Channels tab but flattened to "people I've talked to", with peer
 *  addresses deduped (a peer with multiple DM topics collapses to one row). */

import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, FlatList, Image, Pressable, Text, TextInput, View,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  getOrCreateXmtpClient, peerEthAddressOfDm, stampBoxAvatarUrl, shortAddress,
} from '../../lib/xmtp';
import { useEffectiveColorScheme } from '../../lib/theme';

interface Contact { address: string; convId: string }

export default function Contacts(): React.ReactElement {
  const router = useRouter();
  const dark = useEffectiveColorScheme() === 'dark';
  const fg = dark ? '#e8ecf2' : '#1a1f29';
  const sub = dark ? '#8a94a6' : '#5a6477';
  const bg = dark ? '#000000' : '#ffffff';
  const border = dark ? '#262c38' : '#e3e7ef';
  const rowBg = dark ? '#161a22' : '#fafbfd';
  const [contacts, setContacts] = useState<Contact[] | null>(null);
  const [error, setError] = useState<string>('');
  const [query, setQuery] = useState<string>('');

  const filtered = useMemo(() => {
    if (!contacts) return null;
    const q = query.trim().toLowerCase();
    if (!q) return contacts;
    return contacts.filter(c => c.address.toLowerCase().includes(q));
  }, [contacts, query]);

  useEffect(() => {
    void (async (): Promise<void> => {
      try {
        const client = await getOrCreateXmtpClient('production');
        await client.conversations.syncAllConversations(['allowed', 'unknown']);
        const convs = await client.conversations.list(undefined, undefined, ['allowed', 'unknown']);
        /** Resolve peer address for each DM in parallel; null = group or unresolved. */
        const resolved = await Promise.all(convs.map(async c => {
          const addr = await peerEthAddressOfDm(c);
          return addr ? { address: addr, convId: c.id } : null;
        }));
        const seen = new Set<string>();
        const dedup: Contact[] = [];
        for (const r of resolved) {
          if (!r) continue;
          const key = r.address.toLowerCase();
          if (seen.has(key)) continue;
          seen.add(key);
          dedup.push(r);
        }
        dedup.sort((a, b) => a.address.localeCompare(b.address));
        setContacts(dedup);
      } catch (e) { setError((e as Error).message); }
    })();
  }, []);

  if (error) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: bg }}>
        <Text style={{ color: fg, fontSize: 15 }}>{error}</Text>
      </View>
    );
  }
  if (!contacts) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: bg }}>
        <ActivityIndicator />
        <Text style={{ color: sub, marginTop: 8, fontSize: 12 }}>Loading contacts…</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: bg }}>
      <View style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 }}>
        <Text style={{ color: fg, fontSize: 22, fontFamily: 'Calibre-Semibold' }}>Contacts</Text>
      </View>
      <View style={{ paddingHorizontal: 12, paddingBottom: 8 }}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search contacts…"
          placeholderTextColor={sub}
          autoCorrect={false}
          autoCapitalize="none"
          style={{
            backgroundColor: rowBg,
            borderWidth: 1, borderColor: border, borderRadius: 10,
            paddingHorizontal: 12, paddingVertical: 8,
            color: fg, fontSize: 14,
          }}
        />
      </View>
      <FlatList
        data={filtered ?? contacts}
        keyExtractor={c => c.address.toLowerCase()}
        ListEmptyComponent={
          <View style={{ padding: 32, alignItems: 'center' }}>
            <Text style={{ color: sub, textAlign: 'center' }}>
              {query ? `No matches for "${query}"` : 'No contacts yet. Start a DM from Channels to populate this list.'}
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push({ pathname: '/xmtp/[convId]', params: { convId: item.convId } })}
            style={({ pressed }) => ({
              backgroundColor: pressed ? border : rowBg,
              flexDirection: 'row', alignItems: 'center', gap: 12,
              paddingHorizontal: 14, paddingVertical: 12,
              borderBottomWidth: 1, borderBottomColor: border,
            })}
          >
            <Image
              source={{ uri: stampBoxAvatarUrl(item.address) }}
              style={{ width: 36, height: 36, borderRadius: 999, backgroundColor: '#1a1f29' }}
            />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ color: fg, fontSize: 14 }} numberOfLines={1}>
                {item.address}
              </Text>
              <Text style={{ color: sub, fontSize: 12, marginTop: 4 }} numberOfLines={1}>
                {shortAddress(item.address)}
              </Text>
            </View>
          </Pressable>
        )}
      />
    </View>
  );
}
