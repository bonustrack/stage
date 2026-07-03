
import { useState } from 'react';
import { Alert } from 'react-native';
import { Scroll as ScrollView } from '@stage-labs/kit/react-native/scroll';

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Col, Box } from '../layout';
import { Text } from '@stage-labs/kit/react-native/text';
import { ViewHost } from '@stage-labs/kit/react-native/view-host';
import type {
  ListViewNode,
  PayloadHandlers,
} from '@stage-labs/kit/kit';
import {
  backAction,
  settingsHeader,
  settingsMenuNode,
  settingsNavAction,
  settingsButtonRow,
  SETTINGS_BUTTON_PRESS,
} from '@views';
import { capabilities } from '../../lib/capabilities';
import { usePalette } from '../../lib/theme';
import { resetForOnboarding } from '../../lib/wallet';
import { resetEverything } from '../../lib/resetEverything';

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

const navNode: ListViewNode = settingsMenuNode();

function dangerNode(resetting: boolean, nuking: boolean): ListViewNode {
  return {
    type: 'ListView',
    children: [
      settingsButtonRow({
        label: resetting ? 'Resetting…' : 'Reset accounts',
        description:
          'Wipe all local accounts, wallet keys, the recovery phrase and XMTP message stores, then return to onboarding.',
        iconStart: 'refresh',
        clickType: SETTINGS_BUTTON_PRESS,
        payload: { action: 'reset' },
        danger: true,
      }),
      settingsButtonRow({
        label: nuking ? 'Erasing…' : 'Reset everything',
        description:
          'Full nuke: everything above PLUS all settings, pins, read markers and cached data. Restarts the app as a fresh install.',
        iconStart: 'trash',
        clickType: SETTINGS_BUTTON_PRESS,
        payload: { action: 'nuke' },
        danger: true,
      }),
    ],
  };
}

export function SettingsMenu(): React.ReactElement {
  const { text: fg, link: head, border, toolbarBg } = usePalette();
  const insets = useSafeAreaInsets();

  const [resetting, setResetting] = useState(false);
  const [nuking, setNuking] = useState(false);

  const headerNode = settingsHeader({
    title: 'Settings',
    backColor: fg,
    titleColor: head,
    surface: toolbarBg,
    borderColor: border,
    safeTop: insets.top,
  });

  const actions: PayloadHandlers = {
    ...backAction(capabilities),
    ...settingsNavAction(capabilities),
    [SETTINGS_BUTTON_PRESS]: (payload) => {
      if (payload.action === 'reset') onReset(setResetting);
      else if (payload.action === 'nuke') onNuke(setNuking);
    },
  };

  return (
    <Col surface="surface" flex={1}>
      <ViewHost node={headerNode} actions={actions}/>
      <ScrollView contentContainerStyle={{ paddingBottom: 32 + insets.bottom }}>
        <ViewHost node={navNode} actions={actions}/>
        <Text size="xs" role="secondary" style={{ paddingHorizontal: 16, paddingTop: 28 }}>
          DANGER ZONE
        </Text>
        <Box padding={{ top: 8 }}>
          <ViewHost node={dangerNode(resetting, nuking)} actions={actions}/>
        </Box>
      </ScrollView>
    </Col>
  );
}
