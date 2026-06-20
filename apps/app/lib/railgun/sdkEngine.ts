/** @file Real RAILGUN engine bootstrap (Hermes direct-SDK path): artifact store, startRailgunEngine, network provider loading, and Groth16 prover wiring, gated by the native prover so it only runs on a build that can prove. */

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
/** Public POI aggregator required at engine start for networks whose NETWORK_CONFIG defines `poi` (Sepolia + mainnet); without it loadProvider throws "network requires Proof Of Innocence". */
const POI_NODE_URLS = ['https://ppoi-agg.horsewithsixlegs.xyz'];

let engineReady = false;
let initPromise: Promise<boolean> | null = null;
const loadedNetworks = new Set<RailgunNet>();

/** Whether the engine has finished initialising. */
export function isEngineReady(): boolean { return engineReady; }

/** Persistent artifact store backed by expo-file-system (the engine downloads circuit artifacts once and reads them back on later proofs). */
function createArtifactStore(): ArtifactStore {
  const { ArtifactStore } = requireWalletApi();
  const root = new Directory(Paths.document, ARTIFACT_DIR);
  /** Abs helper. */
  const abs = (p: string): string => `${root.uri.replace(/\/$/, '')}/${p}`;
  return new ArtifactStore(
    async (path: string) => {
      const f = new File(abs(path));
      if (!f.exists) return null;
      return Buffer.from(await f.bytes());
    },
    (dir: string, path: string, item: string | Uint8Array) => {
      const d = new Directory(root, dir);
      if (!d.exists) d.create({ intermediates: true });
      new File(abs(path)).write(item);
      return Promise.resolve();
    },
    (path: string) => Promise.resolve(new File(abs(path)).exists),
  );
}

/** Minimal structural stand-in for the abstract-leveldown db the engine wants (RN has no native leveldown); the engine doesn't touch it until a wallet op runs, which needs the native prover anyway. */
interface EngineDb { location: string }
/** Create the Engine Db. */
function createEngineDb(): EngineDb {
  const d = new Directory(Paths.document, ENGINE_DB_DIR);
  if (!d.exists) d.create({ intermediates: true });
  return { location: d.uri.replace(/^file:\/\//, '').replace(/\/$/, '') };
}

/** Bridge our structural prover to the engine's nominal SnarkJSGroth16 (their formal array shapes differ — bigint vs number — but the runtime object is a drop-in snarkjs groth16). Narrow via unknown; never `any`. */
function asEngineGroth16(g: SnarkJSGroth16Like): SnarkJSGroth16 {
  return g as unknown as SnarkJSGroth16;
}

/** The subset of `getEngine().prover` we drive; the native triple is the real on-device path and snarkjs is a fallback, typed loosely and narrowed via unknown (never `any`). */
interface EngineProver {
  setSnarkJSGroth16(g: SnarkJSGroth16): void;
  setNativeProverGroth16(
    nativeProveRailgun: unknown,
    nativeProvePOI: unknown,
    circuits: Record<string, number>,
  ): void;
}

/** Register the Groth16 prover on the engine. Prefers the native prover triple (real on-device proving); falls back to a snarkjs-style object. Returns false when neither is present (build without the native prover) so the caller bails out gracefully. */
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

/** Initialize the engine ONCE + wire the Groth16 prover. Resolves false (never throws) when the native prover isn't present, so callers fire-and-forget. */
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
        false, /** useNativeArtifacts */
        false, /** skipMerkletreeScans */
        POI_NODE_URLS, /** poiNodeURLs — REQUIRED (Sepolia/mainnet define NETWORK_CONFIG.poi) */
        [], /** customPOILists */
        __DEV__, /** verboseScanLogging */
      );
      if (!wireProver(sdk)) return false;
      engineReady = true;
      return true;
    } catch {
      initPromise = null; /** allow retry */
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
