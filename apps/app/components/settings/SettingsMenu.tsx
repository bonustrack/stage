/**
 * @file Top-level Settings menu: a list whose rows push the Display, Messenger,
 *  Notifications, and Security sub-pages, plus a danger zone with Reset accounts
 *  and Reset everything actions.
 */

import { useState } from 'react';
import { Alert, Pressable } from 'react-native';
import { Scroll as ScrollView } from '@metro-labs/kit/scroll';

import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Box, Col, Row } from '../layout';
import { Icon, type HeroIconName } from '@metro-labs/kit/icon';
import { Text } from '@metro-labs/kit/text';
import { ListView, ListViewItem } from '@metro-labs/kit/list-view';
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

/** Renders the top-level settings menu listing each settings section. */
// eslint-disable-next-line max-lines-per-function -- TODO(chaitu): refactor to satisfy function-size limits
export function SettingsMenu(): React.ReactElement {
  const router = useRouter();
  const dark = useEffectiveColorScheme() === 'dark';
  const { text: fg, link: head, border, danger } = usePalette();
  const sub = fg;
  const insets = useSafeAreaInsets();
  const blockRadius = useBlockRadius();

  const [resetting, setResetting] = useState(false);
  const [nuking, setNuking] = useState(false);

  /** Handle the Reset. */
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

  /** Handle the Nuke. */
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
            // No finally: on success the app reloads, so nuking stays true until then.
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
        <Pressable onPress={onReset} disabled={resetting}>
          <Box radius={blockRadius} surface="raised" padding={14} margin={{ x: 16, top: 8 }}
            style={{ borderWidth: 1, borderColor: danger, opacity: resetting ? 0.5 : 1 }}
>
            <Row align="center" gap={12}>
              <Icon name="refresh" size={22} color={danger}/>
              <Col minWidth={0} flex={1}>
                <Text weight="semibold" size="md" role="danger">
                  {resetting ? 'Resetting…' : 'Reset accounts'}
                </Text>
                <Text size="xs" role="secondary" style={{ marginTop: 2 }}>
                  Wipe all local accounts, wallet keys, the recovery phrase and XMTP message stores, then return to onboarding.
                </Text>
              </Col>
            </Row>
          </Box>
        </Pressable>
        <Pressable onPress={onNuke} disabled={nuking}>
          <Box radius={blockRadius} surface="raised" padding={14} margin={{ x: 16, top: 12 }}
            style={{ borderWidth: 1, borderColor: danger, opacity: nuking ? 0.5 : 1 }}
>
            <Row align="center" gap={12}>
              <Icon name="trash" size={22} color={danger}/>
              <Col minWidth={0} flex={1}>
                <Text weight="semibold" size="md" role="danger">
                  {nuking ? 'Erasing…' : 'Reset everything'}
                </Text>
                <Text size="xs" role="secondary" style={{ marginTop: 2 }}>
                  Full nuke: everything above PLUS all settings, pins, read markers and cached data. Restarts the app as a fresh install.
                </Text>
              </Col>
            </Row>
          </Box>
        </Pressable>
      </ScrollView>
    </Col>
  );
}
