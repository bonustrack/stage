/**
 * @file Lazy native-availability guard for the passkey flow, probing for `react-native-passkeys` (and the ZeroDev passkey JS packages) so binaries without the prebuilt native module degrade gracefully to the ECDSA path instead of failing to bundle or crashing.
 */

import { Platform } from 'react-native';

let resolved = false;
let cached = false;

/** Lazily probe for the passkey native module behind a guard. Memoized; never throws; never statically imported so Metro can't fail to resolve it. */
function probe(): boolean {
  if (resolved) return cached;
  resolved = true;
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') return (cached = false);
  try {
    const mod: unknown = require('react-native-passkeys');
    cached =
      typeof mod === 'object' &&
      mod !== null &&
      'create' in mod &&
      typeof mod.create === 'function' &&
      'get' in mod &&
      typeof mod.get === 'function';
  } catch {
    cached = false;
  }
  return cached;
}

/** True when this binary can actually run the WebAuthn passkey flow. Until the new dev-client APK ships, this is false and the UI shows the upgrade state. */
export function passkeysAvailable(): boolean {
  return probe();
}
