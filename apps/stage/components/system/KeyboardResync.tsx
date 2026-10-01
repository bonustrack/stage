import { useEffect } from 'react';
import { AppState, Keyboard, Platform } from 'react-native';
import { withTiming } from 'react-native-reanimated';
import { KeyboardEvents, useReanimatedKeyboardAnimation } from 'react-native-keyboard-controller';
import { KEYBOARD_SETTLE_MS, keyboardLiftIsStale } from './KeyboardResync.model';

export function KeyboardResync(): null {
  const { height, progress } = useReanimatedKeyboardAnimation();
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const settle = (): void => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (!keyboardLiftIsStale(Keyboard.isVisible(), height.get(), progress.get())) return;
        height.set(withTiming(0));
        progress.set(withTiming(0));
      }, KEYBOARD_SETTLE_MS);
    };
    const hidden = Keyboard.addListener('keyboardDidHide', settle);
    const shown = Keyboard.addListener('keyboardDidShow', () => { clearTimeout(timer); });
    const libraryShown = KeyboardEvents.addListener('keyboardDidShow', settle);
    const app = AppState.addEventListener('change', (state) => { if (state === 'active') settle(); });
    return () => { clearTimeout(timer); hidden.remove(); shown.remove(); libraryShown.remove(); app.remove(); };
  }, [height, progress]);
  return null;
}
