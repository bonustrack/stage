import '../lib/jsPolyfills';
import '../lib/cryptoShim';
import { StatusBar, setStatusBarStyle } from 'expo-status-bar';
import { loadAsync, useFonts } from 'expo-font';
import { useEffect } from 'react';
import { Text, TextInput } from '../components/layout/native';
import { Col, WebContentFrame, viewportFill } from '../components/layout';
import { Spinner } from '../components/Spinner';
import { TopChrome } from '../components/system/TopChrome';
import { useAccountGate, useShellGates } from '../lib/accountGate';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { LogBox, Platform } from 'react-native';
import { BOARD_SCREEN_OPTIONS, RootStack, rootStackScreenOptions, TABS_SCREEN_OPTIONS } from '../lib/navigation/rootStack';
import { useDocumentScrollRestore } from '../lib/navigation/scrollRestore';
import { usePathname, useRouter } from 'expo-router';
import { isOnboardingRoute } from '../components/onboarding/nextRoute.model';
import { useEffectiveColorScheme, usePalette } from '../lib/theme';
import { KitThemeProvider } from '@stage-labs/kit/react-native/theme-context';
import { useDeepLinks } from '../lib/deepLinks';
import { useRestoreGate } from '../lib/lastRoute';
import { usePushDeepLinks } from '../lib/pushRegister';
import { ensureActiveAccount, ensureMessagingStreamSync, getOrCreateXmtpClient } from '../modules/messaging';
import { QueryClientProvider } from '@tanstack/react-query';
import { getQueryClient } from '../lib/queryClient';
import { applyWebGlobalStyles } from '../platform/webStyles';
import { BuildInfoDot } from '../components/system/BuildInfoDot';
import { AlertHost } from '../components/system/AlertHost';
import { ToastHost } from '../components/system/ToastHost';
import { TooltipHost } from '../components/system/TooltipHost';
import { OnboardingRouteReset } from '../components/system/OnboardingRouteReset';
import { installAlertShim } from '../lib/alertHost';
import { SplitSidebar } from '../components/tabs/SplitSidebar';
import { reported } from '../lib/errorPolicy';

const queryClient = getQueryClient();

const APP_FONTS = {
  'Calibre-Medium': require('../assets/fonts/Calibre-Medium-Custom.ttf') as number,
  'Calibre-Semibold': require('../assets/fonts/Calibre-Semibold-Custom.ttf') as number,
};

LogBox.ignoreAllLogs();
applyWebGlobalStyles();
installAlertShim();
void loadAsync(APP_FONTS).catch(reported('boot.fonts'));

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

  const barStyle: 'light' | 'dark' = isDarkBg(toolbarBg) ? 'light' : 'dark';
  useEffect(() => { setStatusBarStyle(barStyle, true); }, [barStyle]);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const root = document.documentElement;
    root.style.colorScheme = dark ? 'dark' : 'light';
    root.style.backgroundColor = bg;
    document.getElementById('stage-boot')?.remove();
  }, [dark, bg]);

  useDeepLinks();
  useDocumentScrollRestore();

  const restore = useRestoreGate();

  usePushDeepLinks();

  const onboarding = useAccountGate();
  const pathname = usePathname();

  useEffect(() => {
    if (!onboarding.hasAccount) return;
    void ensureActiveAccount()
      .then(() => (isOnboardingRoute(pathname) ? undefined : getOrCreateXmtpClient('production')))
      .catch(reported('boot.client'));
  }, [onboarding.hasAccount]);
  useEffect(() => { ensureMessagingStreamSync(); }, []);

  const [loaded] = useFonts(APP_FONTS);

  const gatesOpen = loaded && onboarding.ready && restore.ready;
  const shell = useShellGates(gatesOpen, onboarding.hasAccount);
  const reproRouter = useRouter();
  useEffect(() => {
    if (!gatesOpen) return;
    const t = setTimeout(() => { reproRouter.push('/board'); }, 3000);
    return () => { clearTimeout(t); };
  }, [gatesOpen]);
  const routing = shell.showOnboarding && !isOnboardingRoute(pathname) && pathname !== '/';

  return (
    <QueryClientProvider client={queryClient}>
    <GestureHandlerRootView style={{ flex: 1 }}>
      <KeyboardProvider>
      <StatusBar style={barStyle} translucent backgroundColor="transparent"/>
      <WebContentFrame>
      <RootStack detachInactiveScreens screenOptions={rootStackScreenOptions(bg)}>
        <RootStack.Screen name="(tabs)" options={TABS_SCREEN_OPTIONS}/>
        <RootStack.Screen name="board" options={BOARD_SCREEN_OPTIONS}/>
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
      <ToastHost />
      <AlertHost />
      <TooltipHost />
      <OnboardingRouteReset ready={gatesOpen} showing={shell.showOnboarding} />
      </KeyboardProvider>
    </GestureHandlerRootView>
    </QueryClientProvider>
  );
}
