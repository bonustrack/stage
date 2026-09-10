import { useState } from 'react';
import { Alert } from 'react-native';
import { Caption } from '@stage-labs/kit/react-native/caption';
import { Input } from '@stage-labs/kit/react-native/input';
import { Button } from '@stage-labs/kit/react-native/button';
import { Text } from '@stage-labs/kit/react-native/text';
import { Title } from '@stage-labs/kit/react-native/title';
import { fontSize } from '@stage-labs/kit/tokens';
import { Box, Col } from '../layout';
import { AppModal } from '../AppModal';
import { flash } from '../../lib/toast';
import { useEffectiveColorScheme, usePalette } from '../../lib/theme';
import {
  generateHistoryPin, receiveHistoryWithPin, runHistorySync, shareHistory, useHistorySyncPhase,
} from '../../lib/historySync';
import {
  formatHistoryPin, historySyncIsActive, historySyncPhaseLabel, isValidHistoryPin, normalizeHistoryPin,
} from '../../lib/historySync.model';
import { SettingsButtonRow, SettingsList } from './rows';

const SYNC_DESC = 'Ask your other devices for the messages this device is missing. Keep Stage open on the other device while it answers.';
const SEND_DESC = 'Package this device\'s history for another device. You will get a PIN to enter there.';
const RECEIVE_DESC = 'Enter the PIN shown on the device that sent its history.';

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

function PinSheet({ visible, busy, onClose, onSubmit }: {
  visible: boolean; busy: boolean; onClose: () => void; onSubmit: (pin: string) => void;
}): React.ReactElement {
  const dark = useEffectiveColorScheme() === 'dark';
  const pal = usePalette();
  const [pin, setPin] = useState('');
  const clean = normalizeHistoryPin(pin);
  return (
    <AppModal visible={visible} onClose={onClose}>
      <Col gap={12}>
        <Title level={3}>Receive history</Title>
        <Text size="sm" role="secondary">{RECEIVE_DESC}</Text>
        <Input
          value={pin}
          onChangeText={setPin}
          placeholder="000 000"
          placeholderTextColor={pal.sub}
          inputProps={{ keyboardType: 'number-pad', maxLength: 7, autoFocus: true }}
          style={{
            color: pal.text, backgroundColor: pal.inputBg, fontSize: fontSize('xl'), textAlign: 'center',
            borderWidth: 1, borderColor: pal.border, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 12,
          }}
        />
        <Button
          dark={dark} variant="solid" color="primary" size="lg" fullWidth label="Import history"
          loading={busy} disabled={busy || !isValidHistoryPin(clean)}
          onPress={() => { onSubmit(clean); }}
        />
      </Col>
    </AppModal>
  );
}

function useHistoryActions(): {
  busy: boolean; pinOpen: boolean; setPinOpen: (v: boolean) => void;
  onSend: () => void; onReceive: (pin: string) => void;
} {
  const [busy, setBusy] = useState(false);
  const [pinOpen, setPinOpen] = useState(false);
  const onSend = (): void => {
    if (busy) return;
    setBusy(true);
    const pin = generateHistoryPin();
    shareHistory(pin)
      .then(() => {
        Alert.alert('History sent', `On the other device choose Receive history with a PIN and enter ${formatHistoryPin(pin)}.`);
      })
      .catch((e: unknown) => { Alert.alert('Could not send history', errorMessage(e)); })
      .finally(() => { setBusy(false); });
  };
  const onReceive = (pin: string): void => {
    if (busy) return;
    setBusy(true);
    receiveHistoryWithPin(pin)
      .then(() => { setPinOpen(false); flash('History imported'); })
      .catch((e: unknown) => { Alert.alert('Could not import history', errorMessage(e)); })
      .finally(() => { setBusy(false); });
  };
  return { busy, pinOpen, setPinOpen, onSend, onReceive };
}

export function HistorySyncSection(): React.ReactElement {
  const { text: fg } = usePalette();
  const phase = useHistorySyncPhase();
  const a = useHistoryActions();
  const syncing = historySyncIsActive(phase);
  const status = historySyncPhaseLabel(phase);
  return (
    <>
      <Caption color={fg} style={{ paddingHorizontal: 16, paddingTop: 28, paddingBottom: 8 }}>
        HISTORY
      </Caption>
      <Box>
        <SettingsList>
          <SettingsButtonRow
            label={syncing ? 'Syncing history…' : 'Sync history from another device'}
            description={status ?? SYNC_DESC}
            iconStart="refresh"
            onPress={() => { if (!syncing) void runHistorySync(); }}
          />
          <SettingsButtonRow
            label={a.busy ? 'Working…' : 'Send history to another device'}
            description={SEND_DESC}
            iconStart="upload"
            onPress={a.onSend}
          />
          <SettingsButtonRow
            label="Receive history with a PIN"
            description={RECEIVE_DESC}
            iconStart="download"
            onPress={() => { a.setPinOpen(true); }}
          />
        </SettingsList>
      </Box>
      <PinSheet visible={a.pinOpen} busy={a.busy} onClose={() => { a.setPinOpen(false); }} onSubmit={a.onReceive} />
    </>
  );
}
