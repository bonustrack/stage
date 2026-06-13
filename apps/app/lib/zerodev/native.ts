/** Passkey native-availability guard (mirrors lib/railgun/native.ts).
 *
 *  The passkey flow needs `react-native-passkeys` — a NATIVE module bridging
 *  WebAuthn create/get to the iOS Secure Enclave / Android Credential Manager.
 *  It is autolinked, so it only resolves in a binary that was prebuilt with the
 *  dep (a NEW dev-client APK). On the current binary (and on web), the lazy
 *  require below returns null and the smart-wallet passkey path degrades
 *  gracefully to "needs the new app build" — exactly like Railgun's Private tab.
 *
 *  The `@zerodev/passkey-validator`, `@zerodev/webauthn-key` and
 *  `@zerodev/react-native-passkeys-utils` JS packages are ALSO required lazily
 *  here so that, until they are added to node_modules + bundled, neither the
 *  Metro bundler nor `tsc` has to resolve a missing module. The ECDSA path
 *  (lib/zerodev/account.ts) works WITHOUT any of this. */

import { Platform } from 'react-native';

let resolved = false;
let cached = false;

/** Lazily probe for the passkey native module behind a guard. Memoized; never
 *  throws; never statically imported so Metro can't fail to resolve it. */
function probe(): boolean {
  if (resolved) return cached;
  resolved = true;
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') return (cached = false);
  try {
    const mod = require('react-native-passkeys');
    cached = typeof mod?.create === 'function' && typeof mod?.get === 'function';
  } catch {
    cached = false;
  }
  return cached;
}

/** True when this binary can actually run the WebAuthn passkey flow. Until the
 *  new dev-client APK ships, this is false and the UI shows the upgrade state. */
export function passkeysAvailable(): boolean {
  return probe();
}
