/** In-conversation message search results — rendered INSIDE the feed area.
 *
 *  When search is open with a query, the conversation screen swaps the message
 *  FlatList for this results list (it occupies the same feed region, below the
 *  search topnav). It scans the LOCAL XMTP history of the current conversation
 *  (no inbox-wide sync) and jumps the feed to a tapped match. The query input
 *  lives in the topnav (SearchTopnavBar); this component receives the live
 *  `query` and owns the scan + results rows only.
 *
 *  Local-only + chunked: the scan (searchLocalHistory) pages the local MLS db in
 *  PAGE_SIZE chunks, yields between pages, and streams partial results so matches
 *  appear progressively. Tapping a result pages older history (best-effort, capped)
 *  until the target row is loaded, then calls the feed's jumpToMessage to scroll +
 *  flash it (closing search first). */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator } from 'react-native';
import { FlatList } from 'react-native-gesture-handler';
import { Pressable } from '@metro-labs/kit/pressable';
import { Text } from '@metro-labs/kit/text';
import { Box, Row, Col } from '../layout';
import { getPeerName } from '../../lib/peerProfiles';
import { shortAddress } from '../../modules/messaging';
import type { HistoryEntry } from '../../lib/types';
import { searchLocalHistory, type SearchScanResult } from '../../modules/messaging/searchLocal';

/** Max older-page loads while resolving a tapped result into the live feed. */
const JUMP_MAX_PAGES = 30;

/** Split a snippet around the matched needle so the match can be highlighted. */
function snippetParts(text: string | undefined, needle: string): { pre: string; hit: string; post: string } {
  const body = (text ?? '').replace(/\s+/g, ' ').trim();
  if (!body) return { pre: '', hit: '', post: '' };
  const lower = body.toLowerCase();
  const n = needle.toLowerCase();
  let i = lower.indexOf(n);
  /** Window the snippet around the match so long messages don't bury it. */
  let start = 0;
  let view = body;
  if (i >= 0 && body.length > 80) {
    start = Math.max(0, i - 24);
    view = (start > 0 ? '…' : '') + body.slice(start, start + 80);
    i = view.toLowerCase().indexOf(n);
  } else if (body.length > 80) {
    view = body.slice(0, 80);
    i = view.toLowerCase().indexOf(n);
  }
  if (i < 0) return { pre: view, hit: '', post: '' };
  return { pre: view.slice(0, i), hit: view.slice(i, i + needle.length), post: view.slice(i + needle.length) };
}

function timeOf(ts: string): string {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export interface ConversationSearchProps {
  line: string;
  /** Live query string — owned by the conversation screen's topnav search bar. */
  query: string;
  fg: string; sub: string; bg: string; border: string; head: string;
  senderEthOf: (from: string) => string | null;
  /** Current loaded feed (newest-first); used to detect when a target landed. */
  getBubbles: () => HistoryEntry[];
  hasMore: () => boolean;
  loadOlder: () => Promise<void>;
  jumpToMessage: (messageId: string) => void;
  onClose: () => void;
}

export function ConversationSearch({
  line, query, fg, sub, bg, border, head,
  senderEthOf, getBubbles, hasMore, loadOlder, jumpToMessage, onClose,
}: ConversationSearchProps): React.ReactElement {
  const [result, setResult] = useState<SearchScanResult>({ hits: [], truncated: false });
  const [scanning, setScanning] = useState(false);
  const [jumping, setJumping] = useState(false);
  /** Bumped on every new scan / unmount so an in-flight scan aborts itself. */
  const scanEpoch = useRef(0);

  /** Debounced scan: each query change starts a fresh local scan and cancels the
   *  previous one via the epoch guard. Empty query clears results. */
  useEffect(() => {
    const epoch = ++scanEpoch.current;
    const q = query.trim();
    if (q.length < 2) { setResult({ hits: [], truncated: false }); setScanning(false); return; }
    setScanning(true);
    const t = setTimeout(() => {
      void searchLocalHistory(
        line, q,
        partial => { if (scanEpoch.current === epoch) setResult(partial); },
        () => scanEpoch.current !== epoch,
      ).finally(() => { if (scanEpoch.current === epoch) setScanning(false); });
    }, 220);
    return () => clearTimeout(t);
  }, [query, line]);

  useEffect(() => () => { scanEpoch.current += 1; }, []);

  const onPick = useCallback(async (hit: HistoryEntry) => {
    /** Already loaded → jump immediately. Else page older history (best-effort,
     *  capped) until the row lands in the live feed, then jump. Search closes
     *  first so the feed is visible when it scrolls + flashes. */
    if (getBubbles().some(b => b.id === hit.id)) { onClose(); jumpToMessage(hit.id); return; }
    setJumping(true);
    try {
      for (let i = 0; i < JUMP_MAX_PAGES; i += 1) {
        if (!hasMore()) break;
        await loadOlder();
        if (getBubbles().some(b => b.id === hit.id)) break;
      }
    } finally {
      setJumping(false);
    }
    onClose();
    jumpToMessage(hit.id);
  }, [getBubbles, hasMore, loadOlder, jumpToMessage, onClose]);

  const q = query.trim();
  const showEmpty = q.length >= 2 && !scanning && result.hits.length === 0;

  const renderItem = useCallback(({ item: hit }: { item: HistoryEntry }) => {
    const eth = senderEthOf(hit.from);
    const name = eth ? (getPeerName(eth) ?? shortAddress(eth)) : 'Unknown';
    const { pre, hit: match, post } = snippetParts(hit.text, q);
    return (
      <Pressable onPress={() => { void onPick(hit); }} disabled={jumping}>
        <Col padding={{ x: 16, y: 10 }} gap={2} style={{ borderBottomWidth: 1, borderBottomColor: border }}>
          <Row justify="between" align="center" gap={8}>
            <Text size="sm" weight="semibold" color={head} numberOfLines={1} style={{ flex: 1 }}>{name}</Text>
            <Text size="xs" color={sub}>{timeOf(hit.ts)}</Text>
          </Row>
          <Text size="sm" color={fg} numberOfLines={2}>
            {pre}<Text size="sm" weight="semibold" color={head}>{match}</Text>{post}
          </Text>
        </Col>
      </Pressable>
    );
  }, [senderEthOf, q, onPick, jumping, border, head, sub, fg]);

  /** Empty query → keep the feed area minimal (no rows, no chrome). The screen
   *  still shows the live feed when there's no query; with a query we own it. */
  const footer = useMemo(() => (
    <>
      {scanning ? (
        <Row align="center" justify="center" gap={8} padding={{ y: 14 }}>
          <ActivityIndicator size="small" color={sub} />
          <Text size="sm" color={sub}>Searching…</Text>
        </Row>
      ) : null}
      {showEmpty ? (
        <Box padding={{ y: 28 }} align="center"><Text size="sm" color={sub}>No matches</Text></Box>
      ) : null}
      {!scanning && result.truncated && result.hits.length > 0 ? (
        <Box padding={{ x: 16, y: 10 }}><Text size="xs" color={sub}>Showing first matches in recent history.</Text></Box>
      ) : null}
      {jumping ? (
        <Row align="center" justify="center" gap={8} padding={{ y: 12 }}>
          <ActivityIndicator size="small" color={sub} />
          <Text size="sm" color={sub}>Loading message…</Text>
        </Row>
      ) : null}
    </>
  ), [scanning, showEmpty, result.truncated, result.hits.length, jumping, sub]);

  return (
    <FlatList
      style={{ flex: 1, backgroundColor: bg }}
      data={result.hits}
      keyExtractor={h => h.id}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      renderItem={renderItem}
      ListFooterComponent={footer}
    />
  );
}
