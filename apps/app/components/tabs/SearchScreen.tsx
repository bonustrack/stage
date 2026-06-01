/** Search tab — a working all-surfaces search.
 *
 *  Mounted as the 2nd tab body by the shared pager (SwipeTabs). As the user
 *  types (debounced ~200ms) it searches across THREE sources and renders the
 *  hits grouped into sections:
 *
 *   a. CONVERSATIONS — the cached channels rows (lib/channelsCache, the same
 *      source HomeScreen renders). Matches on the conversation title, the DM
 *      peer's resolved display name (getPeerName), and the peer address
 *      (case-insensitive substring). Rendered via the shared ChannelRow.
 *   b. ADDRESSES — if the query is a full address (or an ENS-style `*.eth`),
 *      surface a "start a chat" result that resolves + opens a DM. (Reuses the
 *      same openDmWithAddress / resolveEnsName path as the standalone /search.)
 *   c. MESSAGE TEXT — for each cached conversation we fetch a bounded recent
 *      window of messages (RECENT_PER_CONV, capped to MAX_CONVS_SCANNED convs)
 *      and substring-match the humanised text (previewOfXmtpContent). Bounded +
 *      cancellable so it never blocks the UI: a per-conv text cache (built once
 *      per session, refreshed lazily) means repeat keystrokes don't re-fetch.
 *
 *  Tapping a conversation OR message result opens `/xmtp/[convId]`. Message-jump
 *  to the exact message is DEFERRED (the conv view doesn't expose a scroll-to-id
 *  API yet) — we just open the conversation.
 *
 *  Pure JS, no new native module; lives in the dev client. */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, TextInput } from 'react-native';
import { FlatList } from 'react-native-gesture-handler';
import { Text } from '@metro-labs/kit/text';
import { Icon } from '@metro-labs/kit/icon';
import { useRouter } from 'expo-router';
import { isAddress } from 'viem';
import type { SimultaneousRefs } from '../SwipeTabs';
import { usePalette } from '../../lib/theme';
import { getCachedRows } from '../../lib/channelsCache';
import {
  getCachedXmtpClient, openDmWithAddress, shortAddress,
} from '../../lib/xmtp';
import { resolveEnsName } from '../../lib/ens';
import { usePeerProfiles, getPeerName, getPeerAvatarCb, isPeerResolved } from '../../lib/peerProfiles';
import { previewOfXmtpContent } from '@metro-labs/client/xmtp/humanize';
import { Avatar } from '../Avatar';
import { ChannelRow } from '../ChannelRow';
import { Box, Col, Row } from '../layout';
import { Spinner } from '../Spinner';

/** How many recent messages to scan per conversation, and how many conversations
 *  to scan, so message search stays bounded regardless of inbox size. */
const RECENT_PER_CONV = 40;
const MAX_CONVS_SCANNED = 40;
/** Max message hits surfaced. */
const MAX_MSG_HITS = 30;
const DEBOUNCE_MS = 200;

/** Minimal shape we read off a cached channels row. */
interface ConvRow {
  convId: string;
  title: string;
  peerAddress: string | null;
  avatarAddress: string | null;
  avatarUri: string | null;
  lastTs: number | null;
}

interface MsgHit {
  convId: string;
  convTitle: string;
  peerAddress: string | null;
  snippet: string;
  sentNs: number;
}

/** Cheap pre-flight — accept any *.eth (multi-label) as ENS-resolvable. */
function looksLikeEns(s: string): boolean {
  return /^[a-z0-9-]+(\.[a-z0-9-]+)*\.eth$/i.test(s.trim());
}

/** Per-session cache of humanised message text per conv, so repeat queries don't
 *  re-decode. Keyed by convId → array of { text, sentNs }. Module-level so it
 *  survives tab remounts within a session. */
const msgTextCache = new Map<string, { text: string; sentNs: number }[]>();

function readConvRows(): ConvRow[] {
  const rows = getCachedRows() ?? [];
  return rows.map(r => ({
    convId: String((r as { convId?: string }).convId ?? ''),
    title: String((r as { title?: string }).title ?? ''),
    peerAddress: ((r as { peerAddress?: string | null }).peerAddress) ?? null,
    avatarAddress: ((r as { avatarAddress?: string | null }).avatarAddress) ?? null,
    avatarUri: ((r as { avatarUri?: string | null }).avatarUri) ?? null,
    lastTs: ((r as { lastTs?: number | null }).lastTs) ?? null,
  })).filter(r => r.convId);
}

export function SearchScreen({ panRef }: { panRef?: SimultaneousRefs } = {}): React.ReactElement {
  const router = useRouter();
  const { fg, head, sub, bg, border, rowBg } = usePalette();

  /** The search TextInput ref (used to programmatically blur/clear). */
  const inputRef = useRef<TextInput>(null);

  const [query, setQuery] = useState('');
  /** Debounced query that actually drives the search. */
  const [q, setQ] = useState('');
  const [searching, setSearching] = useState(false);
  const [msgHits, setMsgHits] = useState<MsgHit[]>([]);
  /** ENS resolution result for an address-shaped query. */
  const [resolved, setResolved] = useState<{ address: string; source: 'address' | 'ens' } | null>(null);
  const [opening, setOpening] = useState<string | null>(null);

  const convRows = useMemo(() => readConvRows(), []);

  /** Resolve display names for every peer so conv/contact rows render names. */
  usePeerProfiles([
    resolved?.address,
    ...convRows.map(r => r.peerAddress),
    ...convRows.map(r => r.avatarAddress),
  ]);


  /** Debounce the raw input → q. */
  useEffect(() => {
    const t = setTimeout(() => setQ(query.trim()), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [query]);

  /** Conversation matches (title / peer name / peer address). */
  const convHits = useMemo(() => {
    const needle = q.toLowerCase();
    if (!needle) return [];
    return convRows.filter(r => {
      if (r.title.toLowerCase().includes(needle)) return true;
      if (r.peerAddress && r.peerAddress.toLowerCase().includes(needle)) return true;
      const name = r.peerAddress ? getPeerName(r.peerAddress) : undefined;
      return !!name && name.toLowerCase().includes(needle);
    });
  }, [convRows, q]);

  /** Address / ENS resolution for "start a chat" result. */
  useEffect(() => {
    if (!q) { setResolved(null); return; }
    if (isAddress(q)) { setResolved({ address: q.toLowerCase(), source: 'address' }); return; }
    if (!looksLikeEns(q)) { setResolved(null); return; }
    let cancelled = false;
    setResolved(null);
    void (async (): Promise<void> => {
      try {
        const addr = await resolveEnsName(q.toLowerCase());
        if (!cancelled && addr) setResolved({ address: addr.toLowerCase(), source: 'ens' });
      } catch { /* ignore — just no resolved result */ }
    })();
    return () => { cancelled = true; };
  }, [q]);

  /** Bounded, cancellable message-text search. Runs on each settled query. */
  useEffect(() => {
    const needle = q.toLowerCase();
    if (!needle) { setMsgHits([]); setSearching(false); return; }

    let cancelled = false;
    setSearching(true);

    void (async (): Promise<void> => {
      const client = getCachedXmtpClient();
      /** Scan the most-recently-active convs first (already sorted-ish by lastTs). */
      const scan = [...convRows]
        .sort((a, b) => (b.lastTs ?? 0) - (a.lastTs ?? 0))
        .slice(0, MAX_CONVS_SCANNED);

      const hits: MsgHit[] = [];

      for (const r of scan) {
        if (cancelled) return;
        let texts = msgTextCache.get(r.convId);
        if (!texts) {
          texts = [];
          if (client) {
            try {
              const conv = await client.conversations.findConversation(
                r.convId as unknown as Parameters<typeof client.conversations.findConversation>[0],
              );
              if (conv) {
                const msgs = await conv.messages({ limit: RECENT_PER_CONV }).catch(() => []);
                for (const m of msgs) {
                  let text = '';
                  try { text = previewOfXmtpContent(m.content(), m.contentTypeId); }
                  catch { text = ''; }
                  if (text) texts.push({ text, sentNs: m.sentNs ?? 0 });
                }
              }
            } catch { /* leave texts empty for this conv */ }
          }
          msgTextCache.set(r.convId, texts);
        }
        if (cancelled) return;
        for (const t of texts) {
          if (t.text.toLowerCase().includes(needle)) {
            hits.push({
              convId: r.convId,
              convTitle: r.peerAddress ? (getPeerName(r.peerAddress) ?? r.title) : r.title,
              peerAddress: r.peerAddress,
              snippet: t.text.slice(0, 120),
              sentNs: t.sentNs,
            });
            if (hits.length >= MAX_MSG_HITS) break;
          }
        }
        if (hits.length >= MAX_MSG_HITS) break;
      }

      if (cancelled) return;
      hits.sort((a, b) => b.sentNs - a.sentNs);
      setMsgHits(hits);
      setSearching(false);
    })();

    return () => { cancelled = true; };
  }, [q, convRows]);

  const openConv = useCallback((convId: string): void => {
    router.push({ pathname: '/xmtp/[convId]', params: { convId } });
  }, [router]);

  const openAddress = useCallback((address: string): void => {
    if (opening) return;
    setOpening(address.toLowerCase());
    void (async (): Promise<void> => {
      try {
        const id = await openDmWithAddress(address);
        router.push({ pathname: '/xmtp/[convId]', params: { convId: id } });
      } catch { /* swallow */ } finally { setOpening(null); }
    })();
  }, [opening, router]);

  const sectionHeader = (label: string): React.ReactElement => (
    <Text style={{
      color: sub, fontSize: 12, fontFamily: 'Calibre-Medium',
      paddingHorizontal: 16, paddingTop: 16, paddingBottom: 6,
    }}>{label}</Text>
  );

  const hasQuery = q.length > 0;
  const nothing = hasQuery && !searching && convHits.length === 0 && msgHits.length === 0 && !resolved;

  return (
    <Col flex={1} bg={bg}>
      {/* Search input bar */}
      <Row align="center" gap={8} px={12} pt={12} pb={10} style={{
        borderBottomWidth: 1, borderBottomColor: border,
      }}>
        <Box style={{
          flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8,
          backgroundColor: rowBg, borderRadius: 999,
          paddingHorizontal: 14, paddingVertical: 8,
        }}>
          <Icon name="search" size={18} color={sub} />
          <TextInput
            ref={inputRef}
            value={query}
            onChangeText={setQuery}
            placeholder="Search messages, people, addresses"
            placeholderTextColor={sub}
            autoCapitalize="none"
            autoCorrect={false}
            style={{ flex: 1, color: head, fontSize: 16, fontFamily: 'Calibre-Medium', padding: 0 }}
          />
          {query.length > 0 ? (
            <Pressable onPress={() => setQuery('')} hitSlop={8}>
              <Icon name="x" size={16} color={sub} />
            </Pressable>
          ) : null}
        </Box>
      </Row>

      {!hasQuery ? (
        <Col flex={1} align="center" justify="center" p={32}>
          <Icon name="search" size={40} color={sub} />
          <Text style={{ color: sub, fontSize: 15, fontFamily: 'Calibre-Medium', textAlign: 'center', marginTop: 12 }}>
            Search messages, people, addresses
          </Text>
        </Col>
      ) : (
        <FlatList
          simultaneousHandlers={panRef}
          data={msgHits}
          keyboardShouldPersistTaps="handled"
          keyExtractor={(h, i) => `${h.convId}:${h.sentNs}:${i}`}
          contentContainerStyle={{ paddingBottom: 24 }}
          ListHeaderComponent={
            <>
              {/* Address / ENS "start a chat" result */}
              {resolved ? (
                <>
                  {sectionHeader('ADDRESS')}
                  <Pressable
                    onPress={() => openAddress(resolved.address)}
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
                        {getPeerName(resolved.address) ?? (resolved.source === 'ens' ? q : shortAddress(resolved.address))}
                      </Text>
                      <Text style={{ color: sub, fontSize: 13, fontFamily: 'Calibre-Medium', marginTop: 2 }} numberOfLines={1}>
                        {shortAddress(resolved.address)}
                      </Text>
                    </Box>
                    {opening === resolved.address.toLowerCase()
                      ? <Spinner size={16} color={head} />
                      : <Icon name="chatRect" size={18} color={fg} />}
                  </Pressable>
                </>
              ) : null}

              {/* Conversation matches */}
              {convHits.length > 0 ? sectionHeader('CONVERSATIONS') : null}
              {convHits.map(r => {
                const displayTitle = r.peerAddress ? (getPeerName(r.peerAddress) ?? r.title) : r.title;
                const showAddr = !r.avatarUri && r.avatarAddress && isPeerResolved(r.avatarAddress)
                  ? r.avatarAddress : null;
                return (
                  <ChannelRow
                    key={r.convId}
                    title={displayTitle}
                    avatarUri={r.avatarUri}
                    avatarAddress={showAddr}
                    cacheBuster={r.avatarAddress ? getPeerAvatarCb(r.avatarAddress) : undefined}
                    square={!r.peerAddress}
                    subtitle={r.peerAddress ? shortAddress(r.peerAddress) : null}
                    onPress={() => openConv(r.convId)}
                  />
                );
              })}

              {/* Messages section header (rows are the FlatList data) */}
              {msgHits.length > 0 ? sectionHeader('MESSAGES') : null}
              {searching ? (
                <Row align="center" justify="center" py={16} gap={8}>
                  <Spinner size={16} color={head} />
                  <Text style={{ color: sub, fontSize: 13, fontFamily: 'Calibre-Medium' }}>Searching…</Text>
                </Row>
              ) : null}
            </>
          }
          renderItem={({ item }) => (
            <Pressable
              onPress={() => openConv(item.convId)}
              style={({ pressed }) => ({
                backgroundColor: pressed ? border : 'transparent',
                flexDirection: 'row', alignItems: 'center', gap: 12,
                paddingHorizontal: 14, paddingVertical: 12,
                borderBottomWidth: 1, borderBottomColor: border,
              })}
            >
              <Avatar
                address={item.peerAddress}
                size="md"
                cacheBuster={item.peerAddress ? getPeerAvatarCb(item.peerAddress) : undefined}
                square={!item.peerAddress}
                style={{ backgroundColor: border }}
              />
              <Box style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ color: head, fontSize: 15, fontFamily: 'Calibre-Semibold' }} numberOfLines={1}>
                  {item.convTitle}
                </Text>
                <Text style={{ color: sub, fontSize: 14, fontFamily: 'Calibre-Medium', marginTop: 2 }} numberOfLines={2}>
                  {item.snippet}
                </Text>
              </Box>
            </Pressable>
          )}
          ListFooterComponent={
            nothing ? (
              <Text style={{ color: sub, fontSize: 14, fontFamily: 'Calibre-Medium', textAlign: 'center', paddingVertical: 32, paddingHorizontal: 24 }}>
                No matches for “{q}”.
              </Text>
            ) : null
          }
        />
      )}
    </Col>
  );
}
