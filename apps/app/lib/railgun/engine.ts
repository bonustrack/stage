/** @file Railgun engine lifecycle + eager background pre-warm (engine init, prover load, artifact download) hiding ~20-30s zk cold-start so 'send' feels instant; a no-op when the native prover isn't linked, with SDK wiring in sdkEngine.ts. */
import { isRailgunAvailable } from './native';
import { initEngine, ensureProvider, isEngineReady } from './sdkEngine';
import { DEFAULT_RAILGUN_NET, netForChainId } from './networks';

/** Eagerly init the engine, load the Groth16 prover, and connect the default network's RPC so the first proof skips the cold start; idempotent, safe per app/wallet open, resolves `false` (never throws) when the native prover is unavailable. */
export async function prewarmRailgun(): Promise<boolean> {
  if (isEngineReady()) return true;
  if (!isRailgunAvailable()) return false;
  const ok = await initEngine();
  if (!ok) return false;
  await ensureProvider(DEFAULT_RAILGUN_NET).catch(() => undefined);
  return true;
}

/** Ensure the engine is warm + connected to the network for `chainId`. Used by an action right before it proves, so a tap on a not-yet-warm chain still works (it just waits for the warm-up it would otherwise have skipped). */
export async function ensureRailgunForChain(chainId: number): Promise<boolean> {
  if (!isRailgunAvailable()) return false;
  const ok = isEngineReady() ? true : await initEngine();
  if (!ok) return false;
  await ensureProvider(netForChainId(chainId).net).catch(() => undefined);
  return true;
}
