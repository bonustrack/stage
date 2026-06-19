/** @file In-conversation message search feed that scans local XMTP history in chunks for body matches and renders them with the same bubble renderer as the live feed, with the keyword highlighted. */

import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator } from 'react-native';
import { FlatList } from 'react-native-gesture-handler';
import { Text } from '@metro-labs/kit/text';
import { Box, Row } from '../layout';
import type { HistoryEntry } from '../../lib/types';
import { useFeedRenderItem } from './useFeedRenderItem';
import { searchLocalHistory, type SearchScanResult } from '../../modules/messaging/searchLocal';
import type { useConversationState } from './useConversationState';

type ConvState = ReturnType<typeof useConversationState>;

export interface ConversationSearchProps {
  line: string;
  /** Live query string — owned by the conversation screen's topnav search bar. */
  query: string;
  sub: string; bg: string;
  /** Full conversation state — reused so matches render with the identical bubble renderer (and all its handlers) as the live feed. */
  c: ConvState;
  dark: boolean;
  router: { push: (h: { pathname: '/user/[address]'; params: { address: string } }) => void };
}

/** In-conversation search bar that filters and highlights matching messages. */
export function ConversationSearch({
  line, query, sub, bg, c, dark, router,
}: ConversationSearchProps): React.ReactElement {
  const [result, setResult] = useState<SearchScanResult>({ hits: [], truncated: false });
  const [scanning, setScanning] = useState(false);
  /** Bumped on every new scan / unmount so an in-flight scan aborts itself. */
  const scanEpoch = useRef(0);

  const q = query.trim();

  /** Same bubble renderer as the live feed, with the keyword highlighted. */
  const { renderItem, extraData } = useFeedRenderItem(c, dark, router, q);

  /** Debounced scan: each query change starts a fresh local scan and cancels the previous one via the epoch guard. Empty/short query clears results. */
  useEffect(() => {
    const epoch = ++scanEpoch.current;
    if (q.length < 2) { setResult({ hits: [], truncated: false }); setScanning(false); return; }
    setScanning(true);
    const t = setTimeout(() => {
      void searchLocalHistory(
        line, q,
        partial => { if (scanEpoch.current === epoch) setResult(partial); },
        () => scanEpoch.current !== epoch,
      ).finally(() => { if (scanEpoch.current === epoch) setScanning(false); });
    }, 220);
    return () => { clearTimeout(t); };
  }, [q, line]);

  useEffect(() => () => { scanEpoch.current += 1; }, []);

  const showEmpty = q.length >= 2 && !scanning && result.hits.length === 0;

  return (
    <FlatList<HistoryEntry>
      style={{ flex: 1, backgroundColor: bg }}
      data={result.hits}
      extraData={extraData}
      /** Hits come back newest-first; invert so they read like the live feed (newest at the bottom, oldest scrolling up). */
      inverted
      keyExtractor={h => h.id}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      renderItem={renderItem}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingTop: 12, paddingBottom: 12 }}
      ListEmptyComponent={
        showEmpty
          ? <Box padding={{ y: 28 }} align="center"><Text size="sm" color={sub}>No matches</Text></Box>
          : null
      }
      /** Inverted → footer renders at the visual TOP. Holds the scanning spinner and the "first matches only" cap hint. */
      ListFooterComponent={
        <>
          {scanning ? (
            <Row align="center" justify="center" gap={8} padding={{ y: 14 }}>
              <ActivityIndicator size="small" color={sub} />
              <Text size="sm" color={sub}>Searching…</Text>
            </Row>
          ) : null}
          {!scanning && result.truncated && result.hits.length > 0 ? (
            <Box padding={{ x: 16, y: 10 }}><Text size="xs" color={sub}>Showing first matches in recent history.</Text></Box>
          ) : null}
        </>
      }
    />
  );
}
