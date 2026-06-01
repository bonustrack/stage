/** Platform-availability checks for the MetroPill native module.
 *
 *  Extracted from pill.ts (mechanical split, behavior identical). Kept in its
 *  own module so both pill.ts and pill.helpers.ts can import them without a
 *  circular dependency. */
import { Platform } from 'react-native';
import * as MetroPill from '../modules/metro-pill';

/** Whether the native pill/bubble module is linked on this build. */
export function isPillAvailable(): boolean {
  return Platform.OS === 'android' && MetroPill.isAvailable();
}

/** Whether Android Bubbles are supported + currently allowed (API 30+). */
export function isBubblesSupported(): boolean {
  return isPillAvailable() && MetroPill.isBubblesSupported();
}

export function hasOverlayPermission(): boolean {
  return isPillAvailable() && MetroPill.hasOverlayPermission();
}

export function isPillVisible(): boolean {
  return isPillAvailable() && MetroPill.isPillVisible();
}
