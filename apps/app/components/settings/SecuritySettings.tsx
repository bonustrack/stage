
import { Scroll as ScrollView } from '@stage-labs/kit/react-native/scroll';
import { KitRenderer } from '@stage-labs/kit/react-native/kit-renderer';
import type { WidgetActionRegistry } from '@stage-labs/kit/kit';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Col } from '../layout';
import { settingsHeader, SCREEN_BACK } from '@stage-labs/views';
import { DANGER, useEffectiveColorScheme, usePalette } from '../../lib/theme';
import { AccountSecuritySection } from '../tabs/SettingsScreen.account';
import { SecureWalletNudge } from '../onboarding/SecureWalletNudge';

export function SecuritySettings(): React.ReactElement {
  const router = useRouter();
  const dark = useEffectiveColorScheme() === 'dark';
  const { text: fg, link: head, border, toolbarBg } = usePalette();
  const sub = fg;
  const rowBg = border;
  const insets = useSafeAreaInsets();

  const headerNode = settingsHeader({
    title: 'Security',
    backColor: fg,
    titleColor: head,
    surface: toolbarBg,
    borderColor: border,
    safeTop: insets.top,
  });
  const registry: WidgetActionRegistry = {
    [SCREEN_BACK]: () => { router.back(); },
  };

  return (
    <Col surface="surface" flex={1}>
      <KitRenderer node={headerNode} registry={registry}/>
      <ScrollView contentContainerStyle={{ paddingBottom: 32 + insets.bottom }}>
        <SecureWalletNudge/>
        <AccountSecuritySection
          c={{ fg, head, sub, border, rowBg }}
          danger={DANGER}
          dark={dark}
/>
      </ScrollView>
    </Col>
  );
}
