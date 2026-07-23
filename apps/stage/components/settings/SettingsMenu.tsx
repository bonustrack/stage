
import { useState } from 'react';
import { Alert } from 'react-native';
import { Scroll as ScrollView } from '@stage-labs/kit/react-native/scroll';

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Col, Box, WEB_EDGE_SCROLL, WEB_EDGE_CONTENT } from '../layout';
import { WEB_TABBAR_BOTTOM_PAD } from '../tabs/webPad';
import { Text } from '@stage-labs/kit/react-native/text';
import { SETTINGS_MENU_ITEMS } from './SettingsMenu.model';
import { capabilities } from '../../lib/capabilities';
import { resetForOnboarding } from '../../lib/wallet';
import { resetEverything } from '../../lib/resetEverything';
import { SettingsHeader } from './SettingsHeader';
import { SettingsButtonRow, SettingsList, SettingsNavRow } from './rows';

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
        label={resetting ? 'Resetting…' : 'Reset accounts'}
        description="Wipe all local accounts, wallet keys, the recovery phrase and XMTP message stores, then return to onboarding."
        iconStart="refresh"
        danger
        onPress={() => { onReset(setResetting); }}
      />
      <SettingsButtonRow
        label={nuking ? 'Erasing…' : 'Reset everything'}
        description="Full nuke: everything above PLUS all settings, pins, read markers and cached data. Restarts the app as a fresh install."
        iconStart="trash"
        danger
        onPress={() => { onNuke(setNuking); }}
      />
    </SettingsList>
  );
}

export function SettingsMenu(): React.ReactElement {
  const insets = useSafeAreaInsets();

  const [resetting, setResetting] = useState(false);
  const [nuking, setNuking] = useState(false);

  return (
    <Col surface="surface" flex={1}>
      <SettingsHeader title="Settings"/>
      <ScrollView style={WEB_EDGE_SCROLL} contentContainerStyle={[{ paddingBottom: 32 + insets.bottom }, WEB_EDGE_CONTENT, WEB_TABBAR_BOTTOM_PAD]}>
        <SettingsList>
          {SETTINGS_MENU_ITEMS.map((item) => (
            <SettingsNavRow
              key={item.href}
              label={item.label}
              iconStart={item.icon}
              onPress={() => { capabilities.navigate(item.href); }}
            />
          ))}
        </SettingsList>
        <Text size="xs" role="secondary" style={{ paddingHorizontal: 16, paddingTop: 28 }}>
          DANGER ZONE
        </Text>
        <Box padding={{ top: 8 }}>
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
