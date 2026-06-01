/** Railgun native-availability guard.
 *
 *  The Railgun engine (@railgun-community/wallet) is JS, but PROVING needs a
 *  Groth16 implementation that on React Native is the C++
 *  `@railgun-community/native-prover` module — only linked into a NATIVE build
 *  with the matching APK (see memory: don't point the bundler at new native
 *  deps before the APK is installed). The JS SDK alone loads fine on the current
 *  APK, so availability is gated on the NATIVE PROVER, not the JS package:
 *  everything in lib/railgun goes through `isRailgunAvailable()` so a build
 *  WITHOUT the prover degrades gracefully (cached UI still renders; actions
 *  surface a friendly "needs the new app build") and never crashes.
 *
 *  The prover module is required LAZILY behind a try/catch (mirroring
 *  components/VoiceMessage.decode.ts + lib/pill.platform.ts) so the Metro
 *  bundler never has to resolve a missing native module. */
import { Platform } from 'react-native';

/** Minimal structural type for the snarkjs `groth16` object the engine expects
 *  (typed loosely-but-without-`any`; we only hand it to the engine). */
export interface SnarkJSGroth16Like {
  fullProve: (
    input: Record<string, unknown>,
    wasm: Uint8Array | string,
    zkey: Uint8Array | string,
  ) => Promise<{ proof: unknown; publicSignals: unknown }>;
  verify: (vkey: Record<string, unknown>, publicSignals: unknown, proof: unknown) => Promise<boolean>;
}

interface NativeProverModule { groth16?: SnarkJSGroth16Like; default?: SnarkJSGroth16Like }

let proverResolved = false;
let proverCached: SnarkJSGroth16Like | null = null;

/** Resolve the native Groth16 prover, or null when the native module isn't in
 *  the running binary. Memoized; never throws. */
export function getNativeGroth16(): SnarkJSGroth16Like | null {
  if (proverResolved) return proverCached;
  proverResolved = true;
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') return (proverCached = null);
  try {
    const mod = require('@railgun-community/native-prover') as NativeProverModule;
    proverCached = mod.groth16 ?? mod.default ?? null;
  } catch {
    proverCached = null;
  }
  return proverCached;
}

let cached: boolean | null = null;

/** True when the Railgun feature can actually prove on THIS binary (native
 *  prover present). iOS/Android only; never true on web. Memoized. */
export function isRailgunAvailable(): boolean {
  if (cached !== null) return cached;
  cached = getNativeGroth16() != null;
  return cached;
}

/** Resolve the engine JS module behind the guard, or null when unavailable.
 *  Typed loosely (`unknown`) because the heavy surface is only relevant on a
 *  native build; callers narrow what they touch. */
export function loadRailgunEngine(): unknown | null {
  if (!isRailgunAvailable()) return null;
  try {
    return require('@railgun-community/wallet');
  } catch {
    return null;
  }
}
