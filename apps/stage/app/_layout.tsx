import '../lib/jsPolyfills';
import '../lib/cryptoShim';
import { StatusBar, setStatusBarStyle } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { useEffect } from 'react';
import { Text, TextInput } from '../components/layout/native';
import { Col, WebContentFrame, viewportFill } from '../components/layout';
import { Spinner } from '../components/Spinner';
import { TopChrome } from '../components/system/TopChrome';
import { useAccountGate } from '../lib/accountGate';
import { useShellGates } from '../lib/onboardingHold';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { Platform } from 'react-native';
import { RootStack, rootStackScreenOptions, TABS_SCREEN_OPTIONS } from '../lib/navigation/rootStack';
import { useDocumentScrollRestore } from '../lib/navigation/scrollRestore';
import { usePathname } from 'expo-router';
import { isOnboardingRoute } from '../components/onboarding/nextRoute.model';
import { useEffectiveColorScheme, usePalette, useRadius } from '../lib/theme';
import { KitThemeProvider } from '@stage-labs/kit/react-native/theme-context';
import { useDeepLinks } from '../lib/deepLinks';
import { useRestoreGate } from '../lib/lastRoute';
import { usePushDeepLinks } from '../lib/pushRegister';
import { ensureActiveAccount, ensureMessagingStreamSync } from '../modules/messaging';
import { QueryClientProvider } from '@tanstack/react-query';
import { getQueryClient } from '../lib/queryClient';
import { applyWebGlobalStyles } from '../platform/webStyles';
import { BuildInfoDot } from '../components/system/BuildInfoDot';
import { AlertHost } from '../components/system/AlertHost';
import { OnboardingRouteReset } from '../components/system/OnboardingRouteReset';
import { installAlertShim } from '../lib/alertShim';
import { SplitSidebar } from '../components/tabs/SplitSidebar';

const queryClient = getQueryClient();

applyWebGlobalStyles();
installAlertShim();

(function applyDefaultFont(): void {
  const TextAny = Text as unknown as { defaultProps?: Record<string, unknown> };
  TextAny.defaultProps = TextAny.defaultProps ?? {};
  TextAny.defaultProps.style = [{ fontFamily: 'Calibre-Medium' }, TextAny.defaultProps.style];
  TextAny.defaultProps.selectable = true;
  const TextInputAny = TextInput as unknown as { defaultProps?: Record<string, unknown> };
  TextInputAny.defaultProps = TextInputAny.defaultProps ?? {};
  TextInputAny.defaultProps.style = [{ fontFamily: 'Calibre-Medium' }, TextInputAny.defaultProps.style];
})();

function isDarkBg(hex: string): boolean {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  const hexDigits = m?.[1];
  if (hexDigits === undefined) return true;
  const n = parseInt(hexDigits, 16);
  const r = (n >> 16) & 0xff, g = (n >> 8) & 0xff, b = n & 0xff;
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 < 0.5;
}

export default function RootLayout(): React.ReactElement {
  const scheme = useEffectiveColorScheme();
  const palette = usePalette();
  return (
    <KitThemeProvider value={palette} scheme={scheme}>
      <RootLayoutInner />
    </KitThemeProvider>
  );
}

function RootLayoutInner(): React.ReactElement {
  const dark = useEffectiveColorScheme() === 'dark';
  const { bg, toolbarBg } = usePalette();
  useRadius();

  const barStyle: 'light' | 'dark' = isDarkBg(toolbarBg) ? 'light' : 'dark';
  useEffect(() => { setStatusBarStyle(barStyle, true); }, [barStyle]);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
  }, [dark]);

  useDeepLinks();
  useDocumentScrollRestore();

  const restore = useRestoreGate();

  usePushDeepLinks();

  const onboarding = useAccountGate();

  useEffect(() => { if (onboarding.hasAccount) void ensureActiveAccount(); }, [onboarding.hasAccount]);
  useEffect(() => { ensureMessagingStreamSync(); }, []);

  const [loaded] = useFonts({
    'Calibre-Medium': require('../assets/fonts/Calibre-Medium-Custom.ttf') as number,
    'Calibre-Semibold': require('../assets/fonts/Calibre-Semibold-Custom.ttf') as number,
  });

  const gatesOpen = loaded && onboarding.ready && restore.ready;
  const shell = useShellGates(gatesOpen, onboarding.hasAccount);
  const pathname = usePathname();
  const routing = shell.showOnboarding && !isOnboardingRoute(pathname) && pathname !== '/';

  return (
    <QueryClientProvider client={queryClient}>
    <GestureHandlerRootView style={{ flex: 1 }}>
      <KeyboardProvider>
      <StatusBar style={barStyle} translucent backgroundColor="transparent"/>
      <WebContentFrame>
      <RootStack detachInactiveScreens screenOptions={rootStackScreenOptions(bg)}>
        <RootStack.Screen name="(tabs)" options={TABS_SCREEN_OPTIONS}/>
      </RootStack>
      </WebContentFrame>
      <SplitSidebar visible={shell.sidebarVisible}/>
      {!gatesOpen || routing ? (
        <Col surface="surface" align="center" justify="center" style={viewportFill()}>
          <Spinner size={28} color={dark ? '#ffffff' : '#000000'}/>
        </Col>
      ) : null}
      <TopChrome decorated={gatesOpen && !shell.showOnboarding} />
      <BuildInfoDot />
      <AlertHost />
      <OnboardingRouteReset ready={gatesOpen} showing={shell.showOnboarding} />
      </KeyboardProvider>
    </GestureHandlerRootView>
    </QueryClientProvider>
  );
}
