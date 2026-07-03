
import { useCallback, useEffect, useState } from 'react';
import { Text } from '@stage-labs/kit/react-native/text';
import { Button } from '@stage-labs/kit/react-native/button';
import { useRouter } from 'expo-router';
import {
  getConvConsentState, acceptRequestConv, blockRequestConv,
  getCachedXmtpClient, streamConvConsent,
} from '../modules/messaging';
import { usePalette } from '../lib/theme';
import { Box, Col, Row } from './layout';

function syncConsentBestEffort(): void {
  void (getCachedXmtpClient() as unknown as {
    preferences?: { syncConsent?: () => Promise<unknown> };
  })?.preferences?.syncConsent?.();
}

export interface RequestActionBarProps {
  convId: string;
  dark: boolean;
  onPending: (pending: boolean) => void;
}

export function RequestActionBar(props: RequestActionBarProps): React.ReactElement | null {
  const { convId, dark, onPending } = props;
  const router = useRouter();
  const { bg, border, text: fg, link, danger } = usePalette();
  const [pending, setPending] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const resolve = async (): Promise<void> => {
      try {
        const state = await getConvConsentState(convId);
        if (cancelled) return;
        if (state === 'unknown') { setPending(true); onPending(true); }
        else { setPending(false); onPending(false); }
      } catch {
        if (!cancelled) { setPending(false); onPending(false); }
      }
    };
    void resolve();
    let cancelConsent: (() => void) | null = null;
    try { cancelConsent = streamConvConsent(() => { void resolve(); }); }
    catch { }
    return (): void => {
      cancelled = true;
      if (cancelConsent) try { cancelConsent(); } catch { }
    };
  }, [convId, onPending]);

  const onApprove = useCallback((): void => {
    if (busy) return;
    setBusy(true);
    void acceptRequestConv(convId)
      .then(() => { syncConsentBestEffort(); setPending(false); onPending(false); })
      .catch(() => { setBusy(false); });
  }, [busy, convId, onPending]);

  const onReject = useCallback((): void => {
    if (busy) return;
    setBusy(true);
    void blockRequestConv(convId)
      .then(() => {
        syncConsentBestEffort();
        if (router.canGoBack()) router.back(); else router.replace('/');
      })
      .catch(() => { setBusy(false); });
  }, [busy, convId, router]);

  if (pending !== true) return null;

  return (
    <Box surface="toolbar" style={{ borderTopWidth: 1, borderTopColor: border }}>
      <Col width={'100%'} padding={{ x: 16, top: 12, bottom: 12 }} align="stretch" gap={10} style={{ alignSelf: 'stretch' }}>
        <Text color={fg} style={{ textAlign: 'center', opacity: 0.8 }}>
          This is a message request. Approve to reply, or reject to decline.
        </Text>
        {}
        <Row width={'100%'} gap={10} style={{ alignSelf: 'stretch' }}>
          <Col flex={1} style={{ alignSelf: 'stretch' }}>
            <Button
              variant="danger"
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
              variant="primary"
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
