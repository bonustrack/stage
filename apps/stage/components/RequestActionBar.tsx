
import { useCallback, useState } from 'react';
import { Button } from '@stage-labs/kit/react-native/button';
import { useRouter } from 'expo-router';
import { acceptRequestConv, blockRequestConv, syncConsent } from '../modules/messaging';
import { usePalette } from '../lib/theme';
import { Box, Row, PAGE_GUTTER } from './layout';
import { useWebTabRail } from '../lib/webLayout';

const FILL = { flex: 1 } as const;

interface RequestActionBarProps {
  convId: string;
  dark: boolean;
  onAccepted: () => void;
}

export function RequestActionBar(props: RequestActionBarProps): React.ReactElement {
  const { convId, dark, onAccepted } = props;
  const router = useRouter();
  const { bg, border, link } = usePalette();
  const [busy, setBusy] = useState(false);
  const wide = useWebTabRail();
  const buttonStyle = wide ? undefined : FILL;

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
      <Row width={'100%'} align="center" gap={10} padding={{ x: PAGE_GUTTER, y: 14 }}>
        <Button
          color="danger" variant="solid" size="lg" pill dark={dark} style={buttonStyle}
          loading={busy} disabled={busy} label="Reject" onPress={onReject}
        />
        <Button
          size="lg" pill dark={dark} style={buttonStyle}
          loading={busy} disabled={busy} label="Approve"
          tintBg={link} tintFg={bg} onPress={onApprove}
        />
      </Row>
    </Box>
  );
}
