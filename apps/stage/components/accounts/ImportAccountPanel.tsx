import { useState } from 'react';
import type { AccountTransfer } from '@stage-labs/client/accounts/transfer';
import { fontSize } from '@stage-labs/kit/tokens';
import { Button } from '@stage-labs/kit/react-native/button';
import { Text } from '@stage-labs/kit/react-native/text';
import { Textarea } from '@stage-labs/kit/react-native/textarea';
import { Col } from '../layout';
import { DANGER, usePalette } from '../../lib/theme';
import { QrScanner } from './QrScanner';
import { parseImportInput } from './ImportAccountPanel.model';

function ScanArea({ dark, busy, scanning, setScanning, onCode }: {
  dark: boolean; busy: boolean; scanning: boolean;
  setScanning: (v: boolean) => void; onCode: (code: string) => void;
}): React.ReactElement {
  if (!scanning) {
    return (
      <Button
        dark={dark} variant="soft" color="primary" size="lg" label="Scan QR code"
        disabled={busy} onPress={() => { setScanning(true); }}
      />
    );
  }
  return (
    <>
      <QrScanner dark={dark} onScan={onCode} />
      <Button
        dark={dark} variant="ghost" color="primary" label="Stop scanning"
        disabled={busy} onPress={() => { setScanning(false); }}
      />
    </>
  );
}

export function ImportAccountPanel({ dark, busy, error, onSubmit }: {
  dark: boolean; busy: boolean; error: string | null;
  onSubmit: (transfer: AccountTransfer) => void;
}): React.ReactElement {
  const pal = usePalette();
  const [text, setText] = useState('');
  const [scanning, setScanning] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);

  const submit = (raw: string): void => {
    const parsed = parseImportInput(raw);
    if (!parsed.ok) { setParseError(parsed.error); return; }
    setParseError(null);
    onSubmit(parsed.transfer);
  };
  const shown = parseError ?? error;

  return (
    <Col gap={12}>
      <ScanArea
        dark={dark} busy={busy} scanning={scanning} setScanning={setScanning}
        onCode={(code) => { setScanning(false); setText(code); submit(code); }}
      />
      <Text size="xs" role="secondary">Or paste the transfer code, a private key, or a recovery phrase.</Text>
      <Textarea
        value={text}
        onChangeText={(t) => { setText(t); setParseError(null); }}
        placeholder="stage-account:1:… or 0x… or 12-24 words"
        placeholderTextColor={pal.sub}
        dark={dark}
        rows={3}
        inputProps={{ autoCapitalize: 'none', autoCorrect: false }}
        style={{
          color: pal.text, fontFamily: 'Menlo', fontSize: fontSize('sm'),
          borderWidth: 1, borderColor: pal.border, borderRadius: 12,
          paddingHorizontal: 12, paddingVertical: 12, backgroundColor: 'transparent',
        }}
      />
      {shown !== null ? <Text size="xs" color={DANGER}>{shown}</Text> : null}
      <Button
        dark={dark} variant="solid" color="primary" size="lg" label="Import account"
        loading={busy} disabled={busy || text.trim().length === 0}
        onPress={() => { submit(text); }}
      />
    </Col>
  );
}
