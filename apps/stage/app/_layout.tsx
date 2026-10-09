import '../lib/jsPolyfills';
import '../lib/cryptoShim';
import { StatusBar, setStatusBarStyle } from 'expo-status-bar';
import { loadAsync, useFonts } from 'expo-font';
import { useEffect } from 'react';
import { Col, PANE_LEFT_PAD, viewportFill } from '../components/layout';
import { Spinner } from '@stage-labs/kit/react-native/spinner';
import { TopChrome } from '../components/system/TopChrome';
import { useAccountGate, useShellGates } from '../lib/accountGate';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { Platform, Text, TextInput } from 'react-native';
import {
  RootStack, rootStackScreenOptions, TABS_SCREEN_OPTIONS, useDocumentScrollRestore,
} from '../lib/navigation';
import { usePathname } from 'expo-router';
import { isOnboardingRoute } from '../components/onboarding/nextRoute.model';
import { useEffectiveColorScheme, usePalette } from '../lib/theme';
import { KitThemeProvider } from '@stage-labs/kit/react-native/theme-context';
import { parseHex } from '@stage-labs/kit/theme-derive';
import { useDeepLinks } from '../lib/deepLinks';
import { useRestoreGate } from '../lib/lastRoute';
import { usePushDeepLinks } from '../lib/pushRegister';
import { ensureActiveAccount } from '../lib/xmtp.recover.core';
import { useOwnMailKey } from '../lib/mailKey';
import { ensureMessagingStreamSync } from '../modules/messaging/streamSync';
import { getOrCreateXmtpClient } from '../lib/xmtp.client';
import { QueryClientProvider } from '@tanstack/react-query';
import { getQueryClient } from '../lib/queryClient';
import { applyWebGlobalStyles } from '../platform/webStyles';
import { installPlainTextCopy } from '../lib/plainCopy';
import { AlertHost } from '../components/system/AlertHost';
import { ToastHost } from '../components/system/ToastHost';
import { TooltipHost } from '../components/system/TooltipHost';
import { AddMembersHost } from '../components/channel/AddMembers';
import { KeyboardResync } from '../components/system/KeyboardResync';
import { CallHost } from '../components/call/CallHost';
import { OnboardingRouteReset } from '../components/system/OnboardingRouteReset';
import { installAlertShim } from '../lib/alertHost';
import { SplitSidebar } from '../components/tabs/SplitSidebar';
import { ignored, reported } from '../lib/errorPolicy';
import { useTabRole } from '../lib/tabLock';
import { TabStandby } from '../components/system/TabStandby';

const queryClient = getQueryClient();

const APP_FONTS = {
  'Calibre-Medium': require('../assets/fonts/Calibre-Medium-Custom.ttf') as number,
  'Calibre-Semibold': require('../assets/fonts/Calibre-Semibold-Custom.ttf') as number,
};

applyWebGlobalStyles();
installPlainTextCopy();
installAlertShim();
void loadAsync(APP_FONTS).catch(reported('boot.fonts'));
if (Platform.OS === 'web' && location.protocol !== 'chrome-extension:' && !isOnboardingRoute(location.hash.slice(1).replace(/\?.*$/, ''))) {
  void ensureActiveAccount().then(() => getOrCreateXmtpClient('production')).catch(ignored(undefined, 'optional'));
}

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
  const rgb = parseHex(hex.trim().replace(/^#?/, '#'));
  if (rgb === null) return true;
  const [r, g, b] = rgb;
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 < 0.5;
}

function WebContentFrame({ children }: { children: React.ReactNode }): React.ReactElement {
  if (Platform.OS !== 'web') return <>{children}</>;
  return (
    <Col surface="surface" flex={1} width="100%" style={PANE_LEFT_PAD}>
      {children}
    </Col>
  );
}

function useDocumentTheme(ready: boolean, dark: boolean, bg: string, sub: string): void {
  useEffect(() => {
    if (!ready || Platform.OS !== 'web' || typeof document === 'undefined') return;
    const root = document.documentElement;
    root.style.colorScheme = dark ? 'dark' : 'light';
    root.style.backgroundColor = bg;
    root.style.setProperty('--stage-scrollbar-thumb', sub);
    document.getElementById('stage-boot')?.remove();
  }, [ready, dark, bg, sub]);
}

export default function RootLayout(): React.ReactElement {
  const scheme = useEffectiveColorScheme();
  const palette = usePalette();
  const tab = useTabRole();
  useDocumentTheme(tab !== 'pending', scheme === 'dark', palette.bg, palette.sub);
  return (
    <KitThemeProvider value={palette} scheme={scheme}>
      {tab === 'active' ? <RootLayoutInner /> : null}
      {tab === 'standby' ? <TabStandby /> : null}
    </KitThemeProvider>
  );
}

function RootLayoutInner(): React.ReactElement {
  const dark = useEffectiveColorScheme() === 'dark';
  const { bg, toolbarBg } = usePalette();

  const barStyle: 'light' | 'dark' = isDarkBg(toolbarBg) ? 'light' : 'dark';
  useEffect(() => { setStatusBarStyle(barStyle, true); }, [barStyle]);

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
  useOwnMailKey(onboarding.hasAccount);

  const [loaded] = useFonts(APP_FONTS);

  const gatesOpen = loaded && onboarding.ready && restore.ready;
  const shell = useShellGates(gatesOpen, onboarding.hasAccount);
  const routing = shell.showOnboarding && !isOnboardingRoute(pathname) && pathname !== '/';

  return (
    <QueryClientProvider client={queryClient}>
    <GestureHandlerRootView style={{ flex: 1 }}>
      <KeyboardProvider>
      <KeyboardResync/>
      <StatusBar style={barStyle}/>
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
      <ToastHost />
      <AlertHost />
      <TooltipHost />
      <AddMembersHost />
      <CallHost active={shell.sidebarVisible} />
      <OnboardingRouteReset ready={gatesOpen} showing={shell.showOnboarding} />
      </KeyboardProvider>
    </GestureHandlerRootView>
    </QueryClientProvider>
  );
}
