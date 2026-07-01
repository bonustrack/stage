
import { useEffect, useState } from 'react';

import { Alert } from 'react-native';
import { Scroll as ScrollView } from '@stage-labs/kit/react-native/scroll';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Box, Col } from '../layout';
import { Caption } from '@stage-labs/kit/react-native/caption';
import { ViewHost } from '@stage-labs/kit/react-native/view-host';
import type {
  ListViewNode,
  PayloadHandlers,
} from '@stage-labs/kit/kit';
import {
  listRoot,
  settingsHeader,
  settingsToggleRow,
  settingsButtonRow,
  SCREEN_BACK,
  SETTINGS_TOGGLE_CHANGE,
  SETTINGS_BUTTON_PRESS,
} from '@stage-labs/views';
import { useRouter } from 'expo-router';
import { usePalette } from '../../lib/theme';
import {
  isDebugConsoleEnabled, loadDebugConsole, setDebugConsole, subscribeDebugConsole,
} from '../../lib/railgun/debugConsole';
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

function diagnosticsNode(enabled: boolean): ListViewNode {
  return listRoot(
    settingsToggleRow({
      label: 'Railgun debug console',
      name: 'debugConsole',
      checked: enabled,
      description: 'Show the live Railgun bridge logs + balance-pipeline diagnostics on the Private wallet tab. Off by default - leaving it on can slow the app down.',
      changeType: SETTINGS_TOGGLE_CHANGE,
    }),
  );
}

function dangerNode(resetting: boolean, nuking: boolean): ListViewNode {
  return {
    type: 'ListView',
    children: [
      settingsButtonRow({
        label: resetting ? 'Resetting…' : 'Reset accounts (dev)',
        description:
          'Wipe all local accounts, wallet keys, the recovery phrase and XMTP message stores, then return to onboarding. Cannot be undone.',
        iconStart: 'refresh',
        clickType: SETTINGS_BUTTON_PRESS,
        payload: { action: 'reset' },
        danger: true,
      }),
      settingsButtonRow({
        label: nuking ? 'Erasing…' : 'Reset everything (dev)',
        description:
          'Full nuke: everything above PLUS all settings, preferences, pins, read markers and cached data. Restarts the app as a fresh install. Cannot be undone.',
        iconStart: 'trash',
        clickType: SETTINGS_BUTTON_PRESS,
        payload: { action: 'nuke' },
        danger: true,
      }),
    ],
  };
}

export function DeveloperSettings(): React.ReactElement {
  const router = useRouter();
  const { text: fg, link: head, border, toolbarBg } = usePalette();
  const sub = fg;
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

  const headerNode = settingsHeader({
    title: 'Developer',
    backColor: fg,
    titleColor: head,
    surface: toolbarBg,
    borderColor: border,
    safeTop: insets.top,
  });

  const actions: PayloadHandlers = {
    [SCREEN_BACK]: () => { router.back(); },
    [SETTINGS_TOGGLE_CHANGE]: (payload) => {
      const next = payload.debugConsole;
      if (typeof next === 'boolean') onToggle(next);
    },
    [SETTINGS_BUTTON_PRESS]: (payload) => {
      if (payload.action === 'reset') onReset(setResetting);
      else if (payload.action === 'nuke') onNuke(setNuking);
    },
  };

  return (
    <Col surface="surface" flex={1}>
      <ViewHost node={headerNode} actions={actions}/>
      <ScrollView contentContainerStyle={{ paddingBottom: 32 + insets.bottom }}>
        <Caption color={sub} style={{ paddingHorizontal: 16, paddingTop: 20, paddingBottom: 8 }}>
          DIAGNOSTICS
        </Caption>
        <Box>
          <ViewHost node={diagnosticsNode(enabled)} actions={actions}/>
        </Box>
        <Caption color={sub} style={{ paddingHorizontal: 16, paddingTop: 28, paddingBottom: 8 }}>
          DANGER ZONE
        </Caption>
        <Box>
          <ViewHost node={dangerNode(resetting, nuking)} actions={actions}/>
        </Box>
      </ScrollView>
    </Col>
  );
}
