import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';
import { runOnJS, useAnimatedReaction, withTiming } from 'react-native-reanimated';
import { useReanimatedFocusedInput, useReanimatedKeyboardAnimation } from 'react-native-keyboard-controller';
import { KEYBOARD_CHECK_MS, KEYBOARD_MISSES_TO_DROP, keyboardMisses } from './KeyboardResync.model';

export function KeyboardResync(): null {
  const { height, progress } = useReanimatedKeyboardAnimation();
  const { input } = useReanimatedFocusedInput();
  const [lifted, setLifted] = useState(false);
  useAnimatedReaction(
    () => height.value !== 0 || progress.value !== 0,
    (now, before) => { if (now !== before) runOnJS(setLifted)(now); },
  );
  useEffect(() => {
    if (Platform.OS !== 'android' || !lifted) return;
    let misses = 0;
    const timer = setInterval(() => {
      misses = keyboardMisses(misses, Keyboard.isVisible(), input.get() !== null);
      if (misses < KEYBOARD_MISSES_TO_DROP) return;
      height.set(withTiming(0));
      progress.set(withTiming(0));
    }, KEYBOARD_CHECK_MS);
    return () => { clearInterval(timer); };
  }, [lifted, height, progress, input]);
  return null;
}
