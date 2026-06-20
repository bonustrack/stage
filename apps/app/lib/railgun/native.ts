/** @file Railgun native-availability guard that lazily requires the nodejs-mobile Groth16 prover behind a try/catch (returning null to degrade gracefully on plain Expo/Hermes builds), exposing the engine's native triple with a snarkjs-style `groth16` fallback. */
import { Platform } from 'react-native';

/** Minimal structural type for the snarkjs `groth16` object the engine expects (typed loosely-but-without-`any`; we only hand it to the engine). */
export interface SnarkJSGroth16Like {
  fullProve: (
    input: Record<string, unknown>,
    wasm: Uint8Array | string,
    zkey: Uint8Array | string,
  ) => Promise<{ proof: unknown; publicSignals: unknown }>;
  verify: (vkey: Record<string, unknown>, publicSignals: unknown, proof: unknown) => Promise<boolean>;
}

/** The native prover's per-circuit synchronous prove fn (returns a Groth16 Proof). Typed loosely — we only forward it into the engine's setter. */
type NativeProveFn = (
  circuitId: number,
  datBuffer: Uint8Array,
  zkeyBuffer: Uint8Array,
  inputJson: Record<string, unknown>,
  progressCallback: (progress: number) => void,
) => unknown;

/** The exact triple `getEngine().prover.setNativeProverGroth16(...)` consumes, exported by `@railgun-privacy/native-prover`. */
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

/** Lazily resolve the native prover module behind the guard. Returns null on a binary without the nodejs-mobile prover (plain Expo/Hermes). Memoized; never throws — and never statically referenced so Metro can't fail to resolve it. */
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

/** Resolve the engine's native Groth16 prover triple, or null when the native module isn't in the running binary. Memoized; never throws. */
export function getNativeProverTriple(): NativeProverTriple | null {
  const mod = loadNativeProverModule();
  if (!mod?.nativeProveRailgun || !mod.nativeProvePOI || !mod.CIRCUITS) return null;
  return {
    nativeProveRailgun: mod.nativeProveRailgun,
    nativeProvePOI: mod.nativeProvePOI,
    circuits: mod.CIRCUITS,
  };
}

/** Structural snarkjs-style fallback accessor (some prover builds expose a `groth16` object instead of the native triple). Memoized; never throws. */
export function getNativeGroth16(): SnarkJSGroth16Like | null {
  const mod = loadNativeProverModule();
  return mod?.groth16 ?? mod?.default ?? null;
}

let cached: boolean | null = null;

/** True when the Railgun feature can actually prove on THIS binary (native prover present, either as the triple or a snarkjs-style object). iOS/Android only; never true on web. Memoized. */
export function isRailgunAvailable(): boolean {
  if (cached !== null) return cached;
  cached = getNativeProverTriple() != null || getNativeGroth16() != null;
  return cached;
}
