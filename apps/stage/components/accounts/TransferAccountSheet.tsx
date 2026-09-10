import { useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { QrCode } from '@stage-labs/kit/react-native/qr-code';
import { Button } from '@stage-labs/kit/react-native/button';
import { Text } from '@stage-labs/kit/react-native/text';
import { Title } from '@stage-labs/kit/react-native/title';
import { Box, Col } from '../layout';
import { AppModal } from '../AppModal';
import { Spinner } from '../Spinner';
import { capabilities } from '../../lib/capabilities';
import { DANGER } from '../../lib/theme';
import type { AccountRecord } from '../../lib/accounts';
import { transferKindFor, transferPayloadFor } from '../../lib/accountTransfer';
import { TRANSFER_HOW_TO, transferWarning } from './ImportAccountPanel.model';

const QR_SIZE = 240;
const UNAVAILABLE_MESSAGE = 'This account cannot be moved: it has no exportable key on this device.';

function usePayload(rec: AccountRecord | null, onClose: () => void): string | null {
  const [payload, setPayload] = useState<string | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    setPayload(null);
    if (rec === null) return;
    let alive = true;
    void transferPayloadFor(rec).then((next) => {
      if (!alive) return;
      if (next === null) {
        onCloseRef.current();
        Alert.alert('Not available', UNAVAILABLE_MESSAGE);
        return;
      }
      setPayload(next);
    });
    return () => { alive = false; };
  }, [rec]);
  return payload;
}

function QrPanel({ payload }: { payload: string | null }): React.ReactElement {
  return (
    <Box padding={12} background="#ffffff" style={{ borderRadius: 12 }}>
      {payload === null ? (
        <Box width={QR_SIZE} height={QR_SIZE} align="center" justify="center">
          <Spinner size={24} color="#000000" />
        </Box>
      ) : (
        <QrCode value={payload} size={QR_SIZE} />
      )}
    </Box>
  );
}

export function TransferAccountSheet({ rec, dark, onClose }: {
  rec: AccountRecord | null; dark: boolean; onClose: () => void;
}): React.ReactElement {
  const kind = rec === null ? null : transferKindFor(rec);
  const payload = usePayload(rec, onClose);
  const copy = (): void => {
    if (payload === null) return;
    void capabilities.copyToClipboard(payload);
    capabilities.toast('Transfer code copied');
  };
  return (
    <AppModal visible={rec !== null} onClose={onClose}>
      <Col gap={14} align="center">
        <Title level={3}>Move to another device</Title>
        {kind !== null ? <Text size="xs" color={DANGER} textAlign="center">{transferWarning(kind)}</Text> : null}
        <QrPanel payload={payload} />
        <Text size="sm" role="secondary" textAlign="center">{TRANSFER_HOW_TO}</Text>
        <Button
          dark={dark} variant="soft" color="primary" size="lg" fullWidth label="Copy code"
          disabled={payload === null} onPress={copy}
        />
        <Button dark={dark} variant="ghost" color="primary" size="lg" fullWidth label="Done" onPress={onClose} />
      </Col>
    </AppModal>
  );
}
