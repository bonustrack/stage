import '../lib/jsPolyfills';
import '../lib/cryptoShim';
import { StatusBar, setStatusBarStyle } from 'expo-status-bar';
import { useEffect } from 'react';
import { Spinner } from '@stage-labs/kit/react-native/spinner';
import { TopChrome } from '../components/system/TopChrome';
import { useAccountGate, useShellGates } from '../lib/accountGate';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { Platform, Text, TextInput } from 'react-native';
import { RootStack, currentRoute, rootStackScreenOptions, TABS_SCREEN_OPTIONS, useDocumentScrollRestore } from '../lib/navigation';
import { isBrowserExtension } from '../lib/extension';
import { usePathname } from 'expo-router';
import { isOnboardingRoute, isRestorableRoute } from '../components/tabs/pages';
import { useEffectiveColorScheme, usePalette } from '../lib/theme';
import { KitThemeProvider } from '@stage-labs/kit/react-native/theme-context';
import { bootKitFonts, useKitFontsLoaded } from '../lib/kitFonts';
import { LUMA_REC709, luminance, parseHex } from '@stage-labs/kit/color-math';
import { fontName } from '@stage-labs/kit/tokens';
import { useDeepLinks } from '../lib/deepLinks';
import { useRestoreGate } from '../lib/lastRoute';
import { usePushDeepLinks } from '../lib/pushNotify';
import { useOwnMailKey } from '../lib/mail';
import { bootMessaging, useMessagingBoot } from '../lib/messaging/boot';
import { QueryClientProvider } from '@tanstack/react-query';
import { getQueryClient } from '../lib/queryClient';
import { applyDocumentTheme, applyWebGlobalStyles } from '../components/layout/webChrome';
import { ContentFrame } from '../components/layout/ContentFrame';
import { installPlainTextCopy } from '../lib/plainCopy';
import { AlertHost } from '../components/system/AlertHost';
import { ToastHost } from '../components/system/ToastHost';
import { TooltipHost } from '../components/system/TooltipHost';
import { AddMembersHost } from '../components/channel/AddMembers';
import { ShareHost } from '../components/share/ShareHost';
import { KeyboardResync } from '../components/system/KeyboardResync';
import { CallHost } from '../components/call/CallHost';
import { OnboardingRouteReset } from '../components/system/OnboardingRouteReset';
import { SplitSidebar } from '../components/tabs/SplitSidebar';
import { ignored } from '../lib/errorPolicy';
import { useTabRole } from '../lib/tabLock';
import { TabStandby } from '../components/system/TabStandby';
import { Column, viewportFill } from '../components/layout';

const queryClient = getQueryClient();

applyWebGlobalStyles();
installPlainTextCopy();
bootKitFonts();
if (Platform.OS === 'web' && !isBrowserExtension() && !isOnboardingRoute(currentRoute('').replace(/\?.*$/, ''))) {
  void bootMessaging(true).catch(ignored(undefined, 'optional'));
}

(function applyDefaultFont(): void {
  const TextAny = Text as unknown as { defaultProps?: Record<string, unknown> };
  TextAny.defaultProps = TextAny.defaultProps ?? {};
  TextAny.defaultProps.style = [{ fontFamily: fontName.sans }, TextAny.defaultProps.style];
  TextAny.defaultProps.selectable = true;
  const TextInputAny = TextInput as unknown as { defaultProps?: Record<string, unknown> };
  TextInputAny.defaultProps = TextInputAny.defaultProps ?? {};
  TextInputAny.defaultProps.style = [{ fontFamily: fontName.sans }, TextInputAny.defaultProps.style];
})();

function isDarkBg(hex: string): boolean {
  const rgb = parseHex(hex, { bare: true });
  return rgb === null || luminance(rgb, LUMA_REC709) < 0.5;
}

function useDocumentTheme(ready: boolean, dark: boolean, background: string, scrollbarThumb: string): void {
  useEffect(() => {
    if (ready) applyDocumentTheme({ dark, background, scrollbarThumb });
  }, [ready, dark, background, scrollbarThumb]);
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
  useEffect(() => {
    setStatusBarStyle(barStyle, true);
  }, [barStyle]);

  useDeepLinks();
  useDocumentScrollRestore();

  const restore = useRestoreGate(isRestorableRoute);

  usePushDeepLinks();

  const onboarding = useAccountGate();
  const pathname = usePathname();

  useMessagingBoot(onboarding, !isOnboardingRoute(pathname));
  useOwnMailKey(onboarding.hasAccount);

  const loaded = useKitFontsLoaded();

  const gatesOpen = loaded && onboarding.ready && restore.ready;
  const shell = useShellGates(gatesOpen, onboarding.hasAccount);
  const routing = shell.showOnboarding && !isOnboardingRoute(pathname) && pathname !== '/';

  return (
    <QueryClientProvider client={queryClient}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <KeyboardProvider>
          <KeyboardResync />
          <StatusBar style={barStyle} />
          <ContentFrame>
            <RootStack detachInactiveScreens screenOptions={rootStackScreenOptions(bg)}>
              <RootStack.Screen name="(tabs)" options={TABS_SCREEN_OPTIONS} />
            </RootStack>
          </ContentFrame>
          <SplitSidebar visible={shell.sidebarVisible} />
          {!gatesOpen || routing ? (
            <Column surface="surface" align="center" justify="center" style={viewportFill()}>
              <Spinner size={28} color={dark ? '#ffffff' : '#000000'} />
            </Column>
          ) : null}
          <TopChrome decorated={gatesOpen && !shell.showOnboarding} />
          <ToastHost />
          <AlertHost />
          <TooltipHost />
          <AddMembersHost />
          <ShareHost active={shell.sidebarVisible} />
          <CallHost active={shell.sidebarVisible} />
          <OnboardingRouteReset ready={gatesOpen} showing={shell.showOnboarding} />
        </KeyboardProvider>
      </GestureHandlerRootView>
    </QueryClientProvider>
  );
}
