/** Bottom-left sync indicator: a single small pulsing blue dot.
 *
 *  Appears + pulses while background sync work is in flight (app-open inbox
 *  sync, conversation revalidation, channels-list miss-refresher) so the user
 *  has visual confirmation that new messages are loading instead of waiting on
 *  an apparently-idle screen. Hidden the instant work settles; shown only after
 *  work has been pending ~300ms (see `useSyncActive`) to avoid flicker.
 *
 *  Minimalist per the app's design language: NO label, NO frame/surface/border
 *  - just a small blue dot that breathes. Non-interactive (pointerEvents none)
 *  so it never eats taps destined for the content beneath it. Plain `Animated`
 *  opacity loop - no reanimated, no cross-file worklets. */

import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet } from 'react-native';
import { useSyncActive } from '../lib/useSyncActive';

/** Tasteful blue accent. The palette `link` token is high-contrast white/black,
 *  not blue, so we use a literal blue here (same hue family as iOS/system blue,
 *  reads as "working" on both light + dark surfaces). */
const SYNC_BLUE = '#2f80ed';

export function SyncPill(): React.ReactElement | null {
  const active = useSyncActive();
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

  const dotOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] });
  const dotScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] });

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.dot, { backgroundColor: SYNC_BLUE, opacity: dotOpacity, transform: [{ scale: dotScale }] }]}
    />
  );
}

const styles = StyleSheet.create({
  dot: {
    width: 9,
    height: 9,
    borderRadius: 999,
  },
});
