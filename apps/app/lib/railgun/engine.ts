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
 *  build where the native module isn't linked yet — the bundler never resolves
 *  the SDK because loadRailgunEngine() require()s it lazily behind the guard. */
import { loadRailgunEngine, isRailgunAvailable } from './native';

/** Engine init runs at most once; concurrent callers await the same promise so
 *  pre-warm + a fast user tap don't double-initialise. */
let warmup: Promise<boolean> | null = null;
let ready = false;

export function isRailgunReady(): boolean { return ready; }

/** Eagerly initialise the engine, load the Groth16 prover, and preload the
 *  proving artifacts so the first proof doesn't pay a cold start. Idempotent +
 *  safe to call on every app/wallet open. Resolves `false` (never throws) when
 *  the native module isn't available, so callers can fire-and-forget. */
export async function prewarmRailgun(): Promise<boolean> {
  if (ready) return true;
  if (!isRailgunAvailable()) return false;
  if (warmup) return warmup;
  warmup = (async (): Promise<boolean> => {
    try {
      const eng = loadRailgunEngine() as RailgunEngineApi | null;
      if (!eng) return false;
      // 1) Start the engine (LevelDB artifact store lives in the app doc dir →
      //    proving keys/artifacts are downloaded ONCE and cached on disk).
      await eng.startRailgunEngine?.();
      // 2) Load the Groth16 prover into memory (the expensive cold step).
      await eng.loadProvider?.();
      // 3) Preload the shield/transfer/unshield Groth16 artifacts so the first
      //    real proof reuses them instead of fetching mid-action.
      await eng.preloadArtifacts?.();
      ready = true;
      return true;
    } catch {
      warmup = null; // allow a retry on the next open
      return false;
    }
  })();
  return warmup;
}

/** Minimal structural view of the engine surface we touch. The real SDK has a
 *  far larger API; we only narrow the methods pre-warm needs, and treat them as
 *  optional so a version skew degrades to "not warmed" instead of crashing. */
interface RailgunEngineApi {
  startRailgunEngine?: () => Promise<void>;
  loadProvider?: () => Promise<void>;
  preloadArtifacts?: () => Promise<void>;
}
