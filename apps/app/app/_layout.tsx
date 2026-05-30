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
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { useEffect } from 'react';
import { LogBox, Text, TextInput } from 'react-native';
import { Box } from '../components/layout';
import { Spinner } from '../components/Spinner';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { GestureDetectorProvider } from 'react-native-screens/gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { NativeSwipeStack } from '../components/NativeSwipeStack';
import { useEffectiveColorScheme } from '../lib/theme';
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

export default function RootLayout(): React.ReactElement {
  const dark = useEffectiveColorScheme() === 'dark';

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
      {/** GestureDetectorProvider powers react-native-screens' reanimated-driven
       *   interactive swipe-back (`goBackGesture`). It must wrap the navigator. */}
      <GestureDetectorProvider>
      <KeyboardProvider>
      <StatusBar style={dark ? 'light' : 'dark'} />
      {/** TRUE interactive swipe-back. expo-router's default `<Stack>` renders
       *   through @react-navigation/native-stack 7.x, which does NOT wire
       *   react-native-screens' `goBackGesture`/`screenEdgeGesture` — so there's
       *   no finger-tracking pop on Android (react-navigation#6893, #7947) and
       *   only iOS' built-in edge swipe. react-native-screens ships its OWN
       *   native-stack that DOES support those options (reanimated worklet, works
       *   on both platforms under Fabric/new-arch — which this app enables). We
       *   graft it onto expo-router via `withLayoutContext` (see
       *   components/NativeSwipeStack), keeping file-based routing intact and
       *   swapping only the navigator implementation. This replaces the previous
       *   JS <EdgeSwipeBack> shim.
       *
       *   `goBackGesture: 'swipeRight'` auto-selects `ScreenTransition.SwipeRight`,
       *   so the previous page parallaxes in underneath the finger. We scope it to
       *   a left-edge zone (`screenEdgeGesture: true`) so it never fights the
       *   leftward swipe-to-reply pan on message bubbles. */}
      <NativeSwipeStack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: dark ? '#0e0f10' : '#ffffff' },
        }}
      >
        {/** Root tab group: no back-gesture (stack root — nothing to pop to). */}
        <NativeSwipeStack.Screen
          name="(tabs)"
          options={{ headerShown: false, stackAnimation: 'none' }}
        />
        <NativeSwipeStack.Screen
          name="xmtp/[convId]"
          options={{
            stackAnimation: 'slide_from_right',
            goBackGesture: 'swipeRight',
            screenEdgeGesture: true,
          }}
        />
        <NativeSwipeStack.Screen
          name="accounts"
          options={{
            stackAnimation: 'slide_from_right',
            goBackGesture: 'swipeRight',
            screenEdgeGesture: true,
          }}
        />
      </NativeSwipeStack>
      </KeyboardProvider>
      </GestureDetectorProvider>
    </GestureHandlerRootView>
    </WalletConnectProvider>
    </QueryClientProvider>
  );
}
