/** RN-side RAILGUN bridge TRANSPORT core. Typed RPC over the in-process
 *  nodejs-mobile channel (each call gets a monotonic id the Node side echoes on
 *  the reply).
 *
 *  Split out of index.ts so the low-level `rawCall`/`bridgeCall` primitives live
 *  in a leaf module: sdk.ts and wallet.ts depend on the transport WITHOUT
 *  importing index.ts (which re-exports them), breaking what was an
 *  index → sdk → index import cycle. index.ts re-exports this module's public
 *  surface so existing `from './bridge'` call sites are unchanged.
 *
 *  GUARD CONTRACT (like lib/railgun/native.ts): absent runtime ⇒ isBridge
 *  Available() false, calls reject friendly, nothing throws on import, bundler
 *  never resolves the native module. SECURITY: encryptionKey + mnemonic derived
 *  on RN (deriveKeys.ts), passed over the in-process channel only (no network);
 *  the EOA private key NEVER leaves RN (txs signed on RN, populated tx passed in). */
import { isNodejsMobilePresent, loadNodejsMobile, type NodejsChannel } from './nodejsMobile';
import type { BridgeCall, BridgeEvent, CallParams, CallResult } from './protocol';
import { attachRawProbe, fmtPayload, status } from './diagnostics';
import { startReadinessHandshake } from './handshake';

/** Non-BridgeCall host calls on the same channel (ping/hello/engineInit/etc). */
export type ExtraCall = 'ping' | 'hello' | 'engineStatus' | 'engineInit' | 'walletInfo' | 'balances' | 'sdk';
interface RequestEnvelope { id: number; call: BridgeCall | ExtraCall; params: unknown }
interface ReplyEnvelope { id: number; ok: boolean; result?: unknown; error?: string }

const REQUEST_EVENT = 'rg:request';
const REPLY_EVENT = 'rg:reply';
/** Emitted by main.js after it registers rg:request; one of two readiness signals. */
const READY_EVENT = 'event:message';
/** handshake 'hello' reply resolvers by id; checked before pending (bypass gate). */
const readinessResolvers = new Map<number, () => void>();
/** Tight so a genuine failure surfaces fast (the ready gate removes the old need
 *  for 120s of dropped-first-request headroom). */
const CALL_TIMEOUT_MS = 15_000;
export const ENGINE_INIT_TIMEOUT_MS = 90_000; // RPC providers + native prover

let started = false;
let nextId = 1;
/** Resolves once the host is ready (boot event OR hello reply), rejects on the
 *  handshake timeout; rawCall gates posts on it. */
let readyPromise: Promise<void> | null = null;
const pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void; timer: ReturnType<typeof setTimeout> }>();

/** True when the embedded Node runtime can serve bridge calls on this binary. */
export function isBridgeAvailable(): boolean {
  return isNodejsMobilePresent();
}

function channel(): NodejsChannel | null {
  return loadNodejsMobile()?.channel ?? null;
}

/** Boot the Node process + wire listeners. Idempotent (started guard); no-op
 *  false when absent. Safe per wallet open. */
export function startBridge(): boolean {
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
    // Handshake probe replies resolve readiness directly (not real RPC calls).
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
  // LISTENER-BEFORE-START: boot-event listener + handshake (posts one 'hello' on
  // the next tick) wired BEFORE mod.start. Readiness resolves on EITHER the boot
  // event OR the 'hello' reply (first wins); a SINGLE timeout fails it. No loop.
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
  mod.start('main.js'); // start LAST: listeners attached, boot event can't be missed
  started = true;
  return true;
}

const RAW_PROBE_EVENTS = ['message', 'event:message', 'event', READY_EVENT, REQUEST_EVENT, REPLY_EVENT];

/** Issue a typed RPC call to the Node process. */
export async function bridgeCall<K extends BridgeCall>(call: K, params: CallParams<K>): Promise<CallResult<K>> {
  return rawCall(call, params) as Promise<CallResult<K>>;
}

/** Send one envelope, await the id-matched reply; rejects on timeout/absent. */
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
    // Gate posts on the ready handshake: the channel does NOT buffer, so a post
    // before main.js registers rg:request is dropped. readyPromise rejects on the
    // handshake timeout if the host never boots, so the call fails loudly.
    (readyPromise ?? Promise.resolve()).then(
      () => {
        status(`request sent → ${call} (id ${id})`);
        ch.post(REQUEST_EVENT, envelope);
      },
      (err: Error) => {
        if (!pending.has(id)) return;
        pending.delete(id);
        clearTimeout(timer);
        reject(err instanceof Error ? err : new Error(String(err)));
      },
    );
  });
}

/** Subscribe to a Node push event; returns an unsubscribe fn (no-op if absent). */
export function bridgeListen(
  event: BridgeEvent,
  cb: (payload: unknown) => void,
): () => void {
  const ch = channel();
  if (!ch) return () => undefined;
  const handler = (...args: unknown[]): void => cb(args[0]);
  ch.addListener(event, handler);
  return () => ch.removeListener?.(event, handler);
}
