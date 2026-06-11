/** Floating "Syncing" pill, bottom-left above the tab bar.
 *
 *  Appears + pulses while background sync work is in flight (app-open inbox
 *  sync, conversation revalidation, channels-list miss-refresher) so the user
 *  has visual confirmation that new messages are loading instead of waiting on
 *  an apparently-idle screen. Hidden the instant work settles; shown only after
 *  work has been pending ~300ms (see `useSyncActive`) to avoid flicker.
 *
 *  Minimalist per the app's design language: a small rounded pill (toolbar
 *  surface + hairline border, no shadow/gradient), a pulsing dot + "Syncing"
 *  label. Non-interactive (pointerEvents none) so it never eats taps destined
 *  for the content beneath it. Plain `Animated` opacity loop — no reanimated,
 *  no cross-file worklets. */

import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet } from 'react-native';
import { Text } from '@metro-labs/kit/text';
import { usePalette } from '../lib/theme';
import { useSyncActive } from '../lib/useSyncActive';

export function SyncPill(): React.ReactElement | null {
  const active = useSyncActive();
  const pal = usePalette();
  /** Pulse drives BOTH the dot opacity (strong pulse) and a subtle whole-pill
   *  breathe, so it reads as "working" without being loud. */
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!active) return;
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 650, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 650, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [active, pulse]);

  if (!active) return null;

  const pillOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.82, 1] });
  const dotOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.pill,
        {
          backgroundColor: pal.toolbarBg,
          borderColor: pal.border,
          opacity: pillOpacity,
        },
      ]}
>
      <Animated.View style={[styles.dot, { backgroundColor: pal.link, opacity: dotOpacity }]} />
      <Text role="secondary" size="2xs" weight="medium">Syncing</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
});
