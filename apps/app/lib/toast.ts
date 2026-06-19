/**
 * @file Lightweight cross-platform toast helper: `ToastAndroid.show` on Android for trivial confirmations like "Copied" (avoiding the heavy focus-stealing Alert.alert dialog), silent no-op on iOS.
 */

import { Platform, ToastAndroid } from 'react-native';

/** Show a brief toast on Android; silent no-op on iOS. */
export function flash(message: string): void {
  if (Platform.OS === 'android') {
    ToastAndroid.show(message, ToastAndroid.SHORT);
  }
  /** iOS fallback: silent. Callers should rely on visual feedback (button state, content change) for the confirmation. */
}
