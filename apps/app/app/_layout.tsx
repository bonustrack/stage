/** @file Root expo-router layout that installs JS polyfills/crypto shims, mounts global providers (Query, theme, gestures, keyboard), and gates the app behind the account/onboarding flow. */
import '../lib/jsPolyfills';
/** Hoisted side-effect import — installs the crypto.getRandomValues shim BEFORE any viem (and transitively any wallet/profile) module loads. */
import '../lib/cryptoShim';
import { StatusBar, setStatusBarStyle } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { useEffect } from 'react';
import { Text } from 'react-native';
/** Raw TextInput (via the sanctioned layout/native escape hatch) so defaultProps can set the app-wide default font on the RN primitive Kit Input wraps. */
import { TextInput } from '../components/layout/native';
import { Col } from '../components/layout';
import { Spinner } from '../components/Spinner';
import { Onboarding } from '../components/onboarding/Onboarding';
import { useAccountGate } from '../lib/accountGate';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { TransitionPresets, TransitionSpecs } from '@react-navigation/stack';
import { NativeSwipeStack } from '../components/NativeSwipeStack';
import { useEffectiveColorScheme, usePalette, useRadius } from '../lib/theme';
import { KitThemeProvider } from '@metro-labs/kit/theme-context';
import { useDeepLinks } from '../lib/deepLinks';
import { useRestoreGate } from '../lib/lastRoute';
import { usePushDeepLinks } from '../lib/push';
import { ensureActiveAccount, ensureMessagingStreamSync } from '../modules/messaging';
import { QueryClientProvider } from '@tanstack/react-query';
import { getQueryClient } from '../lib/queryClient';

/** App-wide TanStack Query client (stale-while-revalidate + dedup) shared with non-React stream wiring; live XMTP streams stay outside Query. */
const queryClient = getQueryClient();

/** Sets Calibre-Medium as the app-wide Text + TextInput default via defaultProps (overridable per call-site); safer than monkey-patching forwardRef, which broke FlatList.scrollToOffset on some Android versions. */
(function applyDefaultFont(): void {
  const TextAny = Text as unknown as { defaultProps?: Record<string, unknown> };
  TextAny.defaultProps = TextAny.defaultProps ?? {};
  TextAny.defaultProps.style = [{ fontFamily: 'Calibre-Medium' }, TextAny.defaultProps.style];
  TextAny.defaultProps.selectable = true;
  const TextInputAny = TextInput as unknown as { defaultProps?: Record<string, unknown> };
  TextInputAny.defaultProps = TextInputAny.defaultProps ?? {};
  TextInputAny.defaultProps.style = [{ fontFamily: 'Calibre-Medium' }, TextInputAny.defaultProps.style];
})();

/** Perceived-luminance check on a #rrggbb hex. < 0.5 → dark surface → needs light (white) status-bar icons. */
function isDarkBg(hex: string): boolean {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  const hexDigits = m?.[1];
  if (hexDigits === undefined) return true; /** assume dark (app's default chrome) when unparseable */
  const n = parseInt(hexDigits, 16);
  const r = (n >> 16) & 0xff, g = (n >> 8) & 0xff, b = n & 0xff;
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 < 0.5;
}

/** Theme-native root: mounts the Kit theme provider once off the same usePalette() source so every Kit primitive below resolves colours by role from the live palette. */
export default function RootLayout(): React.ReactElement {
  const scheme = useEffectiveColorScheme();
  const palette = usePalette();
  return (
    <KitThemeProvider value={palette} scheme={scheme}>
      <RootLayoutInner />
    </KitThemeProvider>
  );
}

/** The Root Layout Inner component. */
function RootLayoutInner(): React.ReactElement {
  const dark = useEffectiveColorScheme() === 'dark';
  const { bg, toolbarBg } = usePalette();
  /** Wires the persisted button radius token into the Kit Button default and repaints the tree on change; mounted at root so it's always live. */
  useRadius();

  /** Status-bar icon style follows the rendered chrome (toolbarBg luminance), not just the scheme pref, and is also set imperatively below because Android edge-to-edge can shadow the declarative <StatusBar> on first paint. */
  const barStyle: 'light' | 'dark' = isDarkBg(toolbarBg) ? 'light' : 'dark';
  useEffect(() => { setStatusBarStyle(barStyle, true); }, [barStyle]);

  /** Universal/deep links → screen navigation. `getInitialURL` resolves async (after the Stack below has mounted) so cold-start taps land correctly; warm links navigate immediately. */
  useDeepLinks();

  /** Persists the active route and restores it on cold launch without flashing Home (restore.ready gates the boot spinner); a recognised cold-start deep link wins over the restore. */
  const restore = useRestoreGate();

  /** Notification taps → open that conversation + clear its unread badge. Handles both cold-start (app launched by the tap) and warm/background taps. Installed once for the app's lifetime. */
  usePushDeepLinks();

  /** First-launch gate: on a clean install the onboarding flow is the primary entry (creates the mnemonic + ZeroDev account); `ready` gates on the registry load so a returning user never flashes onboarding. */
  const onboarding = useAccountGate();

  /** Once an account EXISTS, make sure messaging/wallet are wired (idempotent — this no longer creates an account, it only revalidates an existing one so a clean reinstall with a stale db key self-heals into the recoverable Home). */
  useEffect(() => { if (onboarding.hasAccount) void ensureActiveAccount(); }, [onboarding.hasAccount]);
  /** Wire streamed group-metadata events into Query (invalidate convMeta) so the topnav / group screen refresh on rename/image/desc without a reload. */
  useEffect(() => { ensureMessagingStreamSync(); }, []);

  /** Calibre — matches sx-monorepo's typography. Two weights: medium (default) + semibold (headers/buttons). TTF (not WOFF2) so Android's native Typeface loader can pick it up — expo-font's WOFF2 support is web-only. */
  const [loaded] = useFonts({
    'Calibre-Medium': require('../assets/fonts/Calibre-Medium-Custom.ttf') as number,
    'Calibre-Semibold': require('../assets/fonts/Calibre-Semibold-Custom.ttf') as number,
  });

  const gatesOpen = loaded && onboarding.ready && restore.ready;

  /** Identity-stable root: the providers + navigator render on every commit (no element-type-swapping early return) so the card stack mounts exactly once; boot spinner/onboarding render as an opaque overlay gated on `gatesOpen` so Home never flashes. */
  return (
    <QueryClientProvider client={queryClient}>
    <GestureHandlerRootView style={{ flex: 1 }}>
      <KeyboardProvider>
      <StatusBar style={barStyle} translucent backgroundColor="transparent"/>
      {/** @react-navigation/stack JS card stack whose gestureEnabled pan + SlideFromRightIOS preset finger-follow the swipe-back (pure JS/RNGH/reanimated); arms only on a rightward drag so the leftward reply-swipe coexists. */}
      <NativeSwipeStack
        /** Perf: detachInactiveScreens + freezeOnBlur suspend the off-screen blurred card's renders/effects; the swipe-back reveal survives because a transitioning card is live, freeze only kicks in once settled off-screen. */
        detachInactiveScreens
        screenOptions={{
          headerShown: false,
          freezeOnBlur: true,
          cardStyle: { backgroundColor: bg },
          gestureEnabled: true,
          /** Full-width back-swipe: a rightward horizontal drag arms the pop from ANYWHERE (9999 > any screen width). gestureDirection stays 'horizontal' so vertical scroll + the LEFTWARD reply-swipe still win on their axes. */
          gestureResponseDistance: 9999,
          ...TransitionPresets.SlideFromRightIOS,
          /** Instant push + interactive swipe-back reveal: keep the SlideFromRightIOS preset/gestureEnabled (not `animation:'none'`, which kills the gesture in v7) and override only transitionSpec — 0ms `open` for instant push, iOS spring `close` for smooth swipe-back. */
          transitionSpec: {
            open: { animation: 'timing', config: { duration: 0 } },
            close: TransitionSpecs.TransitionIOSSpec,
          },
        }}
>
        {/** Tab root: no transition (it's the bottom of the stack). */}
        <NativeSwipeStack.Screen
          name="(tabs)"
          options={{ animationEnabled: false, gestureEnabled: false }}
/>
      </NativeSwipeStack>
      {/** Boot/onboarding overlay: an opaque absolute-fill layer over the live navigator (not a replacement) so the tab root stays hidden until ready — no Home flash and the card stack keeps its single mount. */}
      {!gatesOpen ? (
        <Col
          surface="surface" align="center" justify="center"
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
>
          <Spinner size={28} color={dark ? '#ffffff' : '#000000'}/>
        </Col>
      ) : !onboarding.hasAccount ? (
        <Col
          surface="surface"
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
>
          {/** onDone is a no-op safety net — the flow flips the hasAccount gate by creating an account itself. */}
          <Onboarding onDone={() => undefined} />
        </Col>
      ) : null}
      </KeyboardProvider>
    </GestureHandlerRootView>
    </QueryClientProvider>
  );
}
