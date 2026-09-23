import { useState } from 'react';
import { QrCode } from '@stage-labs/kit/react-native/qr-code';
import { Button } from '@stage-labs/kit/react-native/button';
import { Text } from '@stage-labs/kit/react-native/text';
import { Box, Col } from '../layout';
import { FormField } from '../FormField';
import { QrScanner } from '../accounts/QrScanner';
import { capabilities } from '../../lib/capabilities';
import { DANGER } from '../../lib/theme';

const QR_SIZE = 260;

export function CodePanel({ dark, code, copyLabel }: { dark: boolean; code: string; copyLabel: string }): React.ReactElement {
  return (
    <Col gap={10} align="center" width="100%">
      <Box padding={12} background="#ffffff" style={{ borderRadius: 12 }}>
        <QrCode value={code} size={QR_SIZE} />
      </Box>
      <Button dark={dark} variant="soft" color="primary" size="lg" fullWidth label="Copy code"
        onPress={() => { capabilities.copy(copyLabel, code); }} />
    </Col>
  );
}

export function CodeInput({ dark, label, value, onChange, disabled }: {
  dark: boolean; label: string; value: string; onChange: (text: string) => void; disabled: boolean;
}): React.ReactElement {
  const [scanning, setScanning] = useState(false);
  return (
    <Col gap={10} width="100%">
      {scanning ? (
        <QrScanner dark={dark} onScan={(text) => { setScanning(false); onChange(text.trim()); }} />
      ) : (
        <FormField label={label} value={value} multiline rows={3} disabled={disabled}
          onChangeText={(text) => { onChange(text.trim()); }}
          inputProps={{ autoCapitalize: 'none', autoCorrect: false }} />
      )}
      <Button dark={dark} variant="ghost" color="primary" size="lg" fullWidth disabled={disabled}
        label={scanning ? 'Stop scanning' : 'Scan QR code'} onPress={() => { setScanning((s) => !s); }} />
    </Col>
  );
}

export function StatusLine({ text, danger }: { text: string | null; danger: boolean }): React.ReactElement | null {
  if (text === null) return null;
  return danger
    ? <Text size="sm" color={DANGER} textAlign="center">{text}</Text>
    : <Text size="sm" role="secondary" textAlign="center">{text}</Text>;
}
