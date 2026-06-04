/** Search page — opened from the Channels topnav.
 *
 *  Enter an Ethereum address OR an ENS-style domain (`*.eth`). ENS resolves to an
 *  address via mainnet (the brovider RPC, same as the wallet tab). Tapping a result
 *  opens or creates a DM with that address. Existing DM contacts matching the query
 *  are also surfaced below the resolved result. Presentational helpers live in
 *  ./search.helpers to keep this under the line cap. */

import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, TextInput } from 'react-native';
import { Text } from '@metro-labs/kit/text';
import { Box } from '../components/layout';
import { Spinner } from '../components/Spinner';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { isAddress } from 'viem';
import { openDmWithAddress, shortAddress } from '../lib/xmtp';
import { resolveEnsName } from '../lib/ens';
import { usePeerProfiles, getPeerName, getPeerAvatarCb } from '../lib/peerProfiles';
import { usePalette } from '../lib/theme';
import { Icon } from '@metro-labs/kit/icon';
import { Avatar } from '../components/Avatar';
import { SearchRow, getExistingPeers, looksLikeEns } from './search.helpers';

export default function Search(): React.ReactElement {
  const router = useRouter();
  const { text: fg, primary: head, bg, border, danger } = usePalette();
  const sub = fg;
  const rowBg = border;
  const insets = useSafeAreaInsets();

  const [query, setQuery] = useState('');
  const [resolved, setResolved] = useState<{ address: string; source: 'address' | 'ens' } | null>(null);
  const [resolving, setResolving] = useState(false);
  const [resolveErr, setResolveErr] = useState<string | null>(null);
  const [opening, setOpening] = useState<string | null>(null);

  /** Existing DM peers (address-keyed) pulled straight from the cached channels list. */
  const existing = useMemo(() => getExistingPeers(), []);

  /** Resolve names so the existing list + result render with display names. */
  usePeerProfiles([resolved?.address, ...existing.map(p => p.address)]);

  /** Debounced resolution: a full address goes straight through; anything that
   *  looks like an ENS-style name (`*.eth`, multi-label) is sent to stamp.fyi's
   *  `resolve_names` endpoint — the same path Snapshot UI uses, which sidesteps
   *  viem's UniversalResolver pitfalls (CCIP-Read, custom resolvers) and just
   *  works for offchain names. Other input clears the result. */
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
          const addr = await resolveEnsName(q.toLowerCase());
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
    <Box style={{ flex: 1, backgroundColor: bg, paddingTop: insets.top }}>
      {/* Topnav: back + title + input. */}
      <Box style={{
        flexDirection: 'row', alignItems: 'center', gap: 8,
        paddingHorizontal: 12, paddingTop: 8, paddingBottom: 10,
        borderBottomWidth: 1, borderBottomColor: border,
      }}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={{ padding: 4 }}>
          <Icon name="arrowLeft" size={22} color={fg} />
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
      </Box>

      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 24 }}>
        {/* Resolved result card */}
        {resolving ? (
          <Box style={{ paddingVertical: 16, alignItems: 'center' }}>
            <Spinner size={20} color={head} />
          </Box>
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
            <Avatar
              address={resolved.address}
              size="md"
              cacheBuster={getPeerAvatarCb(resolved.address)}
              style={{ backgroundColor: border }}
            />
            <Box style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ color: head, fontSize: 16, fontFamily: 'Calibre-Semibold' }} numberOfLines={1}>
                {getPeerName(resolved.address) ?? (resolved.source === 'ens' ? query.trim() : shortAddress(resolved.address))}
              </Text>
              <Text style={{ color: sub, fontSize: 13, fontFamily: 'Calibre-Medium', marginTop: 2 }} numberOfLines={1}>
                {shortAddress(resolved.address)}
              </Text>
            </Box>
            {opening === resolved.address.toLowerCase()
              ? <Spinner size={20} color={head} />
              : <Icon name="chatRect" size={18} color={fg} />}
          </Pressable>
        ) : null}

        {resolveErr && !resolving ? (
          <Text style={{ color: danger, fontSize: 13, fontFamily: 'Calibre-Medium', paddingHorizontal: 16, paddingVertical: 10 }}>
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
          <SearchRow
            key={p.address.toLowerCase()}
            address={p.address}
            title={getPeerName(p.address) ?? shortAddress(p.address)}
            opening={opening === p.address.toLowerCase()}
            onPress={() => void open(p.address, p.convId)}
            c={{ fg, head, sub, border }}
          />
        ))}

        {!resolved && !resolving && !filtered.length && query.trim() ? (
          <Text style={{ color: sub, fontSize: 13, fontFamily: 'Calibre-Medium', textAlign: 'center', paddingVertical: 24, paddingHorizontal: 24 }}>
            No matches. Paste a full address or a {'name.eth'} to start a chat.
          </Text>
        ) : null}
      </ScrollView>
    </Box>
  );
}
