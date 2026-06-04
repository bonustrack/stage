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
import { GestureDetectorProvider } from 'react-native-screens/gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { NativeSwipeStack } from '../components/NativeSwipeStack';
import { EdgeSwipeBack } from '../components/EdgeSwipeBack';
import { useEffectiveColorScheme, usePalette, useRadius } from '../lib/theme';
import { useDeepLinks } from '../lib/deepLinks';
import { useRestoreLastRoute } from '../lib/lastRoute';
import { usePushDeepLinks } from '../lib/push';
import { ensureActiveAccount } from '../lib/xmtp';
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
  const { bg } = usePalette();
  // Wire the persisted button radius token into the kit Button default + repaint
  // the whole tree when it changes. Mounted at the root so it's always live.
  useRadius();

  /** Status-bar icons must follow the RENDERED chrome, not just the
   *  color-scheme pref. The app paints a near-black surface in dark mode and so
   *  needs LIGHT (white) icons. The previous `dark ? 'light' : 'dark'` showed
   *  dark, invisible icons whenever the OS was in light mode but pref='system'
   *  (→ useEffectiveColorScheme 'light') while the app still rendered a dark
   *  surface. Drive the style off the real palette bg luminance, and ALSO set it
   *  imperatively (effect below) because under Android edge-to-edge the
   *  declarative <StatusBar> can be shadowed by the native baseline on first
   *  paint. */
  const barStyle: 'light' | 'dark' = isDarkBg(bg) ? 'light' : 'dark';
  useEffect(() => { setStatusBarStyle(barStyle, true); }, [barStyle]);

  /** Universal/deep links → screen navigation. `getInitialURL` resolves async
   *  (after the Stack below has mounted) so cold-start taps land correctly; warm
   *  links navigate immediately. */
  useDeepLinks();

  /** Persist the active route on every navigation + restore it on a cold launch
   *  (return the user to the last screen). Coordinates with useDeepLinks: a
   *  cold-start deep link navigates first and the restore yields to it. */
  useRestoreLastRoute();

  /** Notification taps → open that conversation + clear its unread badge.
   *  Handles both cold-start (app launched by the tap) and warm/background
   *  taps. Installed once for the app's lifetime. */
  usePushDeepLinks();

  /** Mint the local EOA at boot, INDEPENDENT of XMTP. The wallet (Snapshot
   *  signing) + Railgun (usePrivateWallet → getActiveAccountId) must always have
   *  an account even when XMTP onboarding fails on a clean reinstall (stale db
   *  key vs. wiped store). Idempotent — no-ops once an account exists. */
  useEffect(() => { void ensureActiveAccount(); }, []);

  /** Calibre — matches sx-monorepo's typography. Two weights: medium (default) + semibold (headers/buttons).
   *  TTF (not WOFF2) so Android's native Typeface loader can pick it up — expo-font's WOFF2
   *  support is web-only. */
  const [loaded] = useFonts({
    'Calibre-Medium': require('../assets/fonts/Calibre-Medium-Custom.ttf'),
    'Calibre-Semibold': require('../assets/fonts/Calibre-Semibold-Custom.ttf'),
  });

  if (!loaded) {
    return (
      <Box style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: bg }}>
        <Spinner size={28} color={dark ? '#ffffff' : '#000000'} />
      </Box>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
    <WalletConnectProvider>
    <GestureHandlerRootView style={{ flex: 1 }}>
      {/** GestureDetectorProvider (react-native-screens/gesture-handler) wires the
       *   native-stack's interactive edge swipe-back into the RNGH gesture tree, so
       *   it arbitrates cleanly with the app's other RNGH gestures (MessengerBubble
       *   swipe-to-reply, scroll) rather than fighting a separate touch system.
       *   This is now safe because swipe-to-reply was migrated off PanResponder to
       *   RNGH (commit 1e3a0e3) — the two systems compose under one provider. */}
      <GestureDetectorProvider>
      <KeyboardProvider>
      <StatusBar style={barStyle} translucent backgroundColor="transparent" />
      {/** native-stack (via NativeSwipeStack/withLayoutContext).
       *
       *   SWIPE-BACK: handled by the JS <EdgeSwipeBack> wrapper (left-edge RNGH
       *   Pan → router.back()) for pushed screens, plus an in-screen <BackSwipe>
       *   on the conversation screen. We do NOT use rn-screens' own
       *   `goBackGesture`/`screenEdgeGesture` worklet: on Android (rn-screens
       *   4.16 + reanimated 4.3.1) its `onStart` worklet passes a mock animated
       *   ref to reanimated 4's `measure()`, which resolves the screen viewTag to
       *   `undefined` and crashes the first swipe with "Value is undefined,
       *   expected an Object" (redbox in ScreenGestureDetector.tsx measure()).
       *   The reanimated 3→4 `measure()` API change broke that mock-ref path. The
       *   JS Pan shims never touch view tags, so there's no crash and the native
       *   slide animation still composites the previous screen via the stock pop.
       *
       *   `statusBarStyle: barStyle` keeps white-on-dark status-bar icons; we also
       *   set it imperatively (effect above) + declaratively (<StatusBar>) so it
       *   survives navigation. */}
      <EdgeSwipeBack>
      <NativeSwipeStack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: bg },
          statusBarStyle: barStyle,
          /** Pushed routes slide in from the right; <EdgeSwipeBack> pops them
           *  (the slide-out reveals the previous screen). */
          animation: 'slide_from_right',
        }}
      >
        {/** Tab root: no slide animation (it's the bottom of the stack). */}
        <NativeSwipeStack.Screen
          name="(tabs)"
          options={{ animation: 'none' }}
        />
      </NativeSwipeStack>
      </EdgeSwipeBack>
      </KeyboardProvider>
      </GestureDetectorProvider>
    </GestureHandlerRootView>
    </WalletConnectProvider>
    </QueryClientProvider>
  );
}
