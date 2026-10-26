import { Text } from '@stage-labs/kit/react-native/text';
import { Spinner } from '@stage-labs/kit/react-native/spinner';
import { useXmtpBootstrapPhase } from '../../lib/xmtp.state.core';
import { usePalette } from '../../lib/theme';
import { Column, Row, PAGE_GUTTER } from '../layout';

export function MessagingSetupBanner(): React.ReactElement | null {
  const phase = useXmtpBootstrapPhase();
  const { text } = usePalette();
  if (phase !== 'registering') return null;
  return (
    <Column margin={{ x: PAGE_GUTTER, top: 8, bottom: 4 }} padding={{ x: 12, y: 10 }} surface="raised" style={{ borderRadius: 12 }}>
      <Row align="center" gap={10}>
        <Spinner size={16} color={text} />
        <Column weight={1}><Text size="2xs">Setting up secure messaging on this device…</Text></Column>
      </Row>
    </Column>
  );
}
