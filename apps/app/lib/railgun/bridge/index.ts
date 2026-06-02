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

/** Wire envelopes. Requests carry a correlation id; replies echo it. */
interface RequestEnvelope { id: number; call: BridgeCall | 'ping'; params: unknown }
interface ReplyEnvelope { id: number; ok: boolean; result?: unknown; error?: string }

const REQUEST_EVENT = 'rg:request';
const REPLY_EVENT = 'rg:reply';
/** A single proof can take ~30s; allow generous headroom before timing out. */
const CALL_TIMEOUT_MS = 120_000;

let started = false;
let nextId = 1;
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
  if (!mod) return false;
  mod.channel.addListener(REPLY_EVENT, (...args: unknown[]) => {
    const reply = args[0] as ReplyEnvelope | undefined;
    if (!reply || typeof reply.id !== 'number') return;
    const entry = pending.get(reply.id);
    if (!entry) return;
    pending.delete(reply.id);
    clearTimeout(entry.timer);
    if (reply.ok) entry.resolve(reply.result);
    else entry.reject(new Error(reply.error ?? 'Railgun bridge error'));
  });
  mod.start('main.js');
  started = true;
  return true;
}

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
function rawCall(call: BridgeCall | 'ping', params: unknown): Promise<unknown> {
  const ch = channel();
  if (!ch) throw new Error('Private wallet needs the new app build');
  if (!started && !startBridge()) throw new Error('Railgun bridge unavailable');
  const id = nextId++;
  const envelope: RequestEnvelope = { id, call, params };
  return new Promise<unknown>((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`Railgun bridge call timed out: ${call}`));
    }, CALL_TIMEOUT_MS);
    pending.set(id, { resolve, reject, timer });
    ch.send(REQUEST_EVENT, envelope);
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
