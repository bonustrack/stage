/**
 * @file Settings -> Developer screen: device-local diagnostic toggles, currently
 *  the opt-in Railgun debug-console preference plus reset actions.
 */

import { useEffect, useState } from 'react';

import { Alert, Pressable, Switch } from 'react-native';
import { Scroll as ScrollView } from '@metro-labs/kit/scroll';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Box, Col, Row } from '../layout';
import { Text } from '@metro-labs/kit/text';
import { useBlockRadius, useEffectiveColorScheme, usePalette } from '../../lib/theme';
import { SystemHeader } from '../system/SystemHeader';
import {
  isDebugConsoleEnabled, loadDebugConsole, setDebugConsole, subscribeDebugConsole,
} from '../../lib/railgun/debugConsole';
import { resetForOnboarding } from '../../lib/wallet';
import { resetEverything } from '../../lib/resetEverything';

/** Renders the developer settings screen with reset and debugging actions. */
// eslint-disable-next-line max-lines-per-function -- TODO(chaitu): refactor to satisfy function-size limits
export function DeveloperSettings(): React.ReactElement {
  const dark = useEffectiveColorScheme() === 'dark';
  const { text: fg, link: head, border, danger } = usePalette();
  const sub = fg;
  const insets = useSafeAreaInsets();
  const blockRadius = useBlockRadius();
  const [enabled, setEnabled] = useState(isDebugConsoleEnabled());

  useEffect(() => {
    void loadDebugConsole().then(setEnabled);
    return subscribeDebugConsole(() => { setEnabled(isDebugConsoleEnabled()); });
  }, []);

  const [resetting, setResetting] = useState(false);
  const [nuking, setNuking] = useState(false);

  /** Handle the Toggle. */
  const onToggle = (next: boolean): void => {
    setEnabled(next); // optimistic
    void setDebugConsole(next);
  };

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
      <SystemHeader title="Developer" dark={dark} fg={fg} head={head} border={border}/>
      <ScrollView contentContainerStyle={{ paddingBottom: 32 + insets.bottom }}>
        <Text size="xs" color={sub} style={{ paddingHorizontal: 16, paddingTop: 20 }}>
          DIAGNOSTICS
        </Text>
        <Box radius={blockRadius} surface="raised" padding={14} margin={{ x: 16, top: 8 }}
          style={{ borderWidth: 1, borderColor: border }}
>
          <Row align="center" gap={12}>
            <Col minWidth={0} flex={1}>
              <Text weight="semibold" size="md" color={head}>Railgun debug console</Text>
              <Text size="xs" color={sub} style={{ marginTop: 2 }}>
                Show the live Railgun bridge logs + balance-pipeline diagnostics on the Private wallet tab. Off by default - leaving it on can slow the app down.
              </Text>
            </Col>
            <Switch value={enabled} onValueChange={onToggle}/>
          </Row>
        </Box>

        <Text size="xs" role="secondary" style={{ paddingHorizontal: 16, paddingTop: 28 }}>
          DANGER ZONE
        </Text>
        <Pressable onPress={onReset} disabled={resetting}>
          <Box radius={blockRadius} surface="raised" padding={14} margin={{ x: 16, top: 8 }}
            style={{ borderWidth: 1, borderColor: danger, opacity: resetting ? 0.5 : 1 }}
>
            <Text weight="semibold" size="md" role="danger">
              {resetting ? 'Resetting…' : 'Reset accounts (dev)'}
            </Text>
            <Text size="xs" role="secondary" style={{ marginTop: 2 }}>
              Wipe all local accounts, wallet keys, the recovery phrase and XMTP message stores, then return to onboarding. Cannot be undone.
            </Text>
          </Box>
        </Pressable>
        <Pressable onPress={onNuke} disabled={nuking}>
          <Box radius={blockRadius} surface="raised" padding={14} margin={{ x: 16, top: 12 }}
            style={{ borderWidth: 1, borderColor: danger, opacity: nuking ? 0.5 : 1 }}
>
            <Text weight="semibold" size="md" role="danger">
              {nuking ? 'Erasing…' : 'Reset everything (dev)'}
            </Text>
            <Text size="xs" role="secondary" style={{ marginTop: 2 }}>
              Full nuke: everything above PLUS all settings, preferences, pins, read markers and cached data. Restarts the app as a fresh install. Cannot be undone.
            </Text>
          </Box>
        </Pressable>
      </ScrollView>
    </Col>
  );
}
