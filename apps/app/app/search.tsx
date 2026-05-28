/** Search page — opened from the Channels topnav.
 *
 *  Enter an Ethereum address OR an ENS-style domain (`*.eth`). ENS resolves to an
 *  address via mainnet (the brovider RPC, same as the wallet tab). Tapping a result
 *  opens or creates a DM with that address. Existing DM contacts matching the query
 *  are also surfaced below the resolved result. */

import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { createPublicClient, http, isAddress, type Hex } from 'viem';
import { mainnet } from 'viem/chains';
import { openDmWithAddress, shortAddress, stampBoxAvatarUrl } from '../lib/xmtp';
import { usePeerProfiles, getPeerName, getPeerAvatarCb } from '../lib/peerProfiles';
import { useEffectiveColorScheme } from '../lib/theme';
import { getCachedRows } from '../lib/channelsCache';
import { HeroIcon } from '../components/HeroIcon';

/** Cheap pre-flight — accept any *.eth (or longer multi-label) as ENS-resolvable. */
function looksLikeEns(s: string): boolean {
  return /^[a-z0-9-]+(\.[a-z0-9-]+)+\.eth$|^[a-z0-9-]+\.eth$/i.test(s.trim());
}

export default function Search(): React.ReactElement {
  const router = useRouter();
  const dark = useEffectiveColorScheme() === 'dark';
  const head = dark ? '#ffffff' : '#000000';
  const fg = dark ? '#9f9fa3' : '#57606a';
  const sub = dark ? '#7a7a7e' : '#8a929d';
  const bg = dark ? '#0e0f10' : '#ffffff';
  const border = dark ? '#282a2d' : '#e4e4e5';
  const rowBg = dark ? '#282a2d' : '#e4e4e5';
  const insets = useSafeAreaInsets();

  const [query, setQuery] = useState('');
  const [resolved, setResolved] = useState<{ address: string; source: 'address' | 'ens' } | null>(null);
  const [resolving, setResolving] = useState(false);
  const [resolveErr, setResolveErr] = useState<string | null>(null);
  const [opening, setOpening] = useState<string | null>(null);

  /** Existing DM peers (address-keyed) pulled straight from the cached channels list. */
  const existing = useMemo(() => {
    const rows = getCachedRows() ?? [];
    const seen = new Set<string>();
    const peers: { address: string; convId: string }[] = [];
    for (const r of rows) {
      const a = (r as { peerAddress?: string | null; convId?: string }).peerAddress;
      const c = (r as { peerAddress?: string | null; convId?: string }).convId;
      if (!a || !c) continue;
      const k = a.toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      peers.push({ address: a, convId: c });
    }
    return peers;
  }, []);

  /** Resolve names so the existing list + result render with display names. */
  usePeerProfiles([resolved?.address, ...existing.map(p => p.address)]);

  /** Debounced resolution: address goes straight; *.eth hits viem getEnsAddress on
   *  mainnet (brovider RPC, same as the wallet). Other input clears the result. */
  useEffect(() => {
    const q = query.trim();
    setResolveErr(null);
    if (!q) { setResolved(null); setResolving(false); return; }
    if (isAddress(q)) { setResolved({ address: q.toLowerCase(), source: 'address' }); setResolving(false); return; }
    if (!looksLikeEns(q)) { setResolved(null); setResolving(false); return; }
    setResolving(true);
    let cancelled = false;
    const t = setTimeout(() => {
      void (async (): Promise<void> => {
        try {
          const pub = createPublicClient({ chain: mainnet, transport: http('https://rpc.brovider.xyz/1') });
          const addr = await pub.getEnsAddress({ name: q.toLowerCase() });
          if (cancelled) return;
          if (addr) setResolved({ address: addr.toLowerCase(), source: 'ens' });
          else { setResolved(null); setResolveErr(`No address set for ${q}`); }
        } catch (e) {
          if (!cancelled) { setResolved(null); setResolveErr((e as Error).message); }
        } finally { if (!cancelled) setResolving(false); }
      })();
    }, 300);
    return () => { cancelled = true; clearTimeout(t); };
  }, [query]);

  /** Existing contacts filtered by the query (matches name or address substring). */
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return existing;
    return existing.filter(p => {
      if (p.address.toLowerCase().includes(q)) return true;
      const n = getPeerName(p.address);
      return !!n && n.toLowerCase().includes(q);
    });
  }, [existing, query]);

  /** Open or create a DM by address, then push the conversation. */
  const open = async (address: string, convId?: string): Promise<void> => {
    if (opening) return;
    setOpening(address.toLowerCase());
    try {
      const id = convId ?? await openDmWithAddress(address);
      router.replace({ pathname: '/xmtp/[convId]', params: { convId: id } });
    } catch (e) {
      setResolveErr((e as Error).message);
      setOpening(null);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: bg, paddingTop: insets.top }}>
      {/* Topnav: back + title + input. */}
      <View style={{
        flexDirection: 'row', alignItems: 'center', gap: 8,
        paddingHorizontal: 12, paddingTop: 8, paddingBottom: 10,
        borderBottomWidth: 1, borderBottomColor: border,
      }}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={{ padding: 4 }}>
          <HeroIcon name="arrowLeft" size={22} color={fg} />
        </Pressable>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Address or name.eth"
          placeholderTextColor={sub}
          autoCapitalize="none"
          autoCorrect={false}
          autoFocus
          style={{
            flex: 1, color: head, fontSize: 16, fontFamily: 'Calibre-Medium',
            backgroundColor: rowBg, borderRadius: 999,
            paddingHorizontal: 14, paddingVertical: 8,
          }}
        />
      </View>

      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 24 }}>
        {/* Resolved result card */}
        {resolving ? (
          <View style={{ paddingVertical: 16, alignItems: 'center' }}>
            <ActivityIndicator color={head} />
          </View>
        ) : null}

        {resolved ? (
          <Pressable
            onPress={() => void open(resolved.address)}
            style={({ pressed }) => ({
              backgroundColor: pressed ? border : 'transparent',
              flexDirection: 'row', alignItems: 'center', gap: 12,
              paddingHorizontal: 14, paddingVertical: 14,
              borderBottomWidth: 1, borderBottomColor: border,
            })}
          >
            <Image
              source={{ uri: stampBoxAvatarUrl(resolved.address, 64, getPeerAvatarCb(resolved.address)) }}
              style={{ width: 32, height: 32, borderRadius: 999, backgroundColor: border }}
            />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ color: head, fontSize: 16, fontFamily: 'Calibre-Semibold' }} numberOfLines={1}>
                {getPeerName(resolved.address) ?? (resolved.source === 'ens' ? query.trim() : shortAddress(resolved.address))}
              </Text>
              <Text style={{ color: sub, fontSize: 13, fontFamily: 'Calibre-Medium', marginTop: 2 }} numberOfLines={1}>
                {shortAddress(resolved.address)}
              </Text>
            </View>
            {opening === resolved.address.toLowerCase()
              ? <ActivityIndicator color={head} />
              : <HeroIcon name="chat" size={18} color={fg} />}
          </Pressable>
        ) : null}

        {resolveErr && !resolving ? (
          <Text style={{ color: '#d96868', fontSize: 13, fontFamily: 'Calibre-Medium', paddingHorizontal: 16, paddingVertical: 10 }}>
            {resolveErr}
          </Text>
        ) : null}

        {/* Existing contacts (DMs) filtered by the query — and shown in full when empty. */}
        {filtered.length > 0 ? (
          <Text style={{ color: sub, fontSize: 12, fontFamily: 'Calibre-Medium', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 6 }}>
            {query.trim() ? 'EXISTING CONTACTS' : 'YOUR CONTACTS'}
          </Text>
        ) : null}
        {filtered.map(p => (
          <Pressable
            key={p.address.toLowerCase()}
            onPress={() => void open(p.address, p.convId)}
            style={({ pressed }) => ({
              backgroundColor: pressed ? border : 'transparent',
              flexDirection: 'row', alignItems: 'center', gap: 12,
              paddingHorizontal: 14, paddingVertical: 14,
              borderBottomWidth: 1, borderBottomColor: border,
            })}
          >
            <Image
              source={{ uri: stampBoxAvatarUrl(p.address, 64, getPeerAvatarCb(p.address)) }}
              style={{ width: 32, height: 32, borderRadius: 999, backgroundColor: border }}
            />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ color: head, fontSize: 16, fontFamily: 'Calibre-Semibold' }} numberOfLines={1}>
                {getPeerName(p.address) ?? shortAddress(p.address)}
              </Text>
              {getPeerName(p.address) ? (
                <Text style={{ color: sub, fontSize: 13, fontFamily: 'Calibre-Medium', marginTop: 2 }} numberOfLines={1}>
                  {shortAddress(p.address)}
                </Text>
              ) : null}
            </View>
            {opening === p.address.toLowerCase() ? <ActivityIndicator color={head} /> : null}
          </Pressable>
        ))}

        {!resolved && !resolving && !filtered.length && query.trim() ? (
          <Text style={{ color: sub, fontSize: 13, fontFamily: 'Calibre-Medium', textAlign: 'center', paddingVertical: 24, paddingHorizontal: 24 }}>
            No matches. Paste a full address or a {'name.eth'} to start a chat.
          </Text>
        ) : null}
      </ScrollView>
    </View>
  );
}
