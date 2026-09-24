import { errorMessage } from '@stage-labs/client/errors';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { QrCode } from '@stage-labs/kit/react-native/qr-code';
import { Button } from '@stage-labs/kit/react-native/button';
import { Text } from '@stage-labs/kit/react-native/text';
import { Title } from '@stage-labs/kit/react-native/title';
import { fontName } from '@stage-labs/kit/tokens';
import { Box, Col } from '../layout';
import { AppModal } from '../AppModal';
import { FormField } from '../FormField';
import { Spinner } from '../Spinner';
import { QrScanner } from '../accounts/QrScanner';
import { capabilities } from '../../lib/capabilities';
import { useEffectiveColorScheme, usePalette } from '../../lib/theme';
import { sendHistoryWithCode } from '../../lib/historyTransfer';
import {
  RECEIVE_COPY, SEND_COPY, canSubmitCode, codeFromScan, displayCode, expiryLabel, type SendSheetState,
} from './HistoryTransferSheets.model';

const QR_SIZE = 200;
const CODE_STYLE = { fontFamily: fontName.mono, letterSpacing: 2 } as const;

function useSendTransfer(visible: boolean, attempt: number): SendSheetState {
  const [state, setState] = useState<SendSheetState>({ kind: 'preparing' });
  useEffect(() => {
    if (!visible) return;
    let alive = true;
    setState({ kind: 'preparing' });
    sendHistoryWithCode()
      .then((sent) => { if (alive) setState({ kind: 'ready', code: sent.code, expiresAt: sent.expiresAt }); })
      .catch((e: unknown) => { if (alive) setState({ kind: 'failed', message: errorMessage(e) }); });
    return () => { alive = false; };
  }, [visible, attempt]);
  return state;
}

function Preparing(): React.ReactElement {
  const { link } = usePalette();
  return (
    <Col gap={10} align="center" padding={{ y: 24 }}>
      <Spinner size={28} color={link} />
      <Text size="lg" textAlign="center">{SEND_COPY.preparing}</Text>
      <Text size="sm" role="secondary" textAlign="center">{SEND_COPY.preparingHint}</Text>
    </Col>
  );
}

function ReadyCode({ dark, code, expiresAt }: { dark: boolean; code: string; expiresAt: number }): React.ReactElement {
  const shown = displayCode(code);
  return (
    <Col gap={14} align="center">
      <Text size="4xl" weight="semibold" textAlign="center" style={CODE_STYLE}>{shown}</Text>
      <Box padding={12} background="#ffffff" style={{ borderRadius: 12 }}>
        <QrCode value={shown} size={QR_SIZE} />
      </Box>
      <Text size="sm" role="secondary" textAlign="center">{expiryLabel(expiresAt, Date.now())}</Text>
      <Text size="sm" role="secondary" textAlign="center">{SEND_COPY.howTo}</Text>
      <Button dark={dark} variant="soft" color="primary" size="lg" fullWidth label="Copy code"
        onPress={() => { capabilities.copy('Code', shown); }} />
    </Col>
  );
}

function Failed({ dark, message, onRetry }: { dark: boolean; message: string; onRetry: () => void }): React.ReactElement {
  return (
    <Col gap={12} align="center" padding={{ y: 12 }}>
      <Text size="lg" textAlign="center">{SEND_COPY.failedTitle}</Text>
      <Text size="sm" role="danger" textAlign="center">{message}</Text>
      <Button dark={dark} variant="soft" color="primary" size="lg" fullWidth label="Try again" onPress={onRetry} />
    </Col>
  );
}

export function SendHistorySheet({ visible, onClose }: { visible: boolean; onClose: () => void }): React.ReactElement {
  const dark = useEffectiveColorScheme() === 'dark';
  const [attempt, setAttempt] = useState(0);
  const state = useSendTransfer(visible, attempt);
  return (
    <AppModal visible={visible} onClose={onClose}>
      <Col gap={14}>
        <Title level={3}>{SEND_COPY.title}</Title>
        {state.kind === 'preparing' ? <Preparing /> : null}
        {state.kind === 'ready' ? <ReadyCode dark={dark} code={state.code} expiresAt={state.expiresAt} /> : null}
        {state.kind === 'failed' ? <Failed dark={dark} message={state.message} onRetry={() => { setAttempt((n) => n + 1); }} /> : null}
        <Button dark={dark} variant="ghost" color="primary" size="lg" fullWidth label="Done" onPress={onClose} />
      </Col>
    </AppModal>
  );
}

interface ReceiveForm {
  code: string;
  setCode: (code: string) => void;
  busy: boolean;
  error: string | null;
  submit: (code: string) => void;
  fail: (message: string) => void;
}

function useReceiveForm(visible: boolean, onReceive: (code: string) => Promise<void>, onClose: () => void): ReceiveForm {
  const [code, setCodeState] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!visible) return;
    setCodeState('');
    setError(null);
  }, [visible]);
  const setCode = (next: string): void => {
    setCodeState(next);
    setError(null);
  };
  const submit = (value: string): void => {
    if (busy || !canSubmitCode(value)) return;
    setBusy(true);
    setError(null);
    onReceive(value)
      .then(() => { onClose(); })
      .catch((e: unknown) => { setError(errorMessage(e)); })
      .finally(() => { setBusy(false); });
  };
  return { code, setCode, busy, error, submit, fail: setError };
}

export function ReceiveCodeSheet({ visible, onClose, onReceive }: {
  visible: boolean; onClose: () => void; onReceive: (code: string) => Promise<void>;
}): React.ReactElement {
  const dark = useEffectiveColorScheme() === 'dark';
  const form = useReceiveForm(visible, onReceive, onClose);
  const [scanning, setScanning] = useState(false);
  const canScan = Platform.OS !== 'web';
  const onScan = (text: string): void => {
    setScanning(false);
    const scanned = codeFromScan(text);
    if (scanned === null) { form.fail(RECEIVE_COPY.badScan); return; }
    form.setCode(scanned);
    form.submit(scanned);
  };
  return (
    <AppModal visible={visible} onClose={() => { if (!form.busy) onClose(); }}>
      <Col gap={12}>
        <Title level={3}>{RECEIVE_COPY.title}</Title>
        <Text size="sm" role="secondary">{RECEIVE_COPY.about}</Text>
        {scanning ? <QrScanner dark={dark} onScan={onScan} /> : (
          <FormField label="Code" placeholder={RECEIVE_COPY.placeholder} value={form.code} onChangeText={form.setCode}
            disabled={form.busy} onSubmit={form.submit}
            hint={form.error ?? undefined} hintTone="danger"
            inputProps={{ autoCapitalize: 'characters', autoCorrect: false, autoComplete: 'off', maxLength: 16, autoFocus: true }} />
        )}
        <Button
          dark={dark} variant="solid" color="primary" size="lg" fullWidth
          label={form.busy ? RECEIVE_COPY.importing : RECEIVE_COPY.submit}
          loading={form.busy} disabled={form.busy || !canSubmitCode(form.code)}
          onPress={() => { form.submit(form.code); }}
        />
        {canScan ? (
          <Button dark={dark} variant="ghost" color="primary" size="lg" fullWidth disabled={form.busy}
            label={scanning ? RECEIVE_COPY.type : RECEIVE_COPY.scan} onPress={() => { setScanning((s) => !s); }} />
        ) : null}
      </Col>
    </AppModal>
  );
}
