import { Platform } from 'react-native';

export interface SnarkJSGroth16Like {
  fullProve: (
    input: Record<string, unknown>,
    wasm: Uint8Array | string,
    zkey: Uint8Array | string,
  ) => Promise<{ proof: unknown; publicSignals: unknown }>;
  verify: (vkey: Record<string, unknown>, publicSignals: unknown, proof: unknown) => Promise<boolean>;
}

type NativeProveFn = (
  circuitId: number,
  datBuffer: Uint8Array,
  zkeyBuffer: Uint8Array,
  inputJson: Record<string, unknown>,
  progressCallback: (progress: number) => void,
) => unknown;

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

export function getNativeProverTriple(): NativeProverTriple | null {
  const mod = loadNativeProverModule();
  if (!mod?.nativeProveRailgun || !mod.nativeProvePOI || !mod.CIRCUITS) return null;
  return {
    nativeProveRailgun: mod.nativeProveRailgun,
    nativeProvePOI: mod.nativeProvePOI,
    circuits: mod.CIRCUITS,
  };
}

export function getNativeGroth16(): SnarkJSGroth16Like | null {
  const mod = loadNativeProverModule();
  return mod?.groth16 ?? mod?.default ?? null;
}

let cached: boolean | null = null;

export function isRailgunAvailable(): boolean {
  if (cached !== null) return cached;
  cached = getNativeProverTriple() != null || getNativeGroth16() != null;
  return cached;
}
