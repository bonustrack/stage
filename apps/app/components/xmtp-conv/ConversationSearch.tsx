
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator } from 'react-native';
import { FlatList } from 'react-native-gesture-handler';
import { Text } from '@stage-labs/kit/text';
import { Box, Row } from '../layout';
import type { HistoryEntry } from '../../lib/types';
import { useFeedRenderItem } from './useFeedRenderItem';
import { searchLocalHistory, type SearchScanResult } from '../../modules/messaging/searchLocal';
import type { useConversationState } from './useConversationState';

type ConvState = ReturnType<typeof useConversationState>;

export interface ConversationSearchProps {
  line: string;
  query: string;
  sub: string; bg: string;
  c: ConvState;
  dark: boolean;
  router: { push: (h: { pathname: '/user/[address]'; params: { address: string } }) => void };
}

export function ConversationSearch({
  line, query, sub, bg, c, dark, router,
}: ConversationSearchProps): React.ReactElement {
  const [result, setResult] = useState<SearchScanResult>({ hits: [], truncated: false });
  const [scanning, setScanning] = useState(false);
  const scanEpoch = useRef(0);

  const q = query.trim();

  const { renderItem, extraData } = useFeedRenderItem(c, dark, router, q);

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
