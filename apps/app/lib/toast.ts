/** Lightweight cross-platform toast helper.
 *
 *  Less wants "no Android system modal" for trivial confirmations like
 *  "Copied" — `Alert.alert` triggers the OS dialog which is heavy and
 *  steals focus. `ToastAndroid.show` is the right primitive on Android;
 *  on iOS there's no built-in toast, so we noop (the action itself is
 *  the feedback — the value is already on the clipboard).
 *
 *  Keeps the surface tiny: one function. */

import { Platform, ToastAndroid } from 'react-native';

/** Show a brief toast on Android; silent no-op on iOS. */
export function flash(message: string): void {
  if (Platform.OS === 'android') {
    ToastAndroid.show(message, ToastAndroid.SHORT);
  }
  /** iOS fallback: silent. Callers should rely on visual feedback
   *  (button state, content change) for the confirmation. */
}
