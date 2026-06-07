/** Engine status heartbeat (event:heartbeat) - RN consumer side.
 *
 *  The embedded engine (engine.js) emits a fixed-cadence heartbeat
 *  (scanConfig.heartbeatIntervalMs) carrying per-chain scan liveness so RN can
 *  detect a STALLED scan and kick it (e.g. balances forceFullRescan). Kept in its
 *  own module so bridge/index.ts stays under the 200-line cap; it talks to the
 *  channel directly (no import cycle with index.ts). */
import { loadNodejsMobile } from './nodejsMobile';

/** Per-chain scan liveness reported by the engine. */
export interface HeartbeatChain {
  scanning: boolean;
  lastProgressAt: number | null;
  /** scanning but no progress for > 2x the per-attempt timeout. */
  stalled: boolean;
}

/** Engine status heartbeat payload. `chains` is keyed by chainId as a string. */
export interface HeartbeatPayload {
  at: number;
  ready: boolean;
  chains: Record<string, HeartbeatChain>;
}

/** Subscribe to the engine status heartbeat. Returns an unsubscribe fn (no-op if
 *  the native runtime isn't in this binary). Use it to watch for any chain's
 *  `stalled: true` and re-kick the scan. */
export function onHeartbeat(cb: (hb: HeartbeatPayload) => void): () => void {
  const ch = loadNodejsMobile()?.channel ?? null;
  if (!ch) return () => undefined;
  const handler = (...args: unknown[]): void => cb(args[0] as HeartbeatPayload);
  ch.addListener('event:heartbeat', handler);
  return () => ch.removeListener?.('event:heartbeat', handler);
}
