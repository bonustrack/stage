
import { useState } from 'react';
import { Alert, Pressable } from 'react-native';
import { Scroll as ScrollView } from '@stage-labs/kit/scroll';

import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Box, Col, Row } from '../layout';
import { Icon, type HeroIconName } from '@stage-labs/kit/icon';
import { Text } from '@stage-labs/kit/text';
import { ListView, ListViewItem } from '@stage-labs/kit/list-view';
import { useBlockRadius, useEffectiveColorScheme, usePalette } from '../../lib/theme';
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

function DangerRow({ onPress, busy, icon, label, description, danger, blockRadius, top }: {
  onPress: () => void; busy: boolean; icon: HeroIconName; label: string;
  description: string; danger: string; blockRadius: number; top: number;
}): React.ReactElement {
  return (
    <Pressable onPress={onPress} disabled={busy}>
      <Box radius={blockRadius} surface="raised" padding={14} margin={{ x: 16, top }}
        style={{ borderWidth: 1, borderColor: danger, opacity: busy ? 0.5 : 1 }}
>
        <Row align="center" gap={12}>
          <Icon name={icon} size={22} color={danger}/>
          <Col minWidth={0} flex={1}>
            <Text weight="semibold" size="md" role="danger">{label}</Text>
            <Text size="xs" role="secondary" style={{ marginTop: 2 }}>{description}</Text>
          </Col>
        </Row>
      </Box>
    </Pressable>
  );
}

export function SettingsMenu(): React.ReactElement {
  const router = useRouter();
  const dark = useEffectiveColorScheme() === 'dark';
  const { text: fg, link: head, border, danger } = usePalette();
  const sub = fg;
  const insets = useSafeAreaInsets();
  const blockRadius = useBlockRadius();

  const [resetting, setResetting] = useState(false);
  const [nuking, setNuking] = useState(false);

  const onReset = (): void => {
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
  };

  const onNuke = (): void => {
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
  };

  return (
    <Col surface="surface" flex={1}>
      <SystemHeader title="Settings" dark={dark} fg={fg} head={head} border={border}/>
      <ScrollView contentContainerStyle={{ paddingBottom: 32 + insets.bottom }}>
        <ListView dark={dark}>
          {ROWS.map((row) => (
            <ListViewItem key={row.href} dark={dark} onPress={() => { router.push(row.href); }}>
              <Icon name={row.icon} size={22} color={head}/>
              <Col flex={1}>
                <Text size="xl" color={head}>{row.label}</Text>
              </Col>
              <Icon name="chevronRight" size={18} color={sub}/>
            </ListViewItem>
          ))}
        </ListView>

        <Text size="xs" role="secondary" style={{ paddingHorizontal: 16, paddingTop: 28 }}>
          DANGER ZONE
        </Text>
        <DangerRow
          onPress={onReset} busy={resetting} icon="refresh" danger={danger} blockRadius={blockRadius} top={8}
          label={resetting ? 'Resetting…' : 'Reset accounts'}
          description="Wipe all local accounts, wallet keys, the recovery phrase and XMTP message stores, then return to onboarding."
        />
        <DangerRow
          onPress={onNuke} busy={nuking} icon="trash" danger={danger} blockRadius={blockRadius} top={12}
          label={nuking ? 'Erasing…' : 'Reset everything'}
          description="Full nuke: everything above PLUS all settings, pins, read markers and cached data. Restarts the app as a fresh install."
        />
      </ScrollView>
    </Col>
  );
}
