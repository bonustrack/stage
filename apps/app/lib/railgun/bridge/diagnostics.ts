/** @file On-screen lifecycle diagnostics for the nodejs-mobile bridge: a single status-line sink plus a raw catch-all probe that surfaces every channel event by name when adb logcat is unavailable. */

/** With no on-device adb logcat, the bridge emits one formatted status line per lifecycle point plus a raw catch-all for ANY channel event; the probe UI registers a sink via setBridgeStatusListener and renders the ordered log so a stall shows in one screenshot. */
import type { NodejsChannel } from './nodejsMobile';

/** Optional sink the probe UI registers; null clears it. */
let onBridgeStatus: ((line: string) => void) | null = null;

/** Register (or clear, with null) the diagnostics sink. */
export function setBridgeStatusListener(cb: ((line: string) => void) | null): void {
  onBridgeStatus = cb;
}

/** Emit one status line to the registered sink (no-op when none). */
export function status(line: string): void {
  onBridgeStatus?.(line);
}

/** Best-effort stringify for a payload that failed `JSON.stringify` (cyclic/throwing toJSON). */
function fmtUnstringifiable(payload: unknown): string {
  if (typeof payload === 'object' && payload !== null) {
    const fn: unknown = (payload as { toString?: unknown }).toString;
    if (typeof fn === 'function') {
      const out: unknown = (fn as () => unknown).call(payload);
      if (typeof out === 'string') return out;
    }
    return Object.prototype.toString.call(payload);
  }
  if (typeof payload === 'symbol') return payload.toString();
  if (typeof payload === 'number' || typeof payload === 'bigint' || typeof payload === 'boolean') {
    return String(payload);
  }
  return '';
}

/** Compact, throw-safe stringify of a channel payload for the status log. */
export function fmtPayload(payload: unknown): string {
  if (payload === undefined) return '';
  try {
    const s = typeof payload === 'string' ? payload : JSON.stringify(payload);
    return s.length > 120 ? `${s.slice(0, 117)}…` : s;
  } catch {
    return fmtUnstringifiable(payload);
  }
}

let rawProbeAttached = false;

/** Listen on every event name the boot signal might arrive under and emit "rx event: <name>" so an unexpected name is visible. 'message' is the legacy nodejs-mobile default channel event. Idempotent across startBridge calls. */
export function attachRawProbe(ch: NodejsChannel, names: readonly string[]): void {
  if (rawProbeAttached) return;
  rawProbeAttached = true;
  const seen = new Set<string>();
  for (const name of names) {
    if (seen.has(name)) continue;
    seen.add(name);
    ch.addListener(name, (...args: unknown[]) => {
      status(`rx event: ${name} ${fmtPayload(args[0])}`.trimEnd());
    });
  }
}
