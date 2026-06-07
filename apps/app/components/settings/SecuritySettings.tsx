/** Settings → Security — "Export private key" + "Remove account" for the active
 *  account. Pure wrapper around the existing AccountSecuritySection: export
 *  reuses getPrivateKey behind a warning Alert (key never logged), remove reuses
 *  deleteAccount. No new key handling. */

import { ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Box } from '../layout';
import { DANGER, useEffectiveColorScheme, usePalette } from '../../lib/theme';
import { AccountSecuritySection } from '../tabs/SettingsScreen.account';
import { SystemHeader } from '../system/SystemHeader';

export function SecuritySettings(): React.ReactElement {
  const dark = useEffectiveColorScheme() === 'dark';
  const { text: fg, link: head, bg, border } = usePalette();
  const sub = fg;
  const rowBg = border;
  const insets = useSafeAreaInsets();

  return (
    <Box style={{ flex: 1, backgroundColor: bg }}>
      <SystemHeader title="Security" dark={dark} fg={fg} head={head} border={border} />
      <ScrollView contentContainerStyle={{ paddingBottom: 32 + insets.bottom }}>
        <AccountSecuritySection
          c={{ fg, head, sub, border, rowBg }}
          danger={DANGER}
          dark={dark}
        />
      </ScrollView>
    </Box>
  );
}
