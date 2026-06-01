/** X (Twitter)-style floating LEFT drawer.
 *
 *  A full-height panel (~82% of screen width) that slides in from the left over
 *  a dim backdrop. It is OPENED by a rightward (left→right) finger-follow drag on
 *  the Home tab — that gesture is owned by the pager (`components/SwipeTabs.tsx`),
 *  which, when resting on index 0, drives the shared `progress` value (0 closed →
 *  1 fully open) instead of rubber-banding the strip. This component only RENDERS
 *  that progress and owns the CLOSE interactions (backdrop tap, swipe-left
 *  finger-follow, Android back).
 *
 *  Contents (reusing the app's account/profile plumbing):
 *    - avatar header: active account's stamp avatar + name + short address
 *    - tap-to-switch accounts list (same switchToAccount path as AccountsManager)
 *    - Profile row → /profile, Settings row → /settings
 *
 *  Pure JS (reanimated + gesture-handler, both already installed) — no new native
 *  module. */

import { useCallback, useEffect, useState } from 'react';
import { BackHandler, Pressable, useWindowDimensions } from 'react-native';
import { Box } from './layout';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle, withSpring, runOnJS, type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { useEffectiveColorScheme } from '../lib/theme';
import { usePeerProfiles } from '../lib/peerProfiles';
import { switchToAccount } from '../lib/xmtp';
import { loadAccounts, getActiveAccountId, type AccountRecord } from '../lib/accounts';
import { DrawerAccounts, DrawerHeader, DrawerRow } from './LeftDrawer.parts';

/** Spring used for both open + close settles. */
const SETTLE = { damping: 22, stiffness: 240 } as const;
/** Open if released past this fraction of the drawer width OR flung outward. */
const OPEN_FRACTION = 0.4;
const FLING_VELOCITY = 450;

export function LeftDrawer({ progress }: { progress: SharedValue<number> }): React.ReactElement {
  const dark = useEffectiveColorScheme() === 'dark';
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const W = Math.min(width * 0.82, 360);

  const head = dark ? '#ffffff' : '#000000';
  const sub = dark ? '#7a7a7e' : '#8a929d';
  const border = dark ? '#282a2d' : '#e4e4e5';
  const sheetBg = dark ? '#1a1b1d' : '#ffffff';

  const [accounts, setAccounts] = useState<AccountRecord[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  const refresh = useCallback(async (): Promise<void> => {
    const [list, active] = await Promise.all([loadAccounts(), getActiveAccountId()]);
    setAccounts(list);
    setActiveId(active);
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);
  usePeerProfiles(accounts.map(a => a.address));

  const activeRec = accounts.find(a => a.id === activeId) ?? accounts[0] ?? null;

  const close = useCallback((): void => {
    'worklet';
    progress.value = withSpring(0, SETTLE);
  }, [progress]);

  const open = useCallback((): void => {
    'worklet';
    progress.value = withSpring(1, SETTLE);
  }, [progress]);

  /** JS-side flag mirroring "is the drawer at all open" so we can flip
   *  pointerEvents + register the Android back handler only while it matters. */
  const [interactive, setInteractive] = useState(false);
  const setInteractiveJS = useCallback((v: boolean) => setInteractive(v), []);

  /** Android hardware back closes the drawer when open (and consumes the event). */
  useEffect(() => {
    if (!interactive) return undefined;
    const sub2 = BackHandler.addEventListener('hardwareBackPress', () => {
      close();
      return true;
    });
    return () => sub2.remove();
  }, [interactive, close]);

  /** Swipe-left finger-follow close while the drawer is open. */
  const pan = Gesture.Pan()
    .activeOffsetX([-10, 10])
    .failOffsetY([-16, 16])
    .onUpdate((e) => {
      'worklet';
      // Only react while open; drag-left reduces progress 1→0.
      const next = 1 + e.translationX / W;
      progress.value = Math.max(0, Math.min(1, next));
    })
    .onEnd((e) => {
      'worklet';
      const closed = e.translationX < -W * (1 - OPEN_FRACTION) || e.velocityX < -FLING_VELOCITY;
      if (closed) close();
      else open();
    });

  /** Track progress on the UI thread → JS interactive flag (pointerEvents/back). */
  const backdropStyle = useAnimatedStyle(() => {
    const p = progress.value;
    runOnJS(setInteractiveJS)(p > 0.001);
    return { opacity: p * 0.5 };
  });

  const panelStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: -W + progress.value * W }],
  }));

  function go(href: '/profile' | '/settings' | '/system'): void {
    close();
    router.navigate(href);
  }

  function onSwitch(id: string): void {
    close();
    if (id === activeId) return;
    void (async () => {
      try { await switchToAccount(id); await refresh(); } catch { /* swallow — surfaced elsewhere */ }
    })();
  }

  return (
    <Box
      pointerEvents={interactive ? 'auto' : 'none'}
      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
    >
      {/* Dim backdrop — tap to close. */}
      <Pressable onPress={() => close()} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
        <Animated.View style={[{ flex: 1, backgroundColor: '#000' }, backdropStyle]} />
      </Pressable>

      {/* The sliding panel + its own swipe-left-to-close gesture. */}
      <GestureDetector gesture={pan}>
        <Animated.View
          style={[
            {
              position: 'absolute', top: 0, bottom: 0, left: 0, width: W,
              backgroundColor: sheetBg,
              borderRightWidth: 1, borderRightColor: border,
              paddingTop: insets.top + 8,
              paddingBottom: insets.bottom + 8,
            },
            panelStyle,
          ]}
        >
          {/* Avatar header */}
          <DrawerHeader rec={activeRec} c={{ head, sub, border }} />

          <Box style={{ height: 1, backgroundColor: border }} />

          {/* Accounts — tap to switch. */}
          <DrawerAccounts accounts={accounts} activeId={activeId} onSwitch={onSwitch} c={{ head, sub, border }} />

          <Box style={{ height: 1, backgroundColor: border }} />

          {/* Profile + Settings rows. */}
          <DrawerRow icon="user" label="Profile" head={head} sub={sub} border={border} onPress={() => go('/profile')} />
          <DrawerRow icon="cog" label="Settings" head={head} sub={sub} border={border} onPress={() => go('/settings')} />
          <DrawerRow icon="desktop" label="System" head={head} sub={sub} border={border} onPress={() => go('/system')} />
        </Animated.View>
      </GestureDetector>
    </Box>
  );
}
