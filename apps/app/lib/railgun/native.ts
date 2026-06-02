/** Railgun native-availability guard.
 *
 *  The Railgun engine (@railgun-community/wallet) is JS, but PROVING needs a
 *  Groth16 implementation that on mobile is the C++ `@railgun-privacy/native-prover`
 *  module. That package is NOT a Hermes/Expo-autolinked native module — it is a
 *  node-gyp-build N-API `.node` addon compiled for nodejs-mobile (the engine's
 *  reference app, Railway-Wallet, runs the whole engine inside
 *  nodejs-mobile-react-native and `require`s the prover from that embedded Node
 *  process). It therefore only resolves when such a runtime is present in the
 *  binary; on a plain Expo/Hermes build the lazy require below returns null and
 *  the feature degrades gracefully (cached UI still renders; actions surface a
 *  friendly "needs the new app build") and never crashes.
 *
 *  The prover module is required LAZILY behind a try/catch (mirroring
 *  components/VoiceMessage.decode.ts + lib/pill.platform.ts) so the Metro
 *  bundler never has to resolve a missing native module. The native prover
 *  exposes the engine's `setNativeProverGroth16(nativeProveRailgun,
 *  nativeProvePOI, CIRCUITS)` triple; the older snarkjs-style accessor is kept
 *  as a structural fallback for any prover that exposes a `groth16` object. */
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

/** The native prover's per-circuit synchronous prove fn (returns a Groth16
 *  Proof). Typed loosely — we only forward it into the engine's setter. */
export type NativeProveFn = (
  circuitId: number,
  datBuffer: Uint8Array,
  zkeyBuffer: Uint8Array,
  inputJson: Record<string, unknown>,
  progressCallback: (progress: number) => void,
) => unknown;

/** The exact triple `getEngine().prover.setNativeProverGroth16(...)` consumes,
 *  exported by `@railgun-privacy/native-prover`. */
export interface NativeProverTriple {
  nativeProveRailgun: NativeProveFn;
  nativeProvePOI: NativeProveFn;
  circuits: Record<string, number>;
}

interface NativeProverModule {
  groth16?: SnarkJSGroth16Like;
  default?: SnarkJSGroth16Like;
  nativeProveRailgun?: NativeProveFn;
  nativeProvePOI?: NativeProveFn;
  CIRCUITS?: Record<string, number>;
}

let modResolved = false;
let modCached: NativeProverModule | null = null;

/** Lazily resolve the native prover module behind the guard. Returns null on a
 *  binary without the nodejs-mobile prover (plain Expo/Hermes). Memoized; never
 *  throws — and never statically referenced so Metro can't fail to resolve it. */
function loadNativeProverModule(): NativeProverModule | null {
  if (modResolved) return modCached;
  modResolved = true;
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') return (modCached = null);
  try {
    modCached = require('@railgun-privacy/native-prover') as NativeProverModule;
  } catch {
    modCached = null;
  }
  return modCached;
}

/** Resolve the engine's native Groth16 prover triple, or null when the native
 *  module isn't in the running binary. Memoized; never throws. */
export function getNativeProverTriple(): NativeProverTriple | null {
  const mod = loadNativeProverModule();
  if (!mod?.nativeProveRailgun || !mod.nativeProvePOI || !mod.CIRCUITS) return null;
  return {
    nativeProveRailgun: mod.nativeProveRailgun,
    nativeProvePOI: mod.nativeProvePOI,
    circuits: mod.CIRCUITS,
  };
}

/** Structural snarkjs-style fallback accessor (some prover builds expose a
 *  `groth16` object instead of the native triple). Memoized; never throws. */
export function getNativeGroth16(): SnarkJSGroth16Like | null {
  const mod = loadNativeProverModule();
  return mod?.groth16 ?? mod?.default ?? null;
}

let cached: boolean | null = null;

/** True when the Railgun feature can actually prove on THIS binary (native
 *  prover present, either as the triple or a snarkjs-style object). iOS/Android
 *  only; never true on web. Memoized. */
export function isRailgunAvailable(): boolean {
  if (cached !== null) return cached;
  cached = getNativeProverTriple() != null || getNativeGroth16() != null;
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
