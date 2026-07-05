
import type { NodejsChannel } from './nodejsMobile';

let onBridgeStatus: ((line: string) => void) | null = null;

export function setBridgeStatusListener(cb: ((line: string) => void) | null): void {
  onBridgeStatus = cb;
}

export function status(line: string): void {
  onBridgeStatus?.(line);
}

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
