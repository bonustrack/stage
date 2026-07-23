
import { useEffect, useState } from 'react';

import { Alert } from 'react-native';
import { Scroll as ScrollView } from '@stage-labs/kit/react-native/scroll';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Box, Col, WEB_EDGE_CONTENT, WEB_STACK_SCROLL, WEB_STACK_CONTENT_PAD } from '../layout';
import { Caption } from '@stage-labs/kit/react-native/caption';
import { usePalette } from '../../lib/theme';
import {
  isDebugConsoleEnabled, loadDebugConsole, setDebugConsole, subscribeDebugConsole,
} from '../../lib/railgun/debugConsole';
import { resetForOnboarding } from '../../lib/wallet';
import { resetEverything } from '../../lib/resetEverything';
import { SettingsHeader } from './SettingsHeader';
import { SettingsButtonRow, SettingsList, SettingsToggleRow } from './rows';

function onReset(setResetting: (v: boolean) => void): void {
  Alert.alert(
    'Reset accounts',
    'Wipes ALL local accounts, wallet keys, the recovery phrase, and every XMTP message store on this device, then returns to onboarding. This cannot be undone.',
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reset',
        style: 'destructive',
        onPress: () => {
          setResetting(true);
          void resetForOnboarding()
            .catch(() => { Alert.alert('Reset failed', 'Could not clear account state.'); })
            .finally(() => { setResetting(false); });
        },
      },
    ],
  );
}

function onNuke(setNuking: (v: boolean) => void): void {
  Alert.alert(
    'Reset everything',
    'Erases EVERYTHING on this device: accounts, wallet keys, the recovery phrase, every XMTP message store, and ALL settings, preferences, pins, read markers and cached data. The app restarts as a fresh install and drops you into onboarding. This cannot be undone.',
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Erase everything',
        style: 'destructive',
        onPress: () => {
          setNuking(true);
          void resetEverything()
            .catch(() => { setNuking(false); Alert.alert('Reset failed', 'Could not wipe local state.'); });
        },
      },
    ],
  );
}

function DangerRows({ resetting, nuking, setResetting, setNuking }: {
  resetting: boolean;
  nuking: boolean;
  setResetting: (v: boolean) => void;
  setNuking: (v: boolean) => void;
}): React.ReactElement {
  return (
    <SettingsList>
      <SettingsButtonRow
        label={resetting ? 'Resetting…' : 'Reset accounts (dev)'}
        description="Wipe all local accounts, wallet keys, the recovery phrase and XMTP message stores, then return to onboarding. Cannot be undone."
        iconStart="refresh"
        danger
        onPress={() => { onReset(setResetting); }}
      />
      <SettingsButtonRow
        label={nuking ? 'Erasing…' : 'Reset everything (dev)'}
        description="Full nuke: everything above PLUS all settings, preferences, pins, read markers and cached data. Restarts the app as a fresh install. Cannot be undone."
        iconStart="trash"
        danger
        onPress={() => { onNuke(setNuking); }}
      />
    </SettingsList>
  );
}

export function DeveloperSettings(): React.ReactElement {
  const { text: fg } = usePalette();
  const insets = useSafeAreaInsets();
  const [enabled, setEnabled] = useState(isDebugConsoleEnabled());

  useEffect(() => {
    void loadDebugConsole().then(setEnabled);
    return subscribeDebugConsole(() => { setEnabled(isDebugConsoleEnabled()); });
  }, []);

  const [resetting, setResetting] = useState(false);
  const [nuking, setNuking] = useState(false);

  const onToggle = (next: boolean): void => {
    setEnabled(next);
    void setDebugConsole(next);
  };

  return (
    <Col surface="surface" flex={1}>
      <SettingsHeader title="Developer"/>
      <ScrollView style={WEB_STACK_SCROLL} contentContainerStyle={[{ paddingBottom: 32 + insets.bottom }, WEB_EDGE_CONTENT, WEB_STACK_CONTENT_PAD]}>
        <Caption color={fg} style={{ paddingHorizontal: 16, paddingTop: 20, paddingBottom: 8 }}>
          DIAGNOSTICS
        </Caption>
        <Box>
          <SettingsList>
            <SettingsToggleRow
              label="Railgun debug console"
              name="debugConsole"
              checked={enabled}
              description="Show the live Railgun bridge logs + balance-pipeline diagnostics on the Private wallet tab. Off by default - leaving it on can slow the app down."
              onChange={onToggle}
            />
          </SettingsList>
        </Box>
        <Caption color={fg} style={{ paddingHorizontal: 16, paddingTop: 28, paddingBottom: 8 }}>
          DANGER ZONE
        </Caption>
        <Box>
          <DangerRows
            resetting={resetting}
            nuking={nuking}
            setResetting={setResetting}
            setNuking={setNuking}
          />
        </Box>
      </ScrollView>
    </Col>
  );
}
