
import { useCallback, useState } from 'react';
import { Text } from '@stage-labs/kit/react-native/text';
import { Button } from '@stage-labs/kit/react-native/button';
import { useRouter } from 'expo-router';
import { acceptRequestConv, blockRequestConv, syncConsent } from '../modules/messaging';
import { usePalette } from '../lib/theme';
import { Box, Col, Row } from './layout';

interface RequestActionBarProps {
  convId: string;
  dark: boolean;
  onAccepted: () => void;
}

export function RequestActionBar(props: RequestActionBarProps): React.ReactElement {
  const { convId, dark, onAccepted } = props;
  const router = useRouter();
  const { bg, border, text: fg, link, danger } = usePalette();
  const [busy, setBusy] = useState(false);

  const onApprove = useCallback((): void => {
    if (busy) return;
    setBusy(true);
    void acceptRequestConv(convId)
      .then(() => { void syncConsent(); onAccepted(); })
      .catch(() => { setBusy(false); });
  }, [busy, convId, onAccepted]);

  const onReject = useCallback((): void => {
    if (busy) return;
    setBusy(true);
    void blockRequestConv(convId)
      .then(() => {
        void syncConsent();
        if (router.canGoBack()) router.back(); else router.replace('/');
      })
      .catch(() => { setBusy(false); });
  }, [busy, convId, router]);

  return (
    <Box surface="toolbar" style={{ borderTopWidth: 1, borderTopColor: border }}>
      <Col width={'100%'} padding={{ x: 16, top: 12, bottom: 12 }} align="stretch" gap={10} style={{ alignSelf: 'stretch' }}>
        <Text color={fg} style={{ textAlign: 'center', opacity: 0.8 }}>
          This is a message request. Approve to reply, or reject to decline.
        </Text>
        <Row width={'100%'} gap={10} style={{ alignSelf: 'stretch' }}>
          <Col flex={1} style={{ alignSelf: 'stretch' }}>
            <Button
              color="danger"
              variant="solid"
              size="lg"
              dark={dark}
              fullWidth
              loading={busy}
              disabled={busy}
              label="Reject"
              tintBg={danger}
              tintFg={bg}
              onPress={onReject}
/>
          </Col>
          <Col flex={1} style={{ alignSelf: 'stretch' }}>
            <Button
              size="lg"
              dark={dark}
              fullWidth
              loading={busy}
              disabled={busy}
              label="Approve"
              tintBg={link}
              tintFg={bg}
              onPress={onApprove}
/>
          </Col>
        </Row>
      </Col>
    </Box>
  );
}
