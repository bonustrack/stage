
import { useState } from 'react';
import { Alert } from 'react-native';
import { Scroll as ScrollView } from '@stage-labs/kit/react-native/scroll';

import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Col, Box } from '../layout';
import type { HeroIconName } from '@stage-labs/kit/react-native/icon';
import { Text } from '@stage-labs/kit/react-native/text';
import { KitRenderer } from '@stage-labs/kit/react-native/kit-renderer';
import type {
  ListViewNode,
  WidgetActionRegistry,
} from '@stage-labs/kit/kit';
import {
  settingsNavRow,
  settingsButtonRow,
  SETTINGS_NAV_PRESS,
  SETTINGS_BUTTON_PRESS,
} from '@stage-labs/views';
import { useEffectiveColorScheme, usePalette } from '../../lib/theme';
import { SystemHeader } from '../system/SystemHeader';
import { resetForOnboarding } from '../../lib/wallet';
import { resetEverything } from '../../lib/resetEverything';

type Href =
  | '/settings/display'
  | '/settings/messenger'
  | '/settings/notifications'
  | '/settings/wallet'
  | '/settings/security'
  | '/settings/experimental'
  | '/settings/about';
const ROWS: { href: Href; label: string; icon: HeroIconName }[] = [
  { href: '/settings/display', label: 'Display', icon: 'sun' },
  { href: '/settings/messenger', label: 'Messenger', icon: 'chat' },
  { href: '/settings/notifications', label: 'Notifications', icon: 'bell' },
  { href: '/settings/wallet', label: 'Wallet', icon: 'wallet' },
  { href: '/settings/security', label: 'Security', icon: 'key' },
  { href: '/settings/experimental', label: 'Experimental', icon: 'beaker' },
  { href: '/settings/about', label: 'About', icon: 'questionMarkCircle' },
];

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

const navNode: ListViewNode = {
  type: 'ListView',
  children: ROWS.map((row) =>
    settingsNavRow({
      label: row.label,
      iconStart: row.icon,
      pressType: SETTINGS_NAV_PRESS,
      payload: { href: row.href },
    }),
  ),
};

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
  const router = useRouter();
  const dark = useEffectiveColorScheme() === 'dark';
  const { text: fg, link: head, border } = usePalette();
  const insets = useSafeAreaInsets();

  const [resetting, setResetting] = useState(false);
  const [nuking, setNuking] = useState(false);

  const registry: WidgetActionRegistry = {
    [SETTINGS_NAV_PRESS]: (action) => {
      const href = action.payload.href;
      if (typeof href === 'string') router.push(href);
    },
    [SETTINGS_BUTTON_PRESS]: (action) => {
      if (action.payload.action === 'reset') onReset(setResetting);
      else if (action.payload.action === 'nuke') onNuke(setNuking);
    },
  };

  return (
    <Col surface="surface" flex={1}>
      <SystemHeader title="Settings" dark={dark} fg={fg} head={head} border={border}/>
      <ScrollView contentContainerStyle={{ paddingBottom: 32 + insets.bottom }}>
        <KitRenderer node={navNode} registry={registry}/>
        <Text size="xs" role="secondary" style={{ paddingHorizontal: 16, paddingTop: 28 }}>
          DANGER ZONE
        </Text>
        <Box padding={{ top: 8 }}>
          <KitRenderer node={dangerNode(resetting, nuking)} registry={registry}/>
        </Box>
      </ScrollView>
    </Col>
  );
}
