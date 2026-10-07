import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@stage-labs/kit/react-native/button';
import { QrCode } from '@stage-labs/kit/react-native/qr-code';
import { Tabs } from '@stage-labs/kit/react-native/tabs';
import { Text } from '@stage-labs/kit/react-native/text';
import { Spinner } from '@stage-labs/kit/react-native/spinner';
import { Box, Col, ScreenScroll, PAGE_GUTTER } from '../layout';
import { StackHeader } from '../chrome/StackHeader';
import { FormField } from '../FormField';
import { QrScanner } from '../accounts/QrScanner';
import { getSelectedAccount } from '../../lib/accounts';
import { getAccountSelection, useAccountSelection } from '../../lib/accountSelection';
import { capabilities } from '../../lib/capabilities';
import { useEffectiveColorScheme } from '../../lib/theme';
import { contactQrValue, contactScanResult } from './ContactQr.model';

const MODES = [{ value: 'scan', label: 'Scan' }, { value: 'share', label: 'My QR' }];

function MyQr({ address }: { address: string }): React.ReactElement {
  const value = contactQrValue(address);
  const dark = useEffectiveColorScheme() === 'dark';
  return (
    <Col gap={18} align="center">
      <Text size="md" textAlign="center">Let someone scan this code to open your Stage profile.</Text>
      {value === null ? null : <>
        <Box padding={16} background="#ffffff" radius="lg" accessibilityLabel="Your Stage contact QR code">
          <QrCode value={value} size={224} color="#000000" background="#ffffff" />
        </Box>
        <Text size="xs" textAlign="center" selectable style={{ alignSelf: 'stretch' }}>{address}</Text>
        <Button dark={dark} label="Copy contact link" variant="soft" color="secondary" onPress={() => { capabilities.copy('Contact link', value); }} />
      </>}
      <Text size="xs" role="secondary" textAlign="center">This shares only your public address, not access to your account.</Text>
    </Col>
  );
}

function useContactScan(address: string, selection: number) {
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const focused = useRef(false);
  const accepting = useRef(false);
  const stop = useCallback(() => { accepting.current = false; setScanning(false); }, []);
  useFocusEffect(useCallback(() => {
    focused.current = true;
    return () => { focused.current = false; stop(); };
  }, [stop]));
  useEffect(() => {
    const listener = AppState.addEventListener('change', state => { if (state === 'background') stop(); });
    return () => { listener.remove(); };
  }, [stop]);
  const open = (value: string): void => {
    if (!focused.current || AppState.currentState !== 'active') return;
    const result = contactScanResult(value, address, selection, getAccountSelection());
    if (result === null) return;
    stop();
    if (result.error !== undefined) setError(result.error);
    else capabilities.navigate(result.path);
  };
  return {
    scanning, error, stop, open,
    start: () => {
      if (!focused.current || AppState.currentState !== 'active' || selection !== getAccountSelection()) return;
      setError(null); accepting.current = true; setScanning(true);
    },
    scanned: (value: string) => { if (accepting.current) open(value); },
  };
}

function ContactQr({ address, selection }: { address: string; selection: number }): React.ReactElement {
  const dark = useEffectiveColorScheme() === 'dark';
  const [mode, setMode] = useState('scan');
  const [input, setInput] = useState('');
  const scan = useContactScan(address, selection);
  return (
    <Col gap={24}>
      <Tabs value={mode} options={MODES} onChange={value => { scan.stop(); setMode(value); }} />
      {mode === 'share' ? <MyQr address={address} /> : <Col gap={18}>
        <Text size="md">Scan someone’s Stage QR code to open their profile. You choose whether to start a chat.</Text>
        {scan.scanning ? <>
          <QrScanner dark={dark} onScan={scan.scanned} />
          <Button dark={dark} label="Stop camera" variant="soft" color="secondary" onPress={scan.stop} />
        </> : <Button dark={dark} label="Start camera" onPress={scan.start} />}
        <FormField label="Contact link or address" value={input} onChangeText={setInput}
          placeholder="stage://profile/0x…" onSubmit={() => { scan.open(input); }}
          inputProps={{ autoCapitalize: 'none', autoCorrect: false, autoComplete: 'off', accessibilityLabel: 'Contact link or address' }} />
        {scan.error === null ? null : <Text size="xs" color="danger" accessibilityRole="alert">{scan.error}</Text>}
        <Button dark={dark} label="Open profile" variant="soft" color="secondary" disabled={input.trim() === ''} onPress={() => { scan.open(input); }} />
      </Col>}
    </Col>
  );
}

export function ContactQrScreen(): React.ReactElement {
  const dark = useEffectiveColorScheme() === 'dark';
  const selection = useAccountSelection();
  const { data: address, isPending, refetch } = useQuery({
    queryKey: ['contactQr', selection],
    queryFn: async () => (await getSelectedAccount())?.address ?? null,
  });
  const valid = contactQrValue(address) !== null;
  return (
    <Col surface="surface" flex={1}>
      <StackHeader title="Connect on Stage" backTo="/" />
      <ScreenScroll keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: PAGE_GUTTER }}>
        {isPending ? <Spinner /> : valid && address ? <ContactQr key={selection} address={address} selection={selection} /> : (
          <Col gap={18}>
            <Text size="md">No active account is available. Select an account to scan or share a contact code.</Text>
            <Button dark={dark} label="Try again" variant="soft" color="secondary" onPress={() => { void refetch(); }} />
          </Col>
        )}
      </ScreenScroll>
    </Col>
  );
}
