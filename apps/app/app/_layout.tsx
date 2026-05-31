/** WalletConnect/AppKit polyfills — must be the very first import in the app
 *  entry (sets up crypto/networking globals: TextEncoder, URL, btoa/atob, Buffer).
 *  These are CHEAP global installs (not the heavy WC SDK) and XMTP/viem on the
 *  critical path depend on them, so they stay eager. The expensive part of the
 *  WalletConnect stack (@reown/appkit + wagmi + viem provider + createAppKit) is
 *  deferred off the first-paint path — see components/WalletConnectProvider. */
import '@walletconnect/react-native-compat';
/** Hoisted side-effect import — installs the crypto.getRandomValues shim
 *  BEFORE any viem (and transitively any wallet/profile) module loads. */
import '../lib/cryptoShim';
import { StatusBar, setStatusBarStyle } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { useEffect } from 'react';
import { LogBox, Text, TextInput } from 'react-native';
import { Box } from '../components/layout';
import { Spinner } from '../components/Spinner';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { Stack } from 'expo-router';
import { useEffectiveColorScheme, usePalette } from '../lib/theme';
import { useDeepLinks } from '../lib/deepLinks';
import { usePushDeepLinks } from '../lib/push';
import { installPillAudioBridge } from '../lib/pill';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WalletConnectProvider } from '../components/WalletConnectProvider';

/** App-wide TanStack Query client — caches request/response data (profiles,
 *  message history) with stale-while-revalidate + dedup. Live XMTP streams stay
 *  outside Query (they're push, not fetch). */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 60_000, gcTime: 30 * 60_000, retry: 1, refetchOnWindowFocus: false },
  },
});

/** Silence WalletConnect's benign "emitting session_request … without any
 *  listeners" notice — a stale-session lifecycle log from @walletconnect/sign-client
 *  that surfaces as a red dev error toast but is harmless (and a no-op in release,
 *  where LogBox is disabled). */
LogBox.ignoreLogs([/emitting session_request/, /without any listeners/]);

/** Set Calibre-Medium as the app-wide default for Text + TextInput via defaultProps.
 *  This is a fallback — call-site `style={{…}}` overrides — but it's the safest path:
 *  monkey-patching the forwardRef render fn upstream broke FlatList.scrollToOffset on
 *  some Android versions (see git for details). Individual screens that want guaranteed
 *  Calibre should pin fontFamily explicitly. */
(function applyDefaultFont(): void {
  const TextAny = Text as unknown as { defaultProps?: Record<string, unknown> };
  TextAny.defaultProps = TextAny.defaultProps || {};
  TextAny.defaultProps.style = [{ fontFamily: 'Calibre-Medium' }, TextAny.defaultProps.style];
  TextAny.defaultProps.selectable = true;
  const TextInputAny = TextInput as unknown as { defaultProps?: Record<string, unknown> };
  TextInputAny.defaultProps = TextInputAny.defaultProps || {};
  TextInputAny.defaultProps.style = [{ fontFamily: 'Calibre-Medium' }, TextInputAny.defaultProps.style];
})();

/** Perceived-luminance check on a #rrggbb hex. < 0.5 → dark surface → needs
 *  light (white) status-bar icons. */
function isDarkBg(hex: string): boolean {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return true; // assume dark (app's default chrome) when unparseable
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 0xff, g = (n >> 8) & 0xff, b = n & 0xff;
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 < 0.5;
}

export default function RootLayout(): React.ReactElement {
  const dark = useEffectiveColorScheme() === 'dark';

  /** Status-bar icons must follow the RENDERED chrome, not just the
   *  color-scheme pref. The app paints a near-black surface in dark mode and so
   *  needs LIGHT (white) icons. The previous `dark ? 'light' : 'dark'` showed
   *  dark, invisible icons whenever the OS was in light mode but pref='system'
   *  (→ useEffectiveColorScheme 'light') while the app still rendered a dark
   *  surface. Drive the style off the real palette bg luminance, and ALSO set it
   *  imperatively (effect below) because under Android edge-to-edge the
   *  declarative <StatusBar> can be shadowed by the native baseline on first
   *  paint. */
  const barStyle: 'light' | 'dark' = isDarkBg(usePalette().bg) ? 'light' : 'dark';
  useEffect(() => { setStatusBarStyle(barStyle, true); }, [barStyle]);

  /** Universal/deep links → screen navigation. `getInitialURL` resolves async
   *  (after the Stack below has mounted) so cold-start taps land correctly; warm
   *  links navigate immediately. */
  useDeepLinks();

  /** Notification taps → open that conversation + clear its unread badge.
   *  Handles both cold-start (app launched by the tap) and warm/background
   *  taps. Installed once for the app's lifetime. */
  usePushDeepLinks();

  /** Wire the floating-pill's recorded-audio callback to the XMTP audio-send
   *  pipeline (→ daemon "Tony" DM). Idempotent + Android-only; no-op when the
   *  native module isn't linked. Installed once for the app's lifetime. */
  useEffect(() => installPillAudioBridge(), []);

  /** Calibre — matches sx-monorepo's typography. Two weights: medium (default) + semibold (headers/buttons).
   *  TTF (not WOFF2) so Android's native Typeface loader can pick it up — expo-font's WOFF2
   *  support is web-only. */
  const [loaded] = useFonts({
    'Calibre-Medium': require('../assets/fonts/Calibre-Medium-Custom.ttf'),
    'Calibre-Semibold': require('../assets/fonts/Calibre-Semibold-Custom.ttf'),
  });

  if (!loaded) {
    return (
      <Box style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: dark ? '#0e0f10' : '#ffffff' }}>
        <Spinner size={28} color={dark ? '#ffffff' : '#000000'} />
      </Box>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
    <WalletConnectProvider>
    <GestureHandlerRootView style={{ flex: 1 }}>
      <KeyboardProvider>
      <StatusBar style={barStyle} translucent backgroundColor="transparent" />
      {/** Plain expo-router <Stack> (→ @react-navigation/native-stack). The
       *   previous react-native-screens-own native-stack + GestureDetectorProvider
       *   interactive swipe-back was reverted: its root gesture layer was stealing
       *   the touch stream from the message-list FlatList vertical scroll and the
       *   MessengerBubble leftward swipe-to-reply PanResponder app-wide. Core chat
       *   (scroll + swipe-to-reply) takes priority over the fancy swipe-back.
       *
       *   `animation: 'none'` → instant transitions (the preferred feel).
       *   `statusBarStyle: barStyle` keeps the white-on-dark status-bar icons:
       *   @react-navigation/native-stack drives the rn-screens window trait from
       *   this per-screen option, and we also set it imperatively (effect above) +
       *   declaratively (<StatusBar> above) so it survives navigation.
       *
       *   No interactive swipe-back remains: iOS keeps its built-in edge swipe;
       *   Android is hardware-back only. */}
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: dark ? '#0e0f10' : '#ffffff' },
          statusBarStyle: barStyle,
          animation: 'none',
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>
      </KeyboardProvider>
    </GestureHandlerRootView>
    </WalletConnectProvider>
    </QueryClientProvider>
  );
}
