/** Settings → Security — App Lock toggle + the existing "Export private key" /
 *  "Remove account" rows (key backup).
 *
 *   - App Lock: a Switch wired to lib/appLock. ON requires biometric / device
 *     credential before the app renders on cold start + resume-after-background.
 *     Enabling requires a successful auth first, so the user proves they can
 *     satisfy the lock before it gates the app. Devices with nothing enrolled
 *     get a hint instead of a lock they can't open.
 *   - Key backup: AccountSecuritySection's export row reveals the private key
 *     behind a warning Alert + (now) a biometric re-auth. No new key handling. */

import { useEffect, useState } from 'react';
import { Alert, Switch } from 'react-native';
import { Scroll as ScrollView } from '@metro-labs/kit/scroll';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Box, Col, Row } from '../layout';
import { Text } from '@metro-labs/kit/text';
import { Caption } from '@metro-labs/kit/caption';
import { DANGER, useBlockRadius, useEffectiveColorScheme, usePalette } from '../../lib/theme';
import { AccountSecuritySection } from '../tabs/SettingsScreen.account';
import { SystemHeader } from '../system/SystemHeader';
import {
  useAppLockEnabled, setAppLockEnabled, canAuthenticate, authenticate,
} from '../../lib/appLock';

export function SecuritySettings(): React.ReactElement {
  const dark = useEffectiveColorScheme() === 'dark';
  const { text: fg, link: head, border } = usePalette();
  const sub = fg;
  const rowBg = border;
  const insets = useSafeAreaInsets();
  const blockRadius = useBlockRadius();

  const lockEnabled = useAppLockEnabled();
  const [canAuth, setCanAuth] = useState<boolean | null>(null);

  useEffect(() => {
    void canAuthenticate().then(setCanAuth).catch(() => setCanAuth(false));
  }, []);

  const onToggleLock = (next: boolean): void => {
    if (!next) { void setAppLockEnabled(false); return; }
    if (canAuth === false) {
      Alert.alert(
        'No device security',
        'Set up a fingerprint, Face ID, or device passcode in your system settings first, then enable App Lock.',
      );
      return;
    }
    // Require a successful auth to ARM the lock — prove it can be satisfied.
    void (async (): Promise<void> => {
      const res = await authenticate('Enable App Lock');
      if (res.ok) { void setAppLockEnabled(true); return; }
      if (res.reason === 'unavailable') {
        Alert.alert('Unavailable', 'Biometric unlock is not available on this device yet.');
      }
    })();
  };

  const lockHint = canAuth === false
    ? 'No fingerprint, Face ID, or passcode is set up on this device.'
    : 'Require biometric or device passcode to open Metro after it has been in the background.';

  return (
    <Col surface="surface" flex={1}>
      <SystemHeader title="Security" dark={dark} fg={fg} head={head} border={border}/>
      <ScrollView contentContainerStyle={{ paddingBottom: 32 + insets.bottom }}>
        <Caption color={sub} style={{ paddingHorizontal: 16, paddingTop: 20 }}>
          APP LOCK
        </Caption>
        <Box radius={blockRadius} surface="raised" padding={14} margin={{ x: 16, top: 8 }}
          style={{ borderWidth: 1, borderColor: border }}
>
          <Row align="center" gap={12}>
            <Col minWidth={0} flex={1}>
              <Text weight="semibold" size="md" color={head}>App lock</Text>
              <Caption color={sub} style={{ marginTop: 2 }}>{lockHint}</Caption>
            </Col>
            <Switch value={lockEnabled} onValueChange={onToggleLock}/>
          </Row>
        </Box>

        <AccountSecuritySection
          c={{ fg, head, sub, border, rowBg }}
          danger={DANGER}
          dark={dark}
/>
      </ScrollView>
    </Col>
  );
}
