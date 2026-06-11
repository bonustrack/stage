/** WalletConnect/AppKit polyfills — must be the very first import in the app
 *  entry (sets up crypto/networking globals: TextEncoder, URL, btoa/atob, Buffer).
 *  These are CHEAP global installs (not the heavy WC SDK) and XMTP/viem on the
 *  critical path depend on them, so they stay eager. The expensive part of the
 *  WalletConnect stack (@reown/appkit + wagmi + viem provider + createAppKit) is
 *  deferred off the first-paint path — see components/WalletConnectProvider. */
/** ES2023 Array polyfills (toReversed/toSorted) for the release Hermes engine —
 *  must run before any dependency that calls them. See lib/jsPolyfills. */
import '../lib/jsPolyfills';
import '@walletconnect/react-native-compat';
/** Hoisted side-effect import — installs the crypto.getRandomValues shim
 *  BEFORE any viem (and transitively any wallet/profile) module loads. */
import '../lib/cryptoShim';
import { StatusBar, setStatusBarStyle } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { useEffect } from 'react';
// eslint-disable-next-line no-restricted-imports -- raw TextInput required: this sets TextInput.defaultProps app-wide for the default font (Kit Input wraps TextInput, so the global default must target the RN primitive itself).
import { LogBox, Text, TextInput } from 'react-native';
import { Col } from '../components/layout';
import { Spinner } from '../components/Spinner';
import { Onboarding } from '../components/onboarding/Onboarding';
import { useOnboardingGate } from '../lib/onboardingSeen';
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
import { initStageUsernames } from '../lib/stageUsernames';
import { QueryClientProvider } from '@tanstack/react-query';
import { getQueryClient } from '../lib/queryClient';
import { WalletConnectProvider } from '../components/WalletConnectProvider';

/** App-wide TanStack Query client: caches request/response data (profiles,
 *  message history) with stale-while-revalidate + dedup. Live XMTP streams stay
 *  outside Query (they're push, not fetch). The instance lives in lib/queryClient
 *  so non-React code (stream wiring) writes the SAME cache. */
const queryClient = getQueryClient();

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

/** THEME-NATIVE root: mount the Kit theme provider ONCE here (alongside the
 *  existing useRadius/useOverridesVersion wiring) so every Kit primitive below
 *  resolves its colours by role from the live palette. Reuses the SAME
 *  usePalette() global-variable source (overrides included) - no fork. */
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
  // Wire the persisted button radius token into the kit Button default + repaint
  // the whole tree when it changes. Mounted at the root so it's always live.
  useRadius();

  /** Status-bar icons must follow the RENDERED chrome, not just the
   *  color-scheme pref. The app paints a near-black surface in dark mode and so
   *  needs LIGHT (white) icons. The previous `dark ? 'light' : 'dark'` showed
   *  dark, invisible icons whenever the OS was in light mode but pref='system'
   *  (→ useEffectiveColorScheme 'light') while the app still rendered a dark
   *  surface. The status-bar inset now renders `toolbarBg` (the nav fill extends
   *  to the top edge), so drive the icon style off toolbarBg luminance, and ALSO
   *  set it imperatively (effect below) because under Android edge-to-edge the
   *  declarative <StatusBar> can be shadowed by the native baseline on first
   *  paint. */
  const barStyle: 'light' | 'dark' = isDarkBg(toolbarBg) ? 'light' : 'dark';
  useEffect(() => { setStatusBarStyle(barStyle, true); }, [barStyle]);

  /** Universal/deep links → screen navigation. `getInitialURL` resolves async
   *  (after the Stack below has mounted) so cold-start taps land correctly; warm
   *  links navigate immediately. */
  useDeepLinks();

  /** Persist the active route on every navigation + restore it on a cold launch
   *  (return the user to the last screen) WITHOUT flashing Home: `restore.ready`
   *  gates the boot spinner below until the saved-route load resolves, so the
   *  Stack (and Home) never mount before the restore decision is known.
   *  Coordinates with useDeepLinks: a recognised cold-start deep link wins and
   *  the restore yields to it. */
  const restore = useRestoreGate();

  /** Notification taps → open that conversation + clear its unread badge.
   *  Handles both cold-start (app launched by the tap) and warm/background
   *  taps. Installed once for the app's lifetime. */
  usePushDeepLinks();

  /** Mint the local EOA at boot, INDEPENDENT of XMTP. The wallet (Snapshot
   *  signing) + Railgun (usePrivateWallet → getActiveAccountId) must always have
   *  an account even when XMTP onboarding fails on a clean reinstall (stale db
   *  key vs. wiped store). Idempotent — no-ops once an account exists. */
  useEffect(() => { void ensureActiveAccount(); }, []);
  /** Wire streamed group-metadata events into Query (invalidate convMeta) so the
   *  topnav / group screen refresh on rename/image/desc without a reload. */
  useEffect(() => { ensureMessagingStreamSync(); }, []);
  /** Prefer claimed `<name>.stage.box` usernames over ENS in every name render. */
  useEffect(() => { initStageUsernames(); }, []);

  /** Calibre — matches sx-monorepo's typography. Two weights: medium (default) + semibold (headers/buttons).
   *  TTF (not WOFF2) so Android's native Typeface loader can pick it up — expo-font's WOFF2
   *  support is web-only. */
  const [loaded] = useFonts({
    'Calibre-Medium': require('../assets/fonts/Calibre-Medium-Custom.ttf'),
    'Calibre-Semibold': require('../assets/fonts/Calibre-Semibold-Custom.ttf'),
  });

  /** FIRST-LAUNCH GATE: render Onboarding INSTEAD of the app until the persisted
   *  `onboarding.seen` flag is true; `ready` gates on its load so a returning
   *  user never flashes onboarding (see lib/onboardingSeen). */
  const onboarding = useOnboardingGate();
  const gatesOpen = loaded && onboarding.ready && restore.ready;

  /** IDENTITY-STABLE ROOT: the providers + navigator subtree below renders on
   *  EVERY commit (no conditional early-return that swaps the root element type),
   *  so `NativeSwipeStack` — and the whole @react-navigation card stack inside it
   *  — mounts EXACTLY ONCE per process and is never torn down + rebuilt as the
   *  boot gates flip or readiness signals (XMTP ~2.4s, Railgun ~9s) land. A
   *  remount mid-restore is what left the restored card's swipe-back pan
   *  unarmed (the pan handler was bound to the pre-remount card instance), and a
   *  later remount reset the stack to Home. We instead gate VISIBILITY: the boot
   *  spinner / onboarding render as an OPAQUE overlay ON TOP of the live tree
   *  until `gatesOpen`, so Home never flashes and the navigator identity holds.
   *
   *  Why the navigator can mount before `restore.ready`: the restore push is
   *  itself gated on `restore.ready` (lib/lastRoute), and the overlay fully
   *  covers the tab root until then, so the user never SEES Home — the original
   *  no-flash guarantee is preserved without coupling it to the navigator's
   *  mount lifecycle. */
  return (
    <QueryClientProvider client={queryClient}>
    <WalletConnectProvider>
    <GestureHandlerRootView style={{ flex: 1 }}>
      <KeyboardProvider>
      <StatusBar style={barStyle} translucent backgroundColor="transparent"/>
      {/** @react-navigation/stack JS card stack (via NativeSwipeStack /
       *   withLayoutContext). SWIPE-BACK: the JS stack's `gestureEnabled` pan +
       *   `TransitionPresets.SlideFromRightIOS` (forHorizontalIOS) finger-follow
       *   the back gesture and parallax the previous card in from the left (pure
       *   JS + RNGH + reanimated, no native module / APK rebuild; we do NOT use
       *   rn-screens' goBackGesture worklet - it crashes on reanimated 4's
       *   measure()). gestureResponseDistance widens the edge catch-zone; the
       *   conversation screen's leftward reply-swipe coexists because the stack
       *   gesture arms only on a RIGHTWARD drag. */}
      <NativeSwipeStack
        /** Perf: stop the off-screen previous card from re-rendering / running
         *  effects while it's fully blurred. `detachInactiveScreens` lets
         *  react-native-screens detach the inactive card; `freezeOnBlur`
         *  (react-native-screens enableFreeze) suspends its renders until it's
         *  focused again. The swipe-back REVEAL is preserved: during an actual
         *  swipe the card is transitioning (not blurred), so it's live; freeze
         *  only kicks in once it's settled off-screen, and unfreezes the instant
         *  the gesture/transition re-focuses it. */
        detachInactiveScreens
        screenOptions={{
          headerShown: false,
          freezeOnBlur: true,
          cardStyle: { backgroundColor: bg },
          gestureEnabled: true,
          /** Full-width back-swipe: a rightward horizontal drag arms the pop from
           *  ANYWHERE (9999 > any screen width). gestureDirection stays 'horizontal'
           *  so vertical scroll + the LEFTWARD reply-swipe still win on their axes. */
          gestureResponseDistance: 9999,
          ...TransitionPresets.SlideFromRightIOS,
          /** INSTANT PUSH + interactive swipe-back reveal. We keep the
           *  SlideFromRightIOS preset (its `forHorizontalIOS` cardStyleInterpolator
           *  is what makes the previous card parallax-in during a finger-follow
           *  swipe) and gestureEnabled:true. We do NOT use `animation:'none'` —
           *  in @react-navigation/stack v7 that swaps the interpolator to
           *  `forNoAnimationCard` AND defaults gestureEnabled to false, which
           *  would kill the reveal gesture entirely. Instead we override only the
           *  `transitionSpec`: a 0ms `open` makes tapping a channel appear
           *  instantly, while `close` keeps the iOS spring so a swipe-back release
           *  (or programmatic pop) still animates smoothly. The gesture's
           *  finger-tracking is driven directly by the pan, independent of the
           *  open spec, so the reveal is preserved. */
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
      {/** BOOT / ONBOARDING OVERLAY — an OPAQUE layer over the live navigator,
       *   not a replacement for it (the old code early-returned a different root
       *   element, which forced the navigator to mount only after the gates flip
       *   and made it vulnerable to teardown). Absolute-fills the screen so the
       *   tab root underneath is never visible until everything is ready: no Home
       *   flash, and the @react-navigation card stack keeps its single mount. */}
      {!gatesOpen ? (
        <Col
          surface="surface" align="center" justify="center"
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
>
          <Spinner size={28} color={dark ? '#ffffff' : '#000000'}/>
        </Col>
      ) : !onboarding.seen ? (
        <Col
          surface="surface"
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
>
          <Onboarding onDone={onboarding.finish} />
        </Col>
      ) : null}
      </KeyboardProvider>
    </GestureHandlerRootView>
    </WalletConnectProvider>
    </QueryClientProvider>
  );
}
