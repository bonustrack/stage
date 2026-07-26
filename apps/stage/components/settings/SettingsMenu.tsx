
import { useState } from 'react';
import { Scroll as ScrollView } from '@stage-labs/kit/react-native/scroll';

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Col, Box, WEB_EDGE_CONTENT, WEB_STACK_SCROLL, WEB_STACK_CONTENT_PAD } from '../layout';
import { useWebTabbarBottomPad } from '../tabs/webPad';
import { Text } from '@stage-labs/kit/react-native/text';
import { SETTINGS_MENU_ITEMS } from './SettingsMenu.model';
import { capabilities } from '../../lib/capabilities';
import { SettingsHeader } from './SettingsHeader';
import { onNuke, onReset } from './dangerActions';
import { SettingsButtonRow, SettingsList, SettingsNavRow } from './rows';

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

  const tabbarPad = useWebTabbarBottomPad();
  const [resetting, setResetting] = useState(false);
  const [nuking, setNuking] = useState(false);

  return (
    <Col surface="surface" flex={1}>
      <SettingsHeader title="Settings"/>
      <ScrollView style={WEB_STACK_SCROLL} contentContainerStyle={[{ paddingBottom: 32 + insets.bottom }, WEB_EDGE_CONTENT, WEB_STACK_CONTENT_PAD, tabbarPad]}>
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
