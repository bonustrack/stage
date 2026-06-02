/** RN-side RAILGUN bridge client.
 *
 *  Sends typed RPC requests to the embedded Node process and awaits typed
 *  replies, and subscribes to push events. Replaces (when the native runtime is
 *  present) the lazy-guarded DIRECT SDK calls in lib/railgun/sdk*.ts — those
 *  cannot prove on Hermes because the prover is a Node N-API addon. See
 *  protocol.ts for the full rationale.
 *
 *  GUARD CONTRACT (identical to lib/railgun/native.ts): when
 *  nodejs-mobile-react-native isn't in the binary, isBridgeAvailable() is false
 *  and every call rejects with a friendly error; nothing here throws on import
 *  and the Metro bundler never resolves the native module. Until the new APK
 *  (with the runtime + bundled nodejs-project) ships, this stays dormant and the
 *  existing UI degradation path is unchanged.
 *
 *  TRANSPORT: we implement the minimal request/response correlation directly on
 *  the channel (each call gets a monotonic id; the Node side echoes it on the
 *  reply event), so we don't need the `nodejs-mobile-ipc2` dep on the RN side.
 *  The Node side may use ipc2 internally; the wire shape below is what matters.
 *
 *  SECURITY (key handling): the engine encryption key + mnemonic are derived on
 *  the RN side from the active account (lib/railgun/sdkWallet.ts) and passed in
 *  request payloads to the Node process. They cross only the in-process channel
 *  (no network, no disk on the RN side beyond the engine's own encrypted DB) and
 *  the Node process runs in the same app sandbox. The EOA private key NEVER
 *  leaves RN — shield/unshield sign on RN and pass only the resulting signature
 *  / populated tx. A password-gated key (vs derived) is a later hardening pass. */
import {
  isNodejsMobilePresent,
  loadNodejsMobile,
  type NodejsChannel,
} from './nodejsMobile';
import type { BridgeCall, BridgeEvent, CallParams, CallResult } from './protocol';
import { attachRawProbe, fmtPayload, status } from './diagnostics';

export { setBridgeStatusListener } from './diagnostics';

/** Wire envelopes. Requests carry a correlation id; replies echo it. */
interface RequestEnvelope { id: number; call: BridgeCall | 'ping' | 'engineStatus' | 'engineInit'; params: unknown }
interface ReplyEnvelope { id: number; ok: boolean; result?: unknown; error?: string }

const REQUEST_EVENT = 'rg:request';
const REPLY_EVENT = 'rg:reply';
/** main.js emits this once the Node host has booted + registered its request
 *  listener (main.js:101). We gate the first post on it to avoid the boot-race
 *  where an early request is dropped (post isn't buffered) and the call hangs. */
const READY_EVENT = 'event:message';
/** Keep tight so a genuine failure surfaces on-screen fast instead of a 2-minute
 *  spinner. A single proof can take ~30s, but the boot-await gate means we no
 *  longer need 120s of headroom for the dropped-first-request case. */
const CALL_TIMEOUT_MS = 15_000;
/** Engine init connects two RPC providers + loads the native prover; give it
 *  generous headroom so a slow public RPC doesn't trip a false timeout. */
const ENGINE_INIT_TIMEOUT_MS = 90_000;

let started = false;
let nextId = 1;
/** Resolves once the embedded Node host announces it has booted. Created in
 *  startBridge() before mod.start(); rawCall awaits it before posting. */
let readyPromise: Promise<void> | null = null;
const pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void; timer: ReturnType<typeof setTimeout> }>();

/** True when the embedded Node runtime can serve bridge calls on this binary. */
export function isBridgeAvailable(): boolean {
  return isNodejsMobilePresent();
}

function channel(): NodejsChannel | null {
  return loadNodejsMobile()?.channel ?? null;
}

/** Boot the Node process + wire the reply listener. Idempotent; no-op (returns
 *  false) when the runtime isn't present. Safe to call on every wallet open. */
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
  readyPromise = new Promise<void>((resolve) => {
    mod.channel.addListener(READY_EVENT, (...args: unknown[]) => {
      status(`Node booted ✓ ${fmtPayload(args[0])}`);
      resolve();
    });
  });
  status('starting Node runtime…');
  mod.start('main.js');
  started = true;
  return true;
}

/** Candidate channel event names main.js / the native layer might post the boot
 *  signal (or anything else) under — the raw probe listens on all of them. */
const RAW_PROBE_EVENTS = ['message', 'event:message', 'event', READY_EVENT, REQUEST_EVENT, REPLY_EVENT];

/** Issue a typed RPC call to the Node process. Rejects (never throws sync) when
 *  the runtime is absent so callers keep the existing degradation path. */
export async function bridgeCall<K extends BridgeCall>(
  call: K,
  params: CallParams<K>,
): Promise<CallResult<K>> {
  return rawCall(call, params) as Promise<CallResult<K>>;
}

/** Untyped request/response primitive shared by bridgeCall + pingBridge. Sends
 *  one envelope, awaits the id-matched reply, rejects on timeout / absent
 *  runtime. Keeps the correlation logic in one place. */
function rawCall(call: BridgeCall | 'ping' | 'engineStatus' | 'engineInit', params: unknown, timeoutMs = CALL_TIMEOUT_MS): Promise<unknown> {
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
    // Gate the post on the Node host being ready: the channel does NOT buffer,
    // so posting before main.js registers its 'rg:request' listener drops the
    // request and the call hangs until timeout. readyPromise resolves on the
    // host's boot announcement (READY_EVENT).
    void (readyPromise ?? Promise.resolve()).then(() => {
      status(`request sent → ${call} (id ${id})`);
      ch.post(REQUEST_EVENT, envelope);
    });
  });
}

/** Result of the embedded Node runtime liveness probe (handlers.ping in
 *  nodejs-assets/nodejs-project/main.js). */
export interface PingResult {
  pong: boolean;
  echo: unknown;
  node: string;
  at: number;
}

/** Round-trip a 'ping' through the embedded Node runtime. The KEY on-device
 *  feasibility test: a successful resolve proves the APK shipped + booted the
 *  Node runtime and the bi-directional channel works. Rejects (never throws
 *  sync) when the runtime is absent so callers degrade gracefully. */
export async function pingBridge(payload?: unknown): Promise<PingResult> {
  return (await rawCall('ping', payload ?? { hello: 'metro' })) as PingResult;
}

/** Result of the engine readiness probe (engine.js). `prover` true ⇒ Groth16
 *  native prover loaded; `networks` lists chains whose providers came up. */
export interface EngineStatusResult {
  ready: boolean;
  prover: boolean;
  networks: string[];
  version?: string | null;
  dbPath?: string;
  error?: string;
}

/** Read current engine status without forcing init (cheap, pollable). */
export async function engineStatus(): Promise<EngineStatusResult> {
  return (await rawCall('engineStatus', undefined)) as EngineStatusResult;
}

/** Init the engine + native prover + mainnet/Sepolia providers in the Node host
 *  (idempotent), then resolve the status. Overrides the short call timeout. */
export async function engineInit(dev = __DEV__): Promise<EngineStatusResult> {
  return (await rawCall('engineInit', { walletSource: 'metro', dev }, ENGINE_INIT_TIMEOUT_MS)) as EngineStatusResult;
}

/** Subscribe to an unsolicited Node push event (logs, balance/proof progress).
 *  Returns an unsubscribe fn; a no-op when the runtime is absent. */
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
