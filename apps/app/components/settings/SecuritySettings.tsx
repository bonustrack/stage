/** Settings → Security — "Export private key" + "Remove account" for the active
 *  account. Pure wrapper around the existing AccountSecuritySection: export
 *  reuses getPrivateKey behind a warning Alert (key never logged), remove reuses
 *  deleteAccount. No new key handling. */

import { ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Box } from '../layout';
import { useEffectiveColorScheme, usePalette } from '../../lib/theme';
import { AccountSecuritySection } from '../tabs/SettingsScreen.account';
import { SystemHeader } from '../system/SystemHeader';

export function SecuritySettings(): React.ReactElement {
  const dark = useEffectiveColorScheme() === 'dark';
  const { fg, head, sub, bg, border, rowBg } = usePalette();
  const insets = useSafeAreaInsets();

  return (
    <Box style={{ flex: 1, backgroundColor: bg, paddingTop: insets.top }}>
      <SystemHeader title="Security" dark={dark} fg={fg} head={head} border={border} />
      <ScrollView contentContainerStyle={{ paddingBottom: 32 + insets.bottom }}>
        <AccountSecuritySection
          c={{ fg, head, sub, border, rowBg }}
          danger={dark ? '#ff6b80' : '#b91c1c'}
        />
      </ScrollView>
    </Box>
  );
}
