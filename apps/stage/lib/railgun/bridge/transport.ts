import { isNodejsMobilePresent, loadNodejsMobile, type NodejsChannel } from './nodejsMobile';
import type { BridgeCall, BridgeEvent } from './protocol';
import { attachRawProbe, fmtPayload, status } from './diagnostics';
import { startReadinessHandshake } from './handshake';

export type ExtraCall = 'ping' | 'hello' | 'engineStatus' | 'engineInit' | 'walletInfo' | 'balances' | 'sdk';
interface RequestEnvelope { id: number; call: BridgeCall | ExtraCall; params: unknown }
interface ReplyEnvelope { id: number; ok: boolean; result?: unknown; error?: string }

const REQUEST_EVENT = 'rg:request';
const REPLY_EVENT = 'rg:reply';
const READY_EVENT = 'event:message';
const readinessResolvers = new Map<number, () => void>();
const CALL_TIMEOUT_MS = 15_000;
export const ENGINE_INIT_TIMEOUT_MS = 90_000;

let started = false;
let nextId = 1;
let readyPromise: Promise<void> | null = null;
const pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void; timer: ReturnType<typeof setTimeout> }>();

export function isBridgeAvailable(): boolean {
  return isNodejsMobilePresent();
}

function channel(): NodejsChannel | null {
  return loadNodejsMobile()?.channel ?? null;
}

function startBridge(): boolean {
  if (started) return true;
  const mod = loadNodejsMobile();
  if (!mod) {
    status('native module not present ✗');
    return false;
  }
  attachRawProbe(mod.channel, RAW_PROBE_EVENTS);
  mod.channel.addListener(REPLY_EVENT, (...args: unknown[]) => {
    const reply = args[0] as ReplyEnvelope | undefined;
    if (!reply || typeof reply.id !== 'number') return;
    const ready = readinessResolvers.get(reply.id);
    if (ready) {
      readinessResolvers.delete(reply.id);
      ready();
      return;
    }
    const entry = pending.get(reply.id);
    if (!entry) return;
    pending.delete(reply.id);
    clearTimeout(entry.timer);
    if (reply.ok) {
      status(`reply ← pong (id ${reply.id}) ${fmtPayload(reply.result)}`);
      entry.resolve(reply.result);
    } else {
      status(`reply ← error (id ${reply.id}): ${reply.error ?? 'unknown'} ✗`);
      entry.reject(new Error(reply.error ?? 'Railgun bridge error'));
    }
  });
  const hs = startReadinessHandshake({
    channel: mod.channel,
    requestEvent: REQUEST_EVENT,
    nextId: () => nextId++,
    onReply: (id, resolve) => readinessResolvers.set(id, resolve),
    offReply: (id) => readinessResolvers.delete(id),
  });
  readyPromise = hs.promise;
  mod.channel.addListener(READY_EVENT, (...args: unknown[]) => {
    status(`Node booted ✓ ${fmtPayload(args[0])}`);
    hs.markReady();
  });
  status('starting Node runtime…');
  mod.start('main.js');
  started = true;
  return true;
}

const RAW_PROBE_EVENTS = ['message', 'event:message', 'event', READY_EVENT, REQUEST_EVENT, REPLY_EVENT];

export function rawCall(call: BridgeCall | ExtraCall, params: unknown, timeoutMs = CALL_TIMEOUT_MS): Promise<unknown> {
  const ch = channel();
  if (!ch) throw new Error('Private wallet needs the new app build');
  if (!started && !startBridge()) throw new Error('Railgun bridge unavailable');
  const id = nextId++;
  const envelope: RequestEnvelope = { id, call, params };
  return new Promise<unknown>((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      status(`timed out after ${Math.round(timeoutMs / 1000)}s (id ${id}) ✗`);
      reject(new Error(`Railgun bridge call timed out: ${call}`));
    }, timeoutMs);
    pending.set(id, { resolve, reject, timer });
    (readyPromise ?? Promise.resolve()).then(
      () => {
        status(`request sent → ${call} (id ${id})`);
        ch.post(REQUEST_EVENT, envelope);
      },
      (err: unknown) => {
        if (!pending.has(id)) return;
        pending.delete(id);
        clearTimeout(timer);
        reject(err instanceof Error ? err : new Error(String(err)));
      },
    );
  });
}

export function bridgeListen(
  event: BridgeEvent,
  cb: (payload: unknown) => void,
): () => void {
  const ch = channel();
  if (!ch) return () => undefined;
  const handler = (...args: unknown[]): void => { cb(args[0]); };
  ch.addListener(event, handler);
  return () => ch.removeListener?.(event, handler);
}
