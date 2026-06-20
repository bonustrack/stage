
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
const POI_NODE_URLS = ['https://ppoi-agg.horsewithsixlegs.xyz'];

let engineReady = false;
let initPromise: Promise<boolean> | null = null;
const loadedNetworks = new Set<RailgunNet>();

export function isEngineReady(): boolean { return engineReady; }

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
    (dir: string, path: string, item: string | Uint8Array) => {
      const d = new Directory(root, dir);
      if (!d.exists) d.create({ intermediates: true });
      new File(abs(path)).write(item);
      return Promise.resolve();
    },
    (path: string) => Promise.resolve(new File(abs(path)).exists),
  );
}

interface EngineDb { location: string }
function createEngineDb(): EngineDb {
  const d = new Directory(Paths.document, ENGINE_DB_DIR);
  if (!d.exists) d.create({ intermediates: true });
  return { location: d.uri.replace(/^file:\/\//, '').replace(/\/$/, '') };
}

function asEngineGroth16(g: SnarkJSGroth16Like): SnarkJSGroth16 {
  return g as unknown as SnarkJSGroth16;
}

interface EngineProver {
  setSnarkJSGroth16(g: SnarkJSGroth16): void;
  setNativeProverGroth16(
    nativeProveRailgun: unknown,
    nativeProvePOI: unknown,
    circuits: Record<string, number>,
  ): void;
}

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
        false,
        false,
        POI_NODE_URLS,
        [],
        __DEV__,
      );
      if (!wireProver(sdk)) return false;
      engineReady = true;
      return true;
    } catch {
      initPromise = null;
      return false;
    }
  })();
  return initPromise;
}

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
