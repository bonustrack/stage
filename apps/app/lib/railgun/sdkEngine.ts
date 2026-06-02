/** Real RAILGUN engine bootstrap: artifact store, engine start, network
 *  providers, Groth16 prover wiring. Gated by the native prover (native.ts) so
 *  it only runs on a build that can actually prove; otherwise the caller skips
 *  it and the UI shows the 'needs new build' state.
 *
 *  Refs (docs.railgun.org → developer-guide/wallet/getting-started):
 *    5. Start the RAILGUN Privacy Engine  → startRailgunEngine + ArtifactStore
 *    6. Load a Groth16 prover per platform → getEngine().prover.setSnarkJSGroth16
 *  + the SDK's own test setup (dist/tests/setup.test.js) for the exact order. */

import '../cryptoShim';
import { Buffer } from 'buffer';
import { Directory, File, Paths } from 'expo-file-system';
import type { ArtifactStore, SnarkJSGroth16 } from '@railgun-community/wallet';
import { NETWORK_CONFIG, type FallbackProviderJsonConfig } from '@railgun-community/shared-models';
import {
  getNativeGroth16,
  getNativeProverTriple,
  isRailgunAvailable,
  type SnarkJSGroth16Like,
} from './native';
import { requireWalletApi } from './sdkApi';
import { RAILGUN_NETWORKS, type RailgunNet } from './networks';

const ARTIFACT_DIR = 'railgun-artifacts';
const ENGINE_DB_DIR = 'railgun-db';
const WALLET_SOURCE = 'metro';

let engineReady = false;
let initPromise: Promise<boolean> | null = null;
const loadedNetworks = new Set<RailgunNet>();

export function isEngineReady(): boolean { return engineReady; }

/** Persistent artifact store backed by expo-file-system (the engine downloads
 *  circuit artifacts once and reads them back on later proofs). */
function createArtifactStore(): ArtifactStore {
  const { ArtifactStore } = requireWalletApi();
  const root = new Directory(Paths.document, ARTIFACT_DIR);
  const abs = (p: string): string => `${root.uri.replace(/\/$/, '')}/${p}`;
  return new ArtifactStore(
    async (path: string) => {
      const f = new File(abs(path));
      if (!f.exists) return null;
      return Buffer.from(await f.bytes());
    },
    async (dir: string, path: string, item: string | Uint8Array) => {
      const d = new Directory(root, dir);
      if (!d.exists) d.create({ intermediates: true });
      new File(abs(path)).write(item);
    },
    async (path: string) => new File(abs(path)).exists,
  );
}

/** Minimal structural stand-in for the abstract-leveldown db the engine wants.
 *  RN has no native leveldown; a real adapter (react-native-level /
 *  asyncstorage-down) is a second-pass item. The engine doesn't touch the db
 *  until a wallet op runs (only possible once the native prover is present). */
interface EngineDb { location: string }
function createEngineDb(): EngineDb {
  const d = new Directory(Paths.document, ENGINE_DB_DIR);
  if (!d.exists) d.create({ intermediates: true });
  return { location: d.uri.replace(/^file:\/\//, '').replace(/\/$/, '') };
}

/** Bridge our structural prover to the engine's nominal SnarkJSGroth16 (their
 *  formal array shapes differ — bigint vs number — but the runtime object is a
 *  drop-in snarkjs groth16). Narrow via unknown; never `any`. */
function asEngineGroth16(g: SnarkJSGroth16Like): SnarkJSGroth16 {
  return g as unknown as SnarkJSGroth16;
}

/** The subset of `getEngine().prover` we drive. The native triple is the real
 *  on-device path (RAILGUN's `@railgun-privacy/native-prover`); snarkjs is a
 *  fallback. Typed loosely (the engine's nominal Proof/Buffer shapes differ from
 *  our structural ones); narrowed via unknown, never `any`. */
interface EngineProver {
  setSnarkJSGroth16(g: SnarkJSGroth16): void;
  setNativeProverGroth16(
    nativeProveRailgun: unknown,
    nativeProvePOI: unknown,
    circuits: Record<string, number>,
  ): void;
}

/** Register the Groth16 prover on the engine. Prefers the native prover triple
 *  (real on-device proving); falls back to a snarkjs-style object. Returns false
 *  when neither is present (build without the native prover) so the caller bails
 *  out gracefully. */
function wireProver(sdk: ReturnType<typeof requireWalletApi>): boolean {
  const prover = sdk.getEngine().prover as unknown as EngineProver;
  const triple = getNativeProverTriple();
  if (triple) {
    prover.setNativeProverGroth16(triple.nativeProveRailgun, triple.nativeProvePOI, triple.circuits);
    return true;
  }
  const groth16 = getNativeGroth16();
  if (groth16) {
    prover.setSnarkJSGroth16(asEngineGroth16(groth16));
    return true;
  }
  return false;
}

/** Initialize the engine ONCE + wire the Groth16 prover. Resolves false (never
 *  throws) when the native prover isn't present, so callers fire-and-forget. */
export async function initEngine(): Promise<boolean> {
  if (engineReady) return true;
  if (!isRailgunAvailable()) return false;
  if (initPromise) return initPromise;
  initPromise = (async (): Promise<boolean> => {
    try {
      const sdk = requireWalletApi();
      await sdk.startRailgunEngine(
        WALLET_SOURCE,
        createEngineDb(),
        __DEV__,
        createArtifactStore(),
        false, // useNativeArtifacts
        false, // skipMerkletreeScans
        undefined, // poiNodeURLs — SDK defaults
        [], // customPOILists
        __DEV__, // verboseScanLogging
      );
      if (!wireProver(sdk)) return false;
      engineReady = true;
      return true;
    } catch {
      initPromise = null; // allow retry
      return false;
    }
  })();
  return initPromise;
}

/** Connect the engine to one network's RPC. Idempotent per network. */
export async function ensureProvider(net: RailgunNet): Promise<void> {
  if (loadedNetworks.has(net)) return;
  const cfg = RAILGUN_NETWORKS[net];
  const fallback: FallbackProviderJsonConfig = {
    chainId: NETWORK_CONFIG[cfg.networkName].chain.id,
    providers: cfg.rpcUrls.map((url, i) => ({ provider: url, priority: i + 1, weight: 1 })),
  };
  await requireWalletApi().loadProvider(fallback, cfg.networkName, 1000 * 60 * 5);
  loadedNetworks.add(net);
}
