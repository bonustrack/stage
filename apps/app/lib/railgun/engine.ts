/** Railgun engine lifecycle + pre-warm.
 *
 *  WHY THIS EXISTS / how it makes 'send' feel instant: zk proving is inherently
 *  ~20-30s, and a COLD engine adds engine-init + prover-load + Groth16 artifact
 *  download on top. We hide ALL of that by pre-warming EAGERLY in the background
 *  on app/wallet open (see prewarmRailgun), behind the native guard, so by the
 *  time the user hits 'send' the prover is already loaded and the artifacts are
 *  cached on disk — no cold-start latency is ever added to the action itself.
 *
 *  Everything here is a no-op (resolves to a friendly unavailable state) on a
 *  build where the native PROVER isn't linked yet — the bundler never resolves
 *  the heavy SDK because it's required lazily behind isRailgunAvailable(). The
 *  actual SDK init/provider wiring lives in sdkEngine.ts; this file keeps the
 *  pre-warm/ready contract the rest of lib/railgun depends on. */
import { isRailgunAvailable } from './native';
import { initEngine, ensureProvider, isEngineReady } from './sdkEngine';
import { DEFAULT_RAILGUN_NET, netForChainId } from './networks';

/** Whether the Railgun engine is initialised and ready to prove. */
export function isRailgunReady(): boolean { return isEngineReady(); }

/** Eagerly initialise the engine, load the Groth16 prover, and connect the
 *  default network's RPC so the first proof doesn't pay a cold start. Idempotent
 *  + safe to call on every app/wallet open. Resolves `false` (never throws) when
 *  the native prover isn't available, so callers can fire-and-forget. */
export async function prewarmRailgun(): Promise<boolean> {
  if (isEngineReady()) return true;
  if (!isRailgunAvailable()) return false;
  const ok = await initEngine();
  if (!ok) return false;
  await ensureProvider(DEFAULT_RAILGUN_NET).catch(() => undefined);
  return true;
}

/** Ensure the engine is warm + connected to the network for `chainId`. Used by
 *  an action right before it proves, so a tap on a not-yet-warm chain still
 *  works (it just waits for the warm-up it would otherwise have skipped). */
export async function ensureRailgunForChain(chainId: number): Promise<boolean> {
  if (!isRailgunAvailable()) return false;
  const ok = isEngineReady() ? true : await initEngine();
  if (!ok) return false;
  await ensureProvider(netForChainId(chainId).net).catch(() => undefined);
  return true;
}
