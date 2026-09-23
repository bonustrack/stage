import { useEffect, type ReactNode } from 'react';
import { Button } from '@stage-labs/kit/react-native/button';
import { Text } from '@stage-labs/kit/react-native/text';
import { Box, Col, Row } from '../layout';
import { Spinner } from '../Spinner';
import { shortAddress, useActiveAccountRecord, useXmtpBootstrapPhase } from '../../modules/messaging';
import { dismissHistorySync, runHistorySync, useHistorySyncPhase } from '../../lib/historySync';
import { historySyncIsActive, historySyncPhaseLabel } from '../../lib/historySync.model';
import { useEffectiveColorScheme, usePalette } from '../../lib/theme';

const DONE_VISIBLE_MS = 4_000;

function useAutoDismiss(phase: string): void {
  useEffect(() => {
    if (phase !== 'done') return;
    const timer = setTimeout(dismissHistorySync, DONE_VISIBLE_MS);
    return () => { clearTimeout(timer); };
  }, [phase]);
}

function BannerFrame({ children }: { children: ReactNode }): React.ReactElement {
  return (
    <Box margin={{ x: 12, top: 8, bottom: 4 }} padding={{ x: 12, y: 10 }} surface="raised" style={{ borderRadius: 12 }}>
      <Row align="center" gap={10}>{children}</Row>
    </Box>
  );
}

export function MessagingSetupBanner(): React.ReactElement | null {
  const phase = useXmtpBootstrapPhase();
  const { text } = usePalette();
  if (phase !== 'registering') return null;
  return (
    <BannerFrame>
      <Spinner size={16} color={text} />
      <Col flex={1}><Text size="sm">Setting up secure messaging on this device…</Text></Col>
    </BannerFrame>
  );
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
    <BannerFrame>
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
    </BannerFrame>
  );
}
