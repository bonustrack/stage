/** In-conversation message search panel (Stage improvement #6).
 *
 *  Results-only list that scans the LOCAL XMTP history of the current
 *  conversation (no inbox-wide sync) and jumps the feed to a tapped match. The
 *  query input itself lives in the topnav (SearchTopnavBar, opened from the
 *  3-dot overflow menu); this panel is mounted by the conversation screen
 *  directly below that topnav and receives the live `query`.
 *
 *  Local-only + chunked: the scan (searchLocalHistory) pages the local MLS db in
 *  PAGE_SIZE chunks, yields between pages, and streams partial results so matches
 *  appear progressively. Tapping a result pages older history (best-effort, capped)
 *  until the target row is loaded, then calls the feed's jumpToMessage to scroll +
 *  flash it. */

import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator } from 'react-native';
import { Pressable } from '@metro-labs/kit/pressable';
import { Text } from '@metro-labs/kit/text';
import { ScrollView } from 'react-native-gesture-handler';
import { Box, Row, Col } from '../layout';
import { getPeerName } from '../../lib/peerProfiles';
import { shortAddress } from '../../modules/messaging';
import type { HistoryEntry } from '../../lib/types';
import { searchLocalHistory, type SearchScanResult } from '../../modules/messaging/searchLocal';

/** Max older-page loads while resolving a tapped result into the live feed. */
const JUMP_MAX_PAGES = 30;

function snippetOf(text: string | undefined, needle: string): string {
  const body = (text ?? '').replace(/\s+/g, ' ').trim();
  if (!body) return '';
  const i = body.toLowerCase().indexOf(needle.toLowerCase());
  if (i < 0 || body.length <= 80) return body.slice(0, 80);
  const start = Math.max(0, i - 24);
  return (start > 0 ? '…' : '') + body.slice(start, start + 80);
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
     *  capped) until the row lands in the live feed, then jump. */
    if (getBubbles().some(b => b.id === hit.id)) { jumpToMessage(hit.id); onClose(); return; }
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
    jumpToMessage(hit.id);
    onClose();
  }, [getBubbles, hasMore, loadOlder, jumpToMessage, onClose]);

  const q = query.trim();
  const showEmpty = q.length >= 2 && !scanning && result.hits.length === 0;

  return (
    <Col background={bg} style={{ borderBottomWidth: 1, borderBottomColor: border }}>
      {q.length >= 2 ? (
        <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 320 }}>
          {result.hits.map(hit => {
            const eth = senderEthOf(hit.from);
            const name = eth ? (getPeerName(eth) ?? shortAddress(eth)) : 'Unknown';
            return (
              <Pressable key={hit.id} onPress={() => { void onPick(hit); }} disabled={jumping}>
                <Col padding={{ x: 16, y: 10 }} gap={2} style={{ borderBottomWidth: 1, borderBottomColor: border }}>
                  <Row justify="between" align="center" gap={8}>
                    <Text size="sm" weight="semibold" color={head} numberOfLines={1} style={{ flex: 1 }}>{name}</Text>
                    <Text size="xs" color={sub}>{timeOf(hit.ts)}</Text>
                  </Row>
                  <Text size="sm" color={fg} numberOfLines={2}>{snippetOf(hit.text, q)}</Text>
                </Col>
              </Pressable>
            );
          })}
          {scanning ? (
            <Row align="center" justify="center" gap={8} padding={{ y: 14 }}>
              <ActivityIndicator size="small" color={sub} />
              <Text size="sm" color={sub}>Searching…</Text>
            </Row>
          ) : null}
          {showEmpty ? (
            <Box padding={{ y: 20 }} align="center"><Text size="sm" color={sub}>No matches</Text></Box>
          ) : null}
          {!scanning && result.truncated && result.hits.length > 0 ? (
            <Box padding={{ x: 16, y: 10 }}><Text size="xs" color={sub}>Showing first matches in recent history.</Text></Box>
          ) : null}
        </ScrollView>
      ) : null}
      {jumping ? (
        <Row align="center" justify="center" gap={8} padding={{ y: 10 }}>
          <ActivityIndicator size="small" color={sub} />
          <Text size="sm" color={sub}>Loading message…</Text>
        </Row>
      ) : null}
    </Col>
  );
}
