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
 *  Types/constants/search-logic live in SearchScreen.helpers.ts; the result-row
 *  sub-components in SearchScreen.rows.tsx — split out for the <200-line cap.
 *
 *  Pure JS, no new native module; lives in the dev client. */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { TextInput } from 'react-native';
import { FlatList } from 'react-native-gesture-handler';
import { useRouter } from 'expo-router';
import { isAddress } from 'viem';
import type { SimultaneousRefs } from '../SwipeTabs.types';
import { usePalette } from '../../lib/theme';
import { openDmWithAddress } from '../../lib/xmtp';
import { resolveEnsName } from '../../lib/ens';
import { usePeerProfiles, getPeerName } from '../../lib/peerProfiles';
import { Col } from '../layout';
import {
  DEBOUNCE_MS, type MsgHit, looksLikeEns, readConvRows, searchMessageText,
} from './SearchScreen.helpers';
import { makeSectionHeader, MessageRow } from './SearchScreen.rows';
import {
  SearchBar, SearchEmptyState, SearchResultsHeader, SearchNoMatches,
} from './SearchScreen.layout';

export function SearchScreen({ panRef }: { panRef?: SimultaneousRefs } = {}): React.ReactElement {
  const router = useRouter();
  const { text: fg, link: head, bg, border } = usePalette();
  const sub = fg;
  const rowBg = border;
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
      const hits = await searchMessageText(convRows, needle, () => cancelled);
      if (cancelled) return;
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

  const pal = { fg, head, sub, border };
  const sectionHeader = makeSectionHeader(sub);
  const hasQuery = q.length > 0;
  const nothing = hasQuery && !searching && convHits.length === 0 && msgHits.length === 0 && !resolved;

  return (
    <Col flex={1} bg={bg}>
      <SearchBar ref={inputRef} pal={{ head, sub, border, rowBg }} query={query} setQuery={setQuery} />

      {!hasQuery ? (
        <SearchEmptyState sub={sub} />
      ) : (
        <FlatList
          simultaneousHandlers={panRef}
          data={msgHits}
          keyboardShouldPersistTaps="handled"
          keyExtractor={(h, i) => `${h.convId}:${h.sentNs}:${i}`}
          contentContainerStyle={{ paddingBottom: 24 }}
          ListHeaderComponent={
            <SearchResultsHeader
              pal={pal}
              sectionHeader={sectionHeader}
              resolved={resolved}
              query={q}
              opening={opening}
              onOpenAddress={openAddress}
              convHits={convHits}
              onOpenConv={openConv}
              msgHasHits={msgHits.length > 0}
              searching={searching}
            />
          }
          renderItem={({ item }) => <MessageRow pal={pal} item={item} onPress={openConv} />}
          ListFooterComponent={nothing ? <SearchNoMatches sub={sub} query={q} /> : null}
        />
      )}
    </Col>
  );
}
