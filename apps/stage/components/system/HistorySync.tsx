import { useEffect } from 'react';
import { Button } from '@stage-labs/kit/react-native/button';
import { Text } from '@stage-labs/kit/react-native/text';
import { Box, Col, Row } from '../layout';
import { Spinner } from '../Spinner';
import { getActiveAccountId } from '../../lib/accounts';
import { shortAddress, useActiveAccountRecord } from '../../modules/messaging';
import {
  dismissHistorySync, runHistorySync, takePendingHistorySync, useHistorySyncPhase,
} from '../../lib/historySync';
import { historySyncIsActive, historySyncPhaseLabel } from '../../lib/historySync.model';
import { useEffectiveColorScheme, usePalette } from '../../lib/theme';

const DONE_VISIBLE_MS = 4_000;

export function HistorySyncRunner({ ready, hasAccount }: { ready: boolean; hasAccount: boolean }): null {
  const active = ready && hasAccount;
  useEffect(() => {
    if (!active) return;
    let alive = true;
    void (async (): Promise<void> => {
      const id = await getActiveAccountId();
      if (!alive || id === null) return;
      if (await takePendingHistorySync(id)) void runHistorySync();
    })();
    return () => { alive = false; };
  }, [active]);
  return null;
}

function useAutoDismiss(phase: string): void {
  useEffect(() => {
    if (phase !== 'done') return;
    const timer = setTimeout(dismissHistorySync, DONE_VISIBLE_MS);
    return () => { clearTimeout(timer); };
  }, [phase]);
}

export function HistorySyncBanner(): React.ReactElement | null {
  const phase = useHistorySyncPhase();
  const dark = useEffectiveColorScheme() === 'dark';
  const { text } = usePalette();
  const rec = useActiveAccountRecord();
  useAutoDismiss(phase);
  const label = historySyncPhaseLabel(phase, rec === null ? undefined : shortAddress(rec.address));
  if (label === null) return null;
  const busy = historySyncIsActive(phase);
  return (
    <Box margin={{ x: 12, top: 8, bottom: 4 }} padding={{ x: 12, y: 10 }} surface="raised" style={{ borderRadius: 12 }}>
      <Row align="center" gap={10}>
        {busy ? <Spinner size={16} color={text} /> : null}
        <Col flex={1}>
          <Text size="sm">{label}</Text>
        </Col>
        {busy ? null : (
          <Row gap={6}>
            {phase === 'done' ? null : (
              <Button dark={dark} size="sm" variant="soft" color="primary" label="Retry" onPress={() => { void runHistorySync(); }} />
            )}
            <Button dark={dark} size="sm" variant="ghost" color="primary" label="Dismiss" onPress={dismissHistorySync} />
          </Row>
        )}
      </Row>
    </Box>
  );
}
