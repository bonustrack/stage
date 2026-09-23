import type { ReactNode } from 'react';
import { Text } from '@stage-labs/kit/react-native/text';
import { Box, Col, Row } from '../layout';
import { Spinner } from '../Spinner';
import { useXmtpBootstrapPhase } from '../../modules/messaging';
import { usePalette } from '../../lib/theme';

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
