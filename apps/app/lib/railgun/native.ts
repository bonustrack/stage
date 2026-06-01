/** Railgun native-availability guard.
 *
 *  The Railgun engine (@railgun-community/wallet) ships native artifacts +
 *  a Groth16 prover that are only linked into a *native* build with the
 *  matching APK (see memory: don't point the bundler at new native deps
 *  before the APK is installed). Everything in lib/railgun therefore goes
 *  through `isRailgunAvailable()` so that:
 *    - on a build WITHOUT the module, every entry point degrades gracefully
 *      (cached UI still renders; actions surface a friendly "not available"),
 *    - the heavy SDK is only ever `require`d lazily behind this guard, so the
 *      Metro bundler never has to resolve it on a JS-only / web build.
 *
 *  Mirrors the pattern in lib/pill.platform.ts. */
import { Platform } from 'react-native';

let cached: boolean | null = null;

/** Lazily probe for the Railgun engine module. Result is memoised — the
 *  `require` is wrapped so a missing module (current state: SDK not yet
 *  installed / not linked) resolves to `false` instead of throwing at import
 *  time. iOS/Android only; never true on web. */
export function isRailgunAvailable(): boolean {
  if (cached !== null) return cached;
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') return (cached = false);
  try {
    require('@railgun-community/wallet');
    cached = true;
  } catch {
    cached = false;
  }
  return cached;
}

/** Resolve the engine module behind the guard, or null when unavailable.
 *  Typed loosely (`unknown`) because the SDK surface is only present on a
 *  native build; callers narrow what they touch. */
export function loadRailgunEngine(): unknown | null {
  if (!isRailgunAvailable()) return null;
  try {
    return require('@railgun-community/wallet');
  } catch {
    return null;
  }
}
